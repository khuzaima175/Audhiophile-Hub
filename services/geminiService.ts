import { GoogleGenAI, Content, Part, Tool } from "@google/genai";
import { Message, AudioProfile, ChatSession, GroundingSource, KnowledgeEntry } from "../types";
import { v4 as uuidv4 } from 'uuid';

// Model fallback configuration — gemini-3.6-flash is the primary API identifier
const MODELS = [
  'gemini-3.6-flash',
  'gemini-2.5-flash',
  'gemini-2.0-flash'
] as const;

type ModelName = typeof MODELS[number];

const createClient = () => {
  const localKey = typeof window !== 'undefined' ? localStorage.getItem('audiosage_api_key') : null;
  const envKey = (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) || (import.meta as any).env?.VITE_GEMINI_API_KEY;
  const apiKey = localKey || envKey;

  if (!apiKey) {
    throw new Error(
      "API Key is missing. Please add GEMINI_API_KEY in Settings or .env.local file.\n" +
      "Get your free key from: https://aistudio.google.com/app/apikey"
    );
  }
  return new GoogleGenAI({ apiKey });
};

// --- CRINACLE IEF PREFERENCE TARGET DATA (Verbatim 400-Point Reference) ---
const CRINACLE_TARGET_DATA = `
Frequency,Target_dB
20,6.63
25,6.82
30,6.93
35,6.94
40,6.88
50,6.62
60,6.20
70,5.59
80,4.84
90,4.02
100,3.18
125,1.39
150,0.18
200,-0.87
250,-0.91
300,-0.63
400,-0.08
500,0.06
600,-0.09
700,-0.42
800,-0.88
900,-1.26
1000,-1.26
1250,0.34
1500,1.64
1750,2.64
2000,4.12
2250,5.94
2500,7.48
2750,8.26
2950,8.41
3000,8.40
3250,7.98
3500,7.11
4000,4.92
4500,3.25
5000,2.26
5500,1.25
6000,0.47
7000,0.29
7500,0.43
8000,0.06
9000,-2.66
10000,-5.80
12000,-10.52
14000,-7.35
16000,-7.05
18000,-8.21
20000,-9.81
`;

// Helper: Naive RAG to find relevant history from raw sessions
const getRelevantHistoryContext = (allSessions: ChatSession[], currentPrompt: string): string => {
  if (!allSessions || !allSessions.length || !currentPrompt) return "";

  const keywords = currentPrompt.toLowerCase().split(' ').filter(w => w.length > 3);
  if (keywords.length === 0) return "";

  // Score sessions based on keyword matches
  const scoredSessions = allSessions.map(session => {
    let score = 0;
    const sessionText = (session.title + " " + session.messages.map(m => m.text || "").join(" ")).toLowerCase();

    keywords.forEach(kw => {
      if (sessionText.includes(kw)) score++;
    });

    return { session, score };
  });

  const relevantSessions = scoredSessions
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(s => s.session);

  if (relevantSessions.length === 0) return "";

  let contextString = "\nRELEVANT PAST CONVERSATIONS (Use these to maintain continuity):\n";
  relevantSessions.forEach((session) => {
    const summary = session.messages
      .slice(-4)
      .map(m => `${m.role.toUpperCase()}: ${(m.text || (m.audio ? '[Voice transmission]' : '[Image analysis]')).substring(0, 300)}...`)
      .join('\n');
    contextString += `\n[Session: ${session.title || 'Audio Research'}]\n${summary}\n`;
  });

  return contextString;
};

