import { PEQFilter } from '../types';
import { CurvePoint } from '../constants/targetCurves';

export interface ViewportDimensions {
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
  minY?: number;
  maxY?: number;
}

export const DEFAULT_VIEWPORT: ViewportDimensions = {
  width: 800,
  height: 280,
  padding: { top: 25, right: 25, bottom: 35, left: 50 },
  minY: -12,
  maxY: 18,
};

// Frequency Bounds: 20Hz to 20kHz
export const MIN_FREQ = 20;
export const MAX_FREQ = 20000;

// Default Pure-EQ dB Range
export const DEFAULT_MIN_DB = -12;
export const DEFAULT_MAX_DB = 18;

/**
 * Auto-range the Y axis whenever a target curve or deep PEQ filter is visible.
 * Fits min/max with +2dB headroom pad, aligned to 6 dB grid intervals.
 */
export const calculateAutoRangedYBounds = (
  curvePointSets: (CurvePoint[] | undefined)[],
  isTargetVisible = true
): { minY: number; maxY: number; yTicks: number[] } => {
  let minGain = isTargetVisible ? -12 : -12;
  let maxGain = isTargetVisible ? 12 : 12;

  let hasPoints = false;
  curvePointSets.forEach((pts) => {
    if (pts && pts.length > 0) {
      hasPoints = true;
      pts.forEach((p) => {
        if (p.gain < minGain) minGain = p.gain;
        if (p.gain > maxGain) maxGain = p.gain;
      });
    }
  });

  if (!hasPoints) {
    return { minY: -12, maxY: 18, yTicks: [-12, -6, 0, 6, 12, 18] };
  }

  // Add 2.0 dB pad
  const paddedMin = minGain - 2.0;
  const paddedMax = maxGain + 2.0;

  // Align to multiple of 6 dB
  const minY = Math.floor(paddedMin / 6) * 6;
  const maxY = Math.ceil(paddedMax / 6) * 6;

  // Generate 6dB interval ticks
  const yTicks: number[] = [];
  for (let val = minY; val <= maxY; val += 6) {
    yTicks.push(val);
  }

  return { minY, maxY, yTicks };
};

// Logarithmic Frequency to X coordinate
export const freqToX = (freq: number, viewport: ViewportDimensions = DEFAULT_VIEWPORT): number => {
  const { width, padding } = viewport;
  const graphWidth = width - padding.left - padding.right;
  const minLog = Math.log10(MIN_FREQ);
  const maxLog = Math.log10(MAX_FREQ);
  const freqLog = Math.log10(Math.max(MIN_FREQ, Math.min(MAX_FREQ, freq)));
  return padding.left + ((freqLog - minLog) / (maxLog - minLog)) * graphWidth;
};

// X coordinate to Logarithmic Frequency
export const xToFreq = (x: number, viewport: ViewportDimensions = DEFAULT_VIEWPORT): number => {
  const { width, padding } = viewport;
  const graphWidth = width - padding.left - padding.right;
  const minLog = Math.log10(MIN_FREQ);
  const maxLog = Math.log10(MAX_FREQ);
  const ratio = Math.max(0, Math.min(1, (x - padding.left) / graphWidth));
  const freqLog = minLog + ratio * (maxLog - minLog);
  return Math.round(Math.pow(10, freqLog));
};

// dB Gain to Y coordinate (Auto-Ranged aware)
export const dbToY = (
  db: number,
  viewport: ViewportDimensions = DEFAULT_VIEWPORT,
  customMinY?: number,
  customMaxY?: number
): number => {
  const { height, padding } = viewport;
  const graphHeight = height - padding.top - padding.bottom;
  const minY = customMinY !== undefined ? customMinY : (viewport.minY ?? DEFAULT_MIN_DB);
  const maxY = customMaxY !== undefined ? customMaxY : (viewport.maxY ?? DEFAULT_MAX_DB);
  const clampedDb = Math.max(minY, Math.min(maxY, db));
  return padding.top + graphHeight - ((clampedDb - minY) / (maxY - minY)) * graphHeight;
};

// Y coordinate to dB Gain (Auto-Ranged aware)
export const yToDb = (
  y: number,
  viewport: ViewportDimensions = DEFAULT_VIEWPORT,
  customMinY?: number,
  customMaxY?: number
): number => {
  const { height, padding } = viewport;
  const graphHeight = height - padding.top - padding.bottom;
  const minY = customMinY !== undefined ? customMinY : (viewport.minY ?? DEFAULT_MIN_DB);
  const maxY = customMaxY !== undefined ? customMaxY : (viewport.maxY ?? DEFAULT_MAX_DB);
  const ratio = 1 - (y - padding.top) / graphHeight;
  return parseFloat((minY + ratio * (maxY - minY)).toFixed(1));
};

