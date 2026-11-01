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
  requestedModel?: string;
  answeringModel?: string;
  contextSupplied?: { id: string; title: string; kind: string; revision: string; characters: number }[];
  isThinking?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  retrievalEnabled?: boolean;
  isSummarized?: boolean; // Track if this has been added to knowledge base
  isStarred?: boolean; // Pin important sessions to top
}

export interface KnowledgeEntry {
  enabled?: boolean;
  pinned?: boolean;
  provenance?: 'generated-summary' | 'user-note';
  sourceRevision?: string;
  id: string;
  sourceSessionId: string;
  topic: string;
  summary: string;
  keyFacts: string[];
  timestamp: number;
}

export interface CurvePoint {
  freq: number;
  gain: number;
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

export interface StereoFilters { left: PEQFilter[]; right: PEQFilter[]; }
export interface EQPreset {
  stereoFilters?: StereoFilters; eqChannel?: 'left'|'right';
  id: string;
  name: string;
  hardware: string; // The IEM/Headphone name
  type: 'Wavelet' | 'Parametric' | 'Other';
  mode?: '10-band' | '15-band' | '31-band' | 'peq';
  bands: string; // Text representation of bands/values
  graphicGains?: number[]; // Array of slider gains
  peqFilters?: PEQFilter[]; // Parametric filters
  targetCurveId?: string; // Target reference ID
  gearId?: string;
  targetMeasurementRef?: string;
  fitLimits?: AutoFitLimits;
  measurementRef?: string;
  requestedPreamp?: number;
  preampMode?: 'automatic' | 'manual';
  sampleRate?: number;
  analysis?: { smoothing: SmoothingType; normalize: boolean };
  preamp?: number; // Effective attenuation in dB
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
  name: "Listener",
  soundSignature: "",
  preferredGenres: "",
  currentGear: "",
  notes: "",
  technicalPrefs: "",
  savedMemories: [],
  eqLibrary: [],
  gearLibrary: [],
  faderState: {
    bassGain: 0,
    sibilanceGain: 0,
    airGain: 0,
  },
};

export type SmoothingType = 'RAW' | '1/48 OCT' | '1/24 OCT' | '1/12 OCT' | '1/6 OCT' | '1/3 OCT';


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
  channels?: { left: MeasurementPoint[]; right: MeasurementPoint[] };
  headerComments?: string[];
  isGraphicEQ?: boolean; // true when parsed from GraphicEQ/AutoEQ format
}

export interface GraphSettings {
  minFreq: number; maxFreq: number; yRange: [number, number] | null; inspect: boolean; showLabels: boolean;
}
export interface AutoFitLimits {
  minFreq: number; maxFreq: number; minGain: number; maxGain: number; minQ: number; maxQ: number;
  types: ('PK' | 'LS' | 'HS')[];
}
export interface AutoPeqFitOptions {
  sampleRate?: number;
  normalize?: boolean;
  maxFilters: number; // 5 to 20 filters
  targetCurveId: string;
  minFreq?: number;
  maxFreq?: number;
  minQ?: number;
  maxQ?: number;
  types?: ('PK' | 'LS' | 'HS')[];
  minGain?: number; // default -12 dB
  maxGain?: number; // default +12 dB
  smoothing?: SmoothingType;
}

export interface AutoPeqFitResult {
  settings?: AutoPeqFitOptions;
  evaluatedPoints?: number;
  support?: [number, number];
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

export type LabViewMode = 'reconstructed' | 'rawFilter' | 'netPostEq';

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
  isInverted?: boolean; // When true, inverts/reconstructs raw filter cuts into positive IEM response
  isFilterCurve?: boolean; // When true, this is a corrective filter (GraphicEQ/AutoEQ), not a raw IEM measurement
  preserveAbsolute?: boolean;
  pinned?: boolean;
  rig?: string;
  sourceUrl?: string;
  channels?: { left: CurvePoint[]; right: CurvePoint[] };
  channel?: 'average' | 'left' | 'right' | 'both';
  measurementRef?: string;
  sourceTargetId?: string; // The target curve ID this filter was designed for (locked at import time)
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
  graphSettings?: GraphSettings;
  fitLimits?: AutoFitLimits;
  baselineId?: string | null;
  normalizationMode?: 'frequency' | 'mean' | 'none';
  fitSmoothing?: SmoothingType;
  fitNormalize?: boolean;
  viewMode?: LabViewMode; // 'reconstructed' | 'rawFilter' | 'netPostEq'
  primaryCurveId: string | null;
  auditionAId: string | null;
  auditionBId: string | null;
}