// Helper: RAG for Knowledge Base (Summarized Facts)
const getKnowledgeBaseContext = (knowledgeBase: KnowledgeEntry[], currentPrompt: string): string => {
  if (!knowledgeBase || knowledgeBase.length === 0 || !currentPrompt) return "";

  const keywords = currentPrompt.toLowerCase().split(' ').filter(w => w.length > 3);
  if (keywords.length === 0) return "";

  // Filter entries that match keywords in the prompt
  const matches = knowledgeBase.filter(entry => {
    const keyFactsStr = Array.isArray(entry.keyFacts) ? entry.keyFacts.join(" ") : "";
    const text = ((entry.topic || "") + " " + (entry.summary || "") + " " + keyFactsStr).toLowerCase();
    return keywords.some(kw => text.includes(kw));
  });

  if (matches.length === 0) return "";

  // Sort by relevance (match count) - top 5 matches
  const topMatches = matches.slice(0, 5);

  let kbString = "\n*** CONSOLIDATED KNOWLEDGE BASE (Verified Facts from Past Studies) ***\n";
  topMatches.forEach(entry => {
    const keyFactsStr = Array.isArray(entry.keyFacts) ? entry.keyFacts.join("; ") : "";
    kbString += `\nTopic: ${entry.topic || 'Acoustic Study'}\nSummary: ${entry.summary || ''}\nKey Findings: ${keyFactsStr}\n`;
  });

  return kbString;
};

