export interface GroundingSource {
  title: string;
  uri: string;
  type?: 'web' | 'map';
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  image?: string; // Base64 Data URL
  audio?: string; // Base64 Audio URL
  groundingSources?: GroundingSource[];
  isThinking?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  isSummarized?: boolean; // Track if this has been added to knowledge base
  isStarred?: boolean; // Pin important sessions to top
}

export interface KnowledgeEntry {
  id: string;
  sourceSessionId: string;
  topic: string;
  summary: string;
  keyFacts: string[];
  timestamp: number;
}

export interface EQPreset {
  id: string;
  name: string;
  hardware: string; // The IEM/Headphone name
  type: 'Wavelet' | 'Parametric' | 'Other';
  bands: string; // Text representation of bands/values
  timestamp: number;
}

export interface GearItem {
  id: string;
  name: string; // e.g. "Moondrop Aria 2"
  type: 'IEM' | 'Headphone' | 'DAC' | 'AMP' | 'Other';
  status: 'owned' | 'wishlist' | 'tried';
  rating?: number; // 1-5 stars
  notes?: string;
  price?: string;
  addedAt: number;
}

export interface AudioProfile {
  name: string;
  soundSignature: string;
  preferredGenres: string;
  currentGear: string;
  notes: string;
  technicalPrefs: string; // Soundstage, imaging, separation details
  savedMemories: string[];
  eqLibrary: EQPreset[];
  gearLibrary: GearItem[]; // Favorites/wishlist tracking
}

export const DEFAULT_PROFILE: AudioProfile = {
  name: "Phoenix User",
  soundSignature: "Strict adherence to Crinacle IEF Preference 2025 Target. Detailed, holographic, with sub-bass extension.",
  preferredGenres: "Pop, Vocal-focused, Electronic, Chill/Vibe, OSTs. Likes 'Deep thinking' music.",
  currentGear: "CCA Phoenix (Main), SoundPEATS Capsule 3 Pro+ (Commute), JCally JM6 Pro (DAC)",
  notes: "Prioritizes immersive soundstage (Dolby Atmos feel) for movies and gaming. Loves musicality. Uses two EQ presets on Phoenix - one for chill, one for vocals. Incoming: JCally JM6 Pro DAC.",
  technicalPrefs: "Prioritizes: Wide holographic soundstage, precise 3D imaging, natural decay (avoids xMEMS). Sensitive to 8kHz sibilance and mid-bass bloat. Prefers wide-bore silicone tips for maximum soundstage.",
  savedMemories: [
    "TARGET CURVE: Crinacle IEF Preference 2025 (B&K 5128).",
    "SENSITIVITY: 8kHz peaks cause sibilance.",
    "SENSITIVITY: Dislikes excessive mid-bass bloat (prefer tuck at 200Hz).",
    "SENSITIVITY: HATES 'Zero Decay' from xMEMS - sounds rough/dry.",
    "PRIORITY: Natural Decay (must have 'soul').",
    "PRIORITY: Holographic Imaging (3D positioning).",
    "PRIORITY: Wide Soundstage (Dolby Atmos feel).",
    "USE CASE: Gaming: Offline single-player titles (Cyberpunk 2077, RDR2, Witcher 3). Immersive, NOT competitive.",
    "EQ PRESET 'Phoenix Chill': Darker, bass boosted, reduced 4kHz (shout) and 8kHz (sibilance).",
    "EQ PRESET 'Phoenix Vocal': Vocals boosted/forward, treble/8kHz reduced.",
    "TIP PREFERENCE: Wide-Bore Silicone tips - maximizes soundstage.",
    "HISTORY: CCA Phoenix - Best imaging and details owned.",
    "HISTORY: SoundPEATS Capsule 3 Pro+ - HATES xMEMS roughness.",
    "UPGRADE TARGET: Simgot EW300 - Tribrid, Soundstage Monster (Top Pick).",
    "UPGRADE TARGET: Simgot EG280 (Gaming Pick)."
  ],
  eqLibrary: [],
  gearLibrary: []
};