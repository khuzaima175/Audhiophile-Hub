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

export type PEQFilterType = 'PK' | 'LS' | 'HS' | 'HP' | 'LP' | 'NOTCH';

export interface PEQFilter {
  id: string;
  type: PEQFilterType;
  freq: number;
  gain: number;
  q: number;
  enabled?: boolean;
}

export interface EQPreset {
  id: string;
  name: string;
  hardware: string; // The IEM/Headphone name
  type: 'Wavelet' | 'Parametric' | 'Other';
  mode?: '10-band' | '15-band' | '31-band' | 'peq';
  bands: string; // Text representation of bands/values
  graphicGains?: number[]; // Array of slider gains
  peqFilters?: PEQFilter[]; // Parametric filters
  targetCurveId?: string; // Target reference ID
  preamp?: number; // Preamp attenuation in dB
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
  faderState?: {
    bassGain: number;
    sibilanceGain: number;
    airGain: number;
  };
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
  eqLibrary: [
    {
      id: 'kefine-delci-ae-golden-nozzle',
      name: 'Kefine Delci AE — Golden Nozzle',
      hardware: 'Kefine Delci AE',
      type: 'Wavelet',
      mode: '31-band',
      bands: 'GraphicEQ: 20 -4.9; 25 -4.7; 31.5 -3.7; 40 -3.3; 50 -3.1; 63 -3.1; 80 -3.1; 100 -3.2; 125 -3.5; 160 -3.2; 200 -2.6; 250 -2.0; 315 -1.1; 400 -0.3; 500 0.0; 630 -0.6; 800 -1.4; 1000 -2.0; 1250 -2.5; 1600 -3.0; 2000 -3.4; 2500 -2.4; 3150 -0.6; 4000 -2.3; 5000 -5.8; 6300 -6.9; 8000 -4.0; 10000 -3.4; 12500 -3.1; 16000 -3.0; 20000 -3.0',
      graphicGains: [-4.9, -4.7, -3.7, -3.3, -3.1, -3.1, -3.1, -3.2, -3.5, -3.2, -2.6, -2.0, -1.1, -0.3, 0.0, -0.6, -1.4, -2.0, -2.5, -3.0, -3.4, -2.4, -0.6, -2.3, -5.8, -6.9, -4.0, -3.4, -3.1, -3.0, -3.0],
      targetCurveId: 'crinacle-ief-2025',
      preamp: 0,
      timestamp: 1754600000000,
    },
    {
      id: 'kefine-delci-ae-signature-nozzle',
      name: 'Kefine Delci AE — Signature Nozzle',
      hardware: 'Kefine Delci AE',
      type: 'Wavelet',
      mode: '31-band',
      bands: 'GraphicEQ: 20 -4.9; 25 -4.7; 31.5 -3.7; 40 -3.3; 50 -3.1; 63 -3.1; 80 -3.1; 100 -3.2; 125 -3.5; 160 -3.2; 200 -2.6; 250 -2.0; 315 -1.1; 400 -0.3; 500 0.0; 630 -0.6; 800 -1.4; 1000 -2.0; 1250 -2.5; 1600 -3.0; 2000 -3.4; 2500 -2.4; 3150 -0.6; 4000 -2.3; 5000 -5.8; 6300 -6.9; 8000 -4.0; 10000 -3.4; 12500 -3.1; 16000 -3.0; 20000 -3.0',
      graphicGains: [-4.9, -4.7, -3.7, -3.3, -3.1, -3.1, -3.1, -3.2, -3.5, -3.2, -2.6, -2.0, -1.1, -0.3, 0.0, -0.6, -1.4, -2.0, -2.5, -3.0, -3.4, -2.4, -0.6, -2.3, -5.8, -6.9, -4.0, -3.4, -3.1, -3.0, -3.0],
      targetCurveId: 'crinacle-ief-2025',
      preamp: 0,
      timestamp: 1754600001000,
    },
  ],
  gearLibrary: [],
  faderState: {
    bassGain: 0,
    sibilanceGain: -2,
    airGain: 1,
  },
};

export type SmoothingType = 'RAW' | '1/6 OCT' | '1/3 OCT';


export interface MeasurementPoint {
  freq: number;
  gain: number; // Normalized to 0dB at 1kHz (or user datum)
  rawSpl: number; // Original measured dB SPL
}

export interface MeasurementData {
  name: string;
  rawPoints: MeasurementPoint[];
  smoothedPoints: MeasurementPoint[];
  normOffset: number; // dB subtracted at 1kHz datum
  sampleCount: number;
  smoothing: SmoothingType;
  headerComments?: string[];
}

export interface AutoPeqFitOptions {
  maxFilters: number; // 5 to 20 filters
  targetCurveId: string;
  minGain?: number; // default -12 dB
  maxGain?: number; // default +12 dB
  smoothing?: SmoothingType;
}

export interface AutoPeqFitResult {
  filters: PEQFilter[];
  preamp: number;
  initialRms: number;
  finalRms: number;
  matchPercentage: number;
  correctedPoints: { freq: number; gain: number }[];
  residualPoints: { freq: number; gain: number }[];
}

export interface ApoBridgeStatus {
  connected: boolean;
  path: string;
  exists: boolean;
  hasManagedInclude: boolean;
  hasBackup: boolean;
  lastModified?: number;
  lastSyncedAt?: number;
  error?: string;
}

export interface ApoBridgeSyncResult {
  success: boolean;
  path: string;
  includePath: string;
  backupCreated: boolean;
  managedLineAdded: boolean;
  timestamp: number;
  error?: string;
}

export interface LiveTabTelemetry {
  isActive: boolean;
  latencyMs: number;
  streamTitle?: string;
  sampleRate?: number;
  audioTracks?: number;
}

export type LabZoomRange = 'full' | 'bass' | 'mids' | 'treble';

export type LabProvenanceType = 'measured' | 'target' | 'ai-estimate' | 'eq-compensated' | 'custom';

export interface LabCurve {
  id: string;
  name: string;
  color: string;
  points: CurvePoint[];
  provenance: LabProvenanceType;
  provenanceDetails?: string;
  pointsCount?: number;
  offset: number; // dB vertical adjustment (-12 to +12)
  visible: boolean;
  solo: boolean;
  isReference?: boolean;
  isTarget?: boolean;
  deltaCompensate?: boolean; // When true, subtracts from active target
}

export interface LabState {
  isOpen: boolean;
  curves: LabCurve[];
  targetCurveId: string; // e.g. 'crinacle-ief-2025' or 'none'
  normDb: number; // default 0.0 dB
  normHz: number; // default 1000 Hz
  zoomRange: LabZoomRange;
  smoothing: SmoothingType;
  deltaMode: boolean; // global DELTA mode: target flattens to 0dB, all curves show deviation
  primaryCurveId: string | null;
  auditionAId: string | null;
  auditionBId: string | null;
}