// Calculate transfer function gain at frequency f for a single Peaking/Biquad filter
export const calculateFilterGainAtFreq = (
  f: number,
  type: string,
  fc: number,
  gain: number,
  q: number
): number => {
  if (gain === 0 && type !== 'HP' && type !== 'LP' && type !== 'NOTCH') return 0;
  const safeQ = Math.max(0.1, q || 1.41);
  const fRatio = f / fc;

  switch (type) {
    case 'PK': // Peaking Bell
    case 'peaking': {
      const bw = Math.abs(fRatio - 1 / fRatio) * safeQ;
      return gain / (1 + bw * bw);
    }
    case 'LS': // Low Shelf
    case 'lowshelf': {
      // 2nd order low shelf response approximation
      const denom = 1 + Math.pow(fRatio, 2);
      return gain / denom;
    }
    case 'HS': // High Shelf
    case 'highshelf': {
      const denom = 1 + Math.pow(1 / fRatio, 2);
      return gain / denom;
    }
    case 'HP': // High Pass (12dB/octave Butterworth)
    case 'highpass': {
      if (f >= fc * 4) return 0;
      const atten = -10 * Math.log10(1 + Math.pow(fc / f, 4));
      return Math.max(-36, atten);
    }
    case 'LP': // Low Pass (12dB/octave Butterworth)
    case 'lowpass': {
      if (f <= fc / 4) return 0;
      const atten = -10 * Math.log10(1 + Math.pow(f / fc, 4));
      return Math.max(-36, atten);
    }
    case 'NOTCH': // Band Stop
    case 'notch': {
      const bw = Math.abs(fRatio - 1 / fRatio) * safeQ;
      return -24 / (1 + bw * bw);
    }
    default:
      return 0;
  }
};

// Evaluate composite EQ curve (sum of all active graphic bands and parametric filters)
export const evaluateCompositeCurve = (
  frequencies: number[],
  isoBands: number[],
  isoGains: number[],
  peqFilters: PEQFilter[] = []
): CurvePoint[] => {
  return frequencies.map((f) => {
    let totalDb = 0;

    // Sum ISO graphic bands (modeled as Peaking bells with standard ISO Q)
    const isoQ = isoBands.length === 31 ? 4.3 : isoBands.length === 15 ? 2.0 : 1.41;
    for (let i = 0; i < isoBands.length; i++) {
      const gain = isoGains[i] || 0;
      if (gain !== 0) {
        totalDb += calculateFilterGainAtFreq(f, 'PK', isoBands[i], gain, isoQ);
      }
    }

    // Sum active Parametric EQ filters
    for (let i = 0; i < peqFilters.length; i++) {
      const filter = peqFilters[i];
      if (filter.enabled !== false && filter.gain !== undefined) {
        totalDb += calculateFilterGainAtFreq(f, filter.type, filter.freq, filter.gain, filter.q);
      }
    }

    return { freq: f, gain: parseFloat(totalDb.toFixed(2)) };
  });
};

// Generate SVG Path data string with dynamic Y Auto-Ranging
export const generateSvgPathFromPoints = (
  points: CurvePoint[],
  viewport: ViewportDimensions = DEFAULT_VIEWPORT,
  minY?: number,
  maxY?: number
): string => {
  if (!points || points.length === 0) return '';
  return points.reduce((acc, pt, i) => {
    const x = freqToX(pt.freq, viewport).toFixed(1);
    const y = dbToY(pt.gain, viewport, minY, maxY).toFixed(1);
    return `${acc} ${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }, '');
};

// Dense 180-point logarithmic frequency scale for ultra-smooth 60 FPS curve evaluation
export const SYNTHESIS_FREQUENCIES: number[] = (() => {
  const freqs: number[] = [];
  const minLog = Math.log10(MIN_FREQ);
  const maxLog = Math.log10(MAX_FREQ);
  const steps = 180;
  for (let i = 0; i <= steps; i++) {
    const logVal = minLog + (i / steps) * (maxLog - minLog);
    freqs.push(Math.round(Math.pow(10, logVal) * 100) / 100);
  }
  return freqs;
})();
