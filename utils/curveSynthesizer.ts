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
  let minGain = Infinity;
  let maxGain = -Infinity;

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

  // Ensure minimum baseline view range for target or isolated curves
  if (isTargetVisible) {
    minGain = Math.min(minGain, -12);
    maxGain = Math.max(maxGain, 12);
  } else {
    minGain = Math.min(minGain, -6);
    maxGain = Math.max(maxGain, 6);
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

// Monotonic Cubic Hermite / Catmull-Rom interpolation in log10(frequency) space (matching squig.link / AutoEQ)
export const interpolateGraphicBandsSmooth = (
  f: number,
  isoBands: number[],
  isoGains: number[]
): number => {
  if (!isoBands || isoBands.length === 0) return 0;
  if (f <= isoBands[0]) return isoGains[0] || 0;
  if (f >= isoBands[isoBands.length - 1]) return isoGains[isoGains.length - 1] || 0;

  // Find bounding segment
  for (let i = 0; i < isoBands.length - 1; i++) {
    const f0 = isoBands[i];
    const f1 = isoBands[i + 1];
    if (f >= f0 && f <= f1) {
      const logF = Math.log10(f);
      const logF0 = Math.log10(f0);
      const logF1 = Math.log10(f1);
      const h = logF1 - logF0;
      if (h === 0) return isoGains[i] || 0;

      const t = (logF - logF0) / h;
      const y0 = isoGains[i] || 0;
      const y1 = isoGains[i + 1] || 0;

      // Estimate tangents using centered finite differences with monotonic clamping (Fritsch-Carlson)
      const ym1 = i > 0 ? (isoGains[i - 1] || 0) : y0;
      const yp2 = i < isoBands.length - 2 ? (isoGains[i + 2] || 0) : y1;

      let m0 = (y1 - ym1) / 2;
      let m1 = (yp2 - y0) / 2;

      // Monotonicity check: if interval is flat, clamp slopes to 0
      const delta = y1 - y0;
      if (delta === 0) {
        m0 = 0;
        m1 = 0;
      } else {
        // Prevent overshoot beyond secant slope
        if (m0 * delta < 0) m0 = 0;
        if (m1 * delta < 0) m1 = 0;
        if (Math.abs(m0) > 3 * Math.abs(delta)) m0 = 3 * delta;
        if (Math.abs(m1) > 3 * Math.abs(delta)) m1 = 3 * delta;
      }

      // Standard Hermite basis functions
      const t2 = t * t;
      const t3 = t2 * t;
      const h00 = 2 * t3 - 3 * t2 + 1;
      const h10 = t3 - 2 * t2 + t;
      const h01 = -2 * t3 + 3 * t2;
      const h11 = t3 - t2;

      return h00 * y0 + h10 * m0 + h01 * y1 + h11 * m1;
    }
  }
  return 0;
};

// Evaluate composite EQ curve (smooth log-spline for Graphic bands + sum of PEQ filters)
export const evaluateCompositeCurve = (
  frequencies: number[],
  isoBands: number[],
  isoGains: number[],
  peqFilters: PEQFilter[] = []
): CurvePoint[] => {
  const hasGraphic = isoBands && isoBands.length > 0 && isoGains.some((g) => g !== 0);

  return frequencies.map((f) => {
    let totalDb = 0;

    // Smooth GraphicEQ interpolation across ISO bands (squig.link / AutoEQ smooth curve)
    if (hasGraphic) {
      totalDb += interpolateGraphicBandsSmooth(f, isoBands, isoGains);
    }

    // Sum active Parametric EQ filters (if any)
    for (let i = 0; i < peqFilters.length; i++) {
      const filter = peqFilters[i];
      if (filter.enabled !== false && filter.gain !== undefined && filter.gain !== 0) {
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
