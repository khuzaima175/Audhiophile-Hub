import { GoogleGenAI } from '@google/genai';
export const AI_MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite' },
] as const;
export const MODEL_IDS = AI_MODELS.map(m => m.id);
export function resolveApiKey() {
  let browser = '';
  try { browser = typeof window !== 'undefined' ? localStorage.getItem('audiosage_api_key')?.trim() || '' : ''; } catch {}
  const gemini = typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : undefined;
  const vite = import.meta.env?.VITE_GEMINI_API_KEY;
  return browser ? { key: browser, source: 'Browser personal key' } : gemini ? { key: gemini, source: 'GEMINI_API_KEY (local development)' } : vite ? { key: vite, source: 'VITE_GEMINI_API_KEY (local development)' } : { key: '', source: 'Not configured' };
}
export function classifyAiError(error: unknown): 'credential' | 'model' | 'quota' | 'network' | 'request' {
  const s = String((error as Error)?.message || error).toLowerCase();
  if (/401|403|api.key|unauthenticated|permission_denied/.test(s)) return 'credential';
  if (/429|quota|resource_exhausted/.test(s)) return 'quota';
  if (/404|not.found|not supported|unavailable model/.test(s)) return 'model';
  if (/fetch|network|offline|503|unavailable/.test(s)) return 'network';
  return 'request';
}
export function createAiClient() {
  const { key } = resolveApiKey();
  if (!key) throw new Error('API key missing. Add your personal Gemini key in Settings & data.');
  return new GoogleGenAI({ apiKey: key });
}
export async function testAiConnection(model = MODEL_IDS[0]) {
  const { source } = resolveApiKey();
  try {
    const ai = createAiClient();
    // Test the exact streaming + grounding request capability used by research.
    const stream = await ai.models.generateContentStream({ model, contents: 'Reply with OK.', config: { tools: [{ googleSearch: {} }], maxOutputTokens: 64 } });
    let received = false;
    for await (const chunk of stream) if (chunk.text) received = true;
    if (!received) throw new Error('Request returned no text');
    return { ok: true, message: `${source}: verified streaming and grounding request for ${model}.` };
  } catch (e) { return { ok: false, message: `${source}: failed (${classifyAiError(e)}). Check your key, selected model, quota, and connection.` }; }
}