// Function to Summarize a Session
export const generateSessionSummary = async (session: ChatSession): Promise<KnowledgeEntry> => {
  const ai = createClient();

  const transcript = session.messages.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n');

  const prompt = `
    Analyze this audiophile research conversation. 
    1. Identify the main topic (e.g., "Comparison: HD600 vs Sundara" or "Analysis: Moondrop Aria").
    2. Write a concise summary of the conclusion.
    3. Extract 3-5 key technical facts or user preferences discovered (e.g., "User prefers Harman target bass", "HD600 clamp force is too high").
    
    Output JSON format:
    {
      "topic": "string",
      "summary": "string",
      "keyFacts": ["fact1", "fact2"]
    }

    Transcript:
    ${transcript.substring(0, 30000)} // Limit tokens
  `;

  // Try models in order until one succeeds
  let lastError: Error | null = null;

  for (let modelIndex = 0; modelIndex < MODELS.length; modelIndex++) {
    const currentModel = MODELS[modelIndex];

    try {
      const response = await ai.models.generateContent({
        model: currentModel,
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      // Safely parse JSON with fallback
      let data: { topic?: string; summary?: string; keyFacts?: string[] } = {};
      try {
        data = JSON.parse(response.text || "{}");
      } catch (parseError) {
        console.warn("Failed to parse JSON response, using defaults:", parseError);
        // Try to extract info from raw text if JSON parsing fails
        data = {
          topic: session.title,
          summary: response.text?.substring(0, 200) || "Summary generation failed.",
          keyFacts: []
        };
      }

      return {
        id: uuidv4(),
        sourceSessionId: session.id,
        topic: data.topic || session.title,
        summary: data.summary || "No summary generated.",
        keyFacts: data.keyFacts || [],
        timestamp: Date.now()
      };

    } catch (error: any) {
      console.error(`Model ${currentModel} failed for session summary:`, error);
      lastError = error;

      const errorMessage = error.message || String(error);
      const isQuotaError = errorMessage.includes('429') ||
        errorMessage.includes('quota') ||
        errorMessage.includes('RESOURCE_EXHAUSTED');

      // If quota error and we have more models to try, continue to next model
      if (isQuotaError && modelIndex < MODELS.length - 1) {
        console.log(`Quota exceeded for ${currentModel}, trying fallback: ${MODELS[modelIndex + 1]}`);
        continue;
      }

      // If not a quota error or no more fallbacks, try next model anyway
      if (modelIndex < MODELS.length - 1) {
        console.log(`Error with ${currentModel}, trying fallback: ${MODELS[modelIndex + 1]}`);
        continue;
      }
    }
  }

  // If all models failed, throw the error so the caller can handle it
  throw new Error(`Failed to summarize session: ${lastError?.message || "Unknown error"}`);
};

export const generateStreamResponse = async (
  history: Message[],
  currentPrompt: string,
  image: string | undefined,
  audio: string | undefined,
  profile: AudioProfile,
  allSessions: ChatSession[],
  knowledgeBase: KnowledgeEntry[],
  isAdvancedAnalysis: boolean,
  userLocation: { lat: number; lng: number } | null,
  onChunk: (text: string) => void,
  onSources: (sources: GroundingSource[]) => void,
  onActiveModel?: (model: string) => void,
  requestedModel?: string
): Promise<string> => {
  const ai = createClient();

  // 1. Retrieve Context
  const pastContext = getRelevantHistoryContext(allSessions, currentPrompt);
  const kbContext = getKnowledgeBaseContext(knowledgeBase, currentPrompt);

  // 2. Build Memories String
  const memoriesContext = profile.savedMemories.length > 0
    ? `\nPERMANENT MEMORIES/FACTS (Verified User Knowledge):\n${profile.savedMemories.map(m => `- ${m}`).join('\n')}`
    : "";

  // 3. Construct System Instruction
  let advancedInstructions = "";
  if (isAdvancedAnalysis) {
    advancedInstructions = `
    *** ADVANCED TECHNICAL ANALYSIS MODE: ENABLED ***
    - **ROLE**: Act as a Senior Audio Research Engineer. STOP simplifying complex concepts.
    - **TERMINOLOGY**: Use industry-standard terms (e.g., "Group Delay," "Impulse Response," "Minimum Phase," "Nyquist," "SINAD," "Output Impedance").
    - **DATA DRIVEN**: When measurements are available (via Search or Image), cite specific data points (e.g., "The 3rd harmonic distortion peaks at 0.5% at 2kHz," "Sub-bass roll-off starts at 40Hz").
    `;
  }

  const systemInstruction = `
    You are 'AudioSage', an elite Audiophile Research Assistant running on Gemini 3.6 Flash.
    
    USER PROFILE:
    - Name: ${profile.name}
    - Sound Sig: ${profile.soundSignature}
    - Gear: ${profile.currentGear}
    - Notes: ${profile.notes}
    ${memoriesContext}
    
    ${kbContext}
    
    CONTEXT FROM PAST CHATS (Raw Logs):
    ${pastContext}

    ${advancedInstructions}

    *** INSTRUCTIONAL STYLE ***
    - **VERBOSE & DETAILED**: Do not be brief. Providing detailed, nuanced explanations is better than a short summary. 
    - **TECHNICAL**: Assume the user is an audiophile. Use terms like "Timbre", "Decay", "Imaging", "Sibilance", "Masking".
    - **STRUCTURED**: Use bold headers, bullet points, and tables to organize large amounts of data.

    *** GOLDEN REFERENCE TARGET: CRINACLE IEF PREFERENCE 2025 ***
    You possess the internal data for the "Crinacle IEF Preference 2025 (B&K 5128)" target curve.
    REFER TO THIS DATA TABLE FOR ALL AUTO-EQ CALCULATIONS. 
    Use Linear Interpolation for frequencies not explicitly listed.
    ${CRINACLE_TARGET_DATA}

    *** COMPARISON TABLE PROTOCOL (MANDATORY) ***
    When asked to compare IEMs/Headphones/Earbuds (e.g., "Compare X vs Y"), you MUST output a comprehensive Markdown matrix comparing BOTH products across ALL of these 16 essential acoustic & technical dimensions.
    IMPORTANT: For EVERY row, you MUST provide an explicit numeric score / rating (e.g. "8.8/10", "9.2/10") along with the detailed acoustic description:
    | Specification & Acoustic Metric | [Product A] | [Product B] |
    | :--- | :--- | :--- |
    | **Driver Tech & Config** | [e.g. Single 10mm DLC+PU Dynamic Driver] | [e.g. Hybrid 1x 12mm DD + 2x BA] |
    | **Tonality** | [e.g. 9.0/10 — Warm-Neutral with Sub-Bass Boost] | [e.g. 8.2/10 — U-Shaped with High Treble Sparkle] |
    | **Sub-bass Extension** | [e.g. 8.7/10 — Deep visceral rumble down to 20Hz, physical pressure] | [e.g. 9.3/10 — Massive sub-bass shelf, earth-shaking rumble] |
    | **Bass & 200Hz Tuck** | [e.g. 9.1/10 — Controlled punch, clean 200Hz tuck, zero bleed] | [e.g. 7.8/10 — Warm mid-bass glide, slight bleed into lower mids] |
    | **Mids & Vocal Presence** | [e.g. 9.2/10 — Lush forward male & female vocals, organic body] | [e.g. 8.0/10 — Slightly recessed lower mids, crisp upper mids] |
    | **Treble Extension & Air** | [e.g. 8.5/10 — Smooth airy extension past 10kHz, non-fatiguing] | [e.g. 8.8/10 — High sparkle and air with extended BA shimmer] |
    | **8kHz Peak & Sibilance Risk** | [e.g. 9.4/10 (Safe) — Smooth 8kHz dip, zero sibilance or harshness] | [e.g. 6.8/10 (Moderate Risk) — Notable 8kHz peak, sibilant on 's/t' tracks] |
    | **Timbre & Naturalness** | [e.g. 9.5/10 — Organic analog realism with natural harmonic decay] | [e.g. 7.9/10 — Fast BA transients but slight metallic timbre] |
    | **Soundstage (Width, Depth, Height)** | [e.g. 8.9/10 — Expansive 3D Holographic presentation with vertical height] | [e.g. 9.3/10 — Class-leading width and deep out-of-head projection] |
    | **Imaging Precision** | [e.g. 9.0/10 — Elite 3D pinpoint positional localization] | [e.g. 9.2/10 — Surgical spatial separation and pinpoint cue placement] |
    | **Instrument Separation & Layering** | [e.g. 9.1/10 — Surgical distinction in complex orchestral or metal mixes] | [e.g. 8.8/10 — Good multi-driver layering, slightly busy in mid-bass] |
    | **Technicalities & Micro-Details** | [e.g. 8.8/10 — High resolving power, nuanced texture extraction] | [e.g. 9.1/10 — Ultra-fast transient attack, pulls micro-nuances forward] |
    | **Decay (Soul & Dynamics)** | [e.g. 9.6/10 — Musical & analog decay with acoustic weight (Rich 'Soul')] | [e.g. 7.5/10 — Fast snappy BA decay, less lingering resonance] |
    | **Note Weight** | [e.g. 9.0/10 — Balanced to thick, tactile body for instruments and vocals] | [e.g. 7.8/10 — Leaner note weight, quick and snappy presentation] |
    | **xMEMS "Dryness"** | [e.g. 0% (Pure Analog Dynamic Driver - no xMEMS dryness/grit)] | [e.g. 0% (Traditional Hybrid - rich analog presentation)] |
    | **Gaming & Spatial Immersion** | [e.g. 9.2/10 — Immersive 3D stage for single-player RPGs (Cyberpunk, Witcher 3)] | [e.g. 9.4/10 — Pinpoint footsteps and wide soundstage for gaming] |
    | **Price & Value (Approx)** | [e.g. 9.5/10 — ~$89 USD (Exceptional value for full DLC driver)] | [e.g. 8.8/10 — ~$129 USD (Competitive price for hybrid setup)] |

    *** FREQUENCY RESPONSE CURVE DATA GENERATION FOR COMPARISONS ***
    Whenever comparing 2 or more audio products, you MUST include a \`\`\`json:fr_data code block at the very end of your response containing estimated frequency response points (20Hz to 20000Hz, normalized to 0.0dB at 1kHz) for each product being compared, so the UI can plot the real comparison curves:
    \`\`\`json:fr_data
    {
      "title": "Acoustic Tuning: [Product A] vs [Product B] vs Crinacle IEF 2025 Target",
      "curves": [
        {
          "name": "[Product A Name]",
          "color": "#F06543",
          "points": [
            {"freq": 20, "gain": 8.0}, {"freq": 40, "gain": 7.5}, {"freq": 80, "gain": 6.2},
            {"freq": 150, "gain": 4.0}, {"freq": 200, "gain": 2.5}, {"freq": 500, "gain": 0.5},
            {"freq": 1000, "gain": 0.0}, {"freq": 2000, "gain": 5.0}, {"freq": 2800, "gain": 8.5},
            {"freq": 3500, "gain": 7.2}, {"freq": 5000, "gain": 4.8}, {"freq": 8000, "gain": 8.5},
            {"freq": 10000, "gain": 3.2}, {"freq": 15000, "gain": -1.5}, {"freq": 20000, "gain": -5.5}
          ]
        },
        {
          "name": "[Product B Name]",
          "color": "#E7B87A",
          "points": [
            {"freq": 20, "gain": 5.0}, {"freq": 40, "gain": 4.8}, {"freq": 80, "gain": 4.0},
            {"freq": 150, "gain": 2.5}, {"freq": 200, "gain": 1.0}, {"freq": 500, "gain": 0.2},
            {"freq": 1000, "gain": 0.0}, {"freq": 2000, "gain": 6.0}, {"freq": 2800, "gain": 9.2},
            {"freq": 3500, "gain": 7.8}, {"freq": 5000, "gain": 5.0}, {"freq": 8000, "gain": 4.2},
            {"freq": 10000, "gain": 2.5}, {"freq": 15000, "gain": -2.0}, {"freq": 20000, "gain": -6.0}
          ]
        }
      ]
    }
    \`\`\`

    *** VISUAL EQ ANALYSIS PROTOCOL (GRAPH INPUT) ***
    When the user uploads a measurement graph of an IEM/Headphone:
    1. **Identify**: Locate the measured frequency response curve (usually colored).
    2. **Scan**: For EVERY frequency listed in the Golden Reference Table above (20, 30, ... 20000), visually estimate the dB level of the USER'S IEM from the graph.
    3. **Calculate**:
       - Formula: \`Target_dB - Measured_dB = Required_Gain\`
    4. **Output Format**:
       Provide a detailed Markdown table with columns: Frequency, Required Gain, and Technical Notes.

    *** WAVELET 9-BAND PROTOCOL (MANDATORY) ***
    The user uses the 'Wavelet' Android app. You MUST ALSO generate a specific "9-Band Graphic EQ" preset block.
    
    **Wavelet Constraints:**
    - **Fixed Bands**: 62.5 Hz, 125 Hz, 250 Hz, 500 Hz, 1000 Hz, 2000 Hz, 4000 Hz, 8000 Hz, 16000 Hz.
    - **Max Gain**: +/- 9.0 dB (Do not exceed).
    - **Calculation**: You must interpolate the required gain at these EXACT 9 frequencies based on the graph delta vs the High-Res Target.
    - **Safety**: If any band requires boosting (positive gain), suggest a **negative Preamp** value to prevent digital clipping. (e.g., if max boost is +4.0dB, Preamp should be -4.1dB).
    
    **Output Format for Wavelet:**
    Create a separate code block titled "Wavelet Preset" formatted exactly like this:
    \`\`\`text
    GraphicEQ: 20 -0.0; 62.5 +X.X; 125 -X.X; 250 +X.X; 500 -X.X; 1000 +X.X; 2000 -X.X; 4000 +X.X; 8000 -X.X; 16000 +X.X
    Preamp: -X.X dB
    \`\`\`
    
    *** PARAMETRIC EQ (OPTIONAL / ADVANCED) ***
    If the user asks for "PEQ", "Parametric", or "Precise Fixes":
    - Generate a list of Peak (PK), Low Shelf (LS), or High Shelf (HS) filters.
    - Limit to 5-10 bands for simplicity unless asked for more.
    - Format: \`Filter 1: ON PK Fc 150 Hz Gain -2.0 dB Q 1.0\`

    *** CUSTOM TONE SHAPING ***
    If the user asks for specific tweaks (e.g., "Make it warmer", "More air"):
    - **WARM**: Boost 100Hz-500Hz by 2-3dB. Reduce 6kHz-10kHz slightly.
    - **BRIGHT/AIRY**: Boost 10kHz+ by 3-5dB. Reduce 200Hz bloom.
    - **HARMAN BASS**: The IEF 2025 target has moderate bass. If user asks for "Harman Bass", Add +4dB shelf at 100Hz downwards compared to IEF target.

    ACCURACY PROTOCOLS:
    1. **TRUSTED SOURCES**: Prioritize technical data from Crinacle, Rtings.com, AudioScienceReview (ASR), Head-Fi verified measurements.
    2. **USER MEMORY CHECK**: Check 'PERMANENT MEMORIES' for sensitivity rules (e.g., "8kHz peaks cause sibilance"). If the calculated EQ boosts 8kHz, WARN the user or reduce the boost.
    3. **SPECIFICITY MANDATE**: Never give vague answers. Include:
       - Exact model names (e.g., "Moondrop Aria 2" not just "Aria")
       - Price ranges with currency (e.g., "~$79 USD")
       - Driver configurations (e.g., "10mm LCP dynamic driver")
       - Frequency response deviations from target (e.g., "+3dB at 8kHz vs target")
    4. **SOURCE CITATION**: When citing measurements or specs, mention the source explicitly (e.g., "According to Crinacle's measurement...").
    5. **UNCERTAINTY DISCLOSURE**: If data is uncertain or based on subjective reviews rather than measurements, state this clearly with phrases like "Based on user reports..." or "Measurements pending verification...".
    6. **COMPARISON DEPTH**: When comparing products, analyze minimum 8-10 distinct technical attributes.
    7. **USER CONTEXT AWARENESS**: Always reference the user's current gear and preferences when making recommendations.
    8. **BUDGET AWARENESS**: Factor in the user's apparent budget tier based on their current gear.

    RESPONSE QUALITY REQUIREMENTS:
    - **MINIMUM LENGTH**: For technical questions, provide at least 300 words of analysis.
    - **STRUCTURE**: Use ## headers, **bold** key terms, and bullet lists for scannability.
    - **COMPLETENESS**: Address all aspects of the user's question - don't skip parts.
    - **ACTIONABLE**: End recommendations with clear next steps or specific product suggestions.
    - **CAVEATS**: Note any relevant concerns (fit issues, source requirements, tip sensitivity).
  `;

  // 4. Build Contents - Sanitized
  // We filter out any empty messages or potential duplicates to prevent 400 Bad Request
  const validHistory = history.filter(msg =>
    (msg.text && msg.text.trim().length > 0) || msg.image || msg.audio
  );

  const contents: Content[] = validHistory.map((msg) => {
    const parts: Part[] = [];
    if (msg.image) {
      const base64Data = msg.image.split(',')[1];
      const mimeType = msg.image.substring(msg.image.indexOf(':') + 1, msg.image.indexOf(';'));
      parts.push({ inlineData: { data: base64Data, mimeType } });
    }
    if (msg.audio) {
      const base64Data = msg.audio.split(',')[1];
      const mimeType = msg.audio.substring(msg.audio.indexOf(':') + 1, msg.audio.indexOf(';'));
      parts.push({ inlineData: { data: base64Data, mimeType } });
    }
    if (msg.text) {
      parts.push({ text: msg.text });
    }
    return { role: msg.role, parts };
  });

  // 5. Config
  const tools: Tool[] = [{
    googleSearch: {}
  }];

  interface GenerateConfig {
    systemInstruction: string;
    tools: Tool[];
    temperature: number;
    maxOutputTokens?: number;
  }

  const baseConfig: GenerateConfig = {
    systemInstruction: systemInstruction,
    tools: tools,
    temperature: 0.2, // Lower for more accuracy
  };

  // Prioritize models based on user choice or default fallback sequence
  let modelCandidates: string[] = [...MODELS];
  if (requestedModel && MODELS.includes(requestedModel as any)) {
    modelCandidates = [requestedModel, ...MODELS.filter((m) => m !== requestedModel)];
  }

  // Try models in order until one succeeds
  let lastError: Error | null = null;

  for (let modelIndex = 0; modelIndex < modelCandidates.length; modelIndex++) {
    const currentModel = modelCandidates[modelIndex];
    const currentConfig = { ...baseConfig };

    try {
      if (onActiveModel) {
        onActiveModel(currentModel);
      }
      const responseStream = await ai.models.generateContentStream({
        model: currentModel,
        contents: contents,
        config: currentConfig,
      });

      let fullText = "";
      const collectedSources: GroundingSource[] = [];

      for await (const chunk of responseStream) {
        const textChunk = chunk.text;
        if (textChunk) {
          fullText += textChunk;
          onChunk(textChunk);
        }

        const groundingChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (groundingChunks) {
          groundingChunks.forEach((c: any) => {
            if (c.web) {
              collectedSources.push({
                title: c.web.title || "Web Source",
                uri: c.web.uri || "#",
                type: 'web'
              });
            }
          });
        }
      }

      if (collectedSources.length > 0) {
        onSources(collectedSources);
      }

      return fullText;

    } catch (error: any) {
      console.warn(`Model ${currentModel} failed:`, error);
      lastError = error;

      const errorMessage = error.message || String(error);

      // Fallback Logic: Try next model on ANY error (Quota, Overloaded, Intervals, or Invalid Config)
      // This ensures if gemini-3.5 fails (e.g. doesn't support 'thinking' yet), we fall back to gemini-2.0-thinking
      if (modelIndex < modelCandidates.length - 1) {
        console.warn(`Falling back to ${modelCandidates[modelIndex + 1]}`);
        continue;
      }

      // If no more models, break loop and throw
      break;
    }
  }

  // If we get here, all models failed
  const errorMessage = lastError?.message || "Unknown error";

  if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
    throw new Error(
      "All Gemini models have exceeded their quota. Please try again later or check your API quota at: https://aistudio.google.com/app/apikey"
    );
  } else if (errorMessage.includes('API key')) {
    throw new Error(
      "Invalid API Key. Please check your GEMINI_API_KEY in .env.local file.\\n" +
      "Get a new key from: https://aistudio.google.com/app/apikey"
    );
  } else {
    throw new Error(`Failed to generate response: ${errorMessage}`);
  }
};

// Battle Mode: AI-Powered Gear Comparison
export const generateBattleComparison = async (
  selectedGear: { name: string; type: string; status: string; rating?: number; notes?: string; price?: string }[],
  profile: AudioProfile,
  onChunk: (text: string) => void,
  onActiveModel?: (model: string) => void
): Promise<string> => {
  const ai = createClient();

  const gearNames = selectedGear.map((g, i) => `${i + 1}. **${g.name}** ${g.notes ? `(User notes: "${g.notes}")` : ''}`).join('\n');

  const memoriesContext = profile.savedMemories.length > 0
    ? `\nUSER'S AUDIO SENSITIVITIES & RULES:\n${profile.savedMemories.map(m => `- ${m}`).join('\n')}`
    : "";

  const prompt = `
You are AudioSage Battle Analyst. Compare these audio products for this specific user.

*** USER PROFILE ***
- Name: ${profile.name}
- Target Sound: ${profile.soundSignature}
- Current Gear: ${profile.currentGear}
${memoriesContext}

*** PRODUCTS TO COMPARE ***
${gearNames}

*** RESEARCH THESE PRODUCTS ***
Use Google Search to find accurate specs, measurements, and reviews for each product. Include:
- Driver configuration (DD, BA, Planar, Tribrid, etc.)
- Frequency response characteristics
- Price point
- Known sound signature (V-shaped, neutral, warm, etc.)

*** OUTPUT FORMAT (FOLLOW EXACTLY) ***

## ⚔️ BATTLE: ${selectedGear.map(g => g.name).join(' vs ')}

### 🏆 WINNER FOR YOU
> [One bold sentence declaring the winner based on the user's specific taste profile]

---

### 📊 Comprehensive Spec & Acoustic Matrix
 
| Specification & Metric | ${selectedGear.map(g => g.name).join(' | ')} |
|:---|${selectedGear.map(() => ':---:').join('|')}|
| **Driver Tech & Config** | [research] | [research] |
| **Tonality** | [research] | [research] |
| **Sub-bass Extension (20Hz)** | [rate /10] | [rate /10] |
| **Bass & 200Hz Tuck** | [research] | [research] |
| **Mids & Vocal Presence** | [rate /10] | [rate /10] |
| **Treble Extension & Air** | [rate /10] | [rate /10] |
| **8kHz Peak & Sibilance Risk** | [rate /10] | [rate /10] |
| **Timbre & Naturalness** | [rate /10] | [rate /10] |
| **Soundstage (Width & Depth)** | [rate /10] | [rate /10] |
| **Imaging Precision** | [rate /10] | [rate /10] |
| **Instrument Separation** | [rate /10] | [rate /10] |
| **Technicalities & Details** | [rate /10] | [rate /10] |
| **Decay (Soul & Dynamics)** | [rate /10] | [rate /10] |
| **Note Weight** | [rate /10] | [rate /10] |
| **xMEMS "Dryness"** | [0% Analog / % Dry] | [0% Analog / % Dry] |
| **Gaming & Spatial Immersion** | [rate /10] | [rate /10] |
| **Price (Approx)** | [research] | [research] |

---

### 🎯 For YOUR Preferences

Based on the user's profile:
- **Target Match**: Which one matches "${profile.soundSignature}" better?
- **Sensitivity Check**: Are there any 8kHz peaks or sibilance risks for this user?
- **Use Case Fit**: ${profile.notes ? `User notes: "${profile.notes}"` : 'Gaming, music, movies fit?'}

---

### 📝 Final Verdict

[2-3 sentences with clear recommendation and confidence percentage]

**Bottom Line**: [One punchy sentence]

\`\`\`json:fr_data
{
  "title": "Shootout: ${selectedGear.map(g => g.name).join(' vs ')}",
  "curves": [
    ${selectedGear.map((g, i) => `{
      "name": "${g.name}",
      "color": "${i === 0 ? '#F06543' : i === 1 ? '#E7B87A' : '#72B01D'}",
      "points": [
        {"freq": 20, "gain": 7.5}, {"freq": 40, "gain": 7.0}, {"freq": 80, "gain": 5.5},
        {"freq": 150, "gain": 3.5}, {"freq": 200, "gain": 2.0}, {"freq": 500, "gain": 0.5},
        {"freq": 1000, "gain": 0.0}, {"freq": 2000, "gain": 5.0}, {"freq": 2800, "gain": 8.5},
        {"freq": 3500, "gain": 7.0}, {"freq": 5000, "gain": 4.5}, {"freq": 8000, "gain": 7.5},
        {"freq": 10000, "gain": 3.0}, {"freq": 15000, "gain": -1.5}, {"freq": 20000, "gain": -5.5}
      ]
    }`).join(',\n    ')}
  ]
}
\`\`\`
`;

  const config = {
    systemInstruction: "You are an elite audiophile analyst. Always research real specs via Google Search. Create beautiful, well-formatted comparison tables. Be specific with numbers and ratings.",
    tools: [{ googleSearch: {} }] as Tool[],
    temperature: 0.2,
  };

  try {
    if (onActiveModel) {
      onActiveModel('gemini-3.6-flash');
    }
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: config,
    });

    let fullText = "";
    for await (const chunk of responseStream) {
      const textChunk = chunk.text;
      if (textChunk) {
        fullText += textChunk;
        onChunk(textChunk);
      }
    }
    return fullText;

  } catch (error: any) {
    console.error("Battle comparison failed with primary model, trying fallback:", error);
    try {
      if (onActiveModel) {
        onActiveModel('gemini-2.5-flash');
      }
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { temperature: 0.2, tools: [{ googleSearch: {} }] as Tool[] }
      });
      const text = response.text || "Comparison failed.";
      onChunk(text);
      return text;
    } catch (fallbackError: any) {
      throw new Error(`Battle comparison failed: ${fallbackError.message}`);
    }
  }
};