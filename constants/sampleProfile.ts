import { AudioProfile } from '../types';

/**
 * Sample reference profile for audiophiles who want to explore AudioSage
 * with rich seed gear, notes, and PEQ/Wavelet presets.
 *
 * This was originally the default profile and has been preserved here so
 * first-time users can opt into loading it without polluting a clean slate.
 */
export const SAMPLE_AUDIOPHILE_PROFILE: AudioProfile = {
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
