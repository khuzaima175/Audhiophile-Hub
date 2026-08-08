import { MeasurementPoint, MeasurementData, SmoothingType } from '../types';
import { SYNTHESIS_FREQUENCIES } from './curveSynthesizer';

/**
 * Lenient Measurement Parser for REW, Squiglink, and generic acoustic CSV/TSV/TXT exports.
 * 
 * Features:
 * - Automatically skips non-numeric header lines (*, Measurement:, Date:, Frequency, #, //, etc.)
 * - Detects delimiter (comma, tab, semicolon, or whitespace)
 * - Auto-detects columns: 1st number = Freq (Hz), 2nd number = SPL (dB), 3rd number (if present) = R (dB), averaged as (L+R)/2
 * - Normalizes data to 0 dB at 1 kHz (or custom datum)
 * - Log-frequency fractional octave smoothing (RAW, 1/6 OCT, 1/3 OCT)
 */

// Logarithmic interpolation helper between two points
export const interpolateSplAtFreq = (
  targetFreq: number,
  points: { freq: number; gain: number }[]
): number => {
  if (!points || points.length === 0) return 0;
  if (targetFreq <= points[0].freq) return points[0].gain;
  if (targetFreq >= points[points.length - 1].freq) return points[points.length - 1].gain;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    if (targetFreq >= p1.freq && targetFreq <= p2.freq) {
      const logF = Math.log10(targetFreq);
      const logF1 = Math.log10(p1.freq);
      const logF2 = Math.log10(p2.freq);
      const span = logF2 - logF1;
      if (span === 0) return p1.gain;
      const ratio = (logF - logF1) / span;
      return p1.gain + ratio * (p2.gain - p1.gain);
    }
  }
  return points[0].gain;
};

/**
 * Apply fractional-octave moving average smoothing in log-frequency space
 */
export const smoothLogCurve = (
  points: MeasurementPoint[],
  smoothing: SmoothingType
): MeasurementPoint[] => {
  if (smoothing === 'RAW' || points.length < 3) {
    return points.map((p) => ({ ...p }));
  }

  // Octave width fraction in log10 space
  // 1/3 octave = log10(2) / 3 ≈ 0.10034; 1/6 octave = log10(2) / 6 ≈ 0.05017
  const fraction = smoothing === '1/3 OCT' ? 3 : 6;
  const halfWindowLog = Math.log10(Math.pow(2, 1 / fraction)) / 2;

  const logFreqs = points.map((p) => Math.log10(Math.max(1, p.freq)));

  return points.map((pt, idx) => {
    const centerLog = logFreqs[idx];
    const minLog = centerLog - halfWindowLog;
    const maxLog = centerLog + halfWindowLog;

    let sumGain = 0;
    let sumRaw = 0;
    let count = 0;

    for (let j = 0; j < points.length; j++) {
      if (logFreqs[j] >= minLog && logFreqs[j] <= maxLog) {
        sumGain += points[j].gain;
        sumRaw += points[j].rawSpl;
        count++;
      }
    }

    if (count === 0) {
      return { ...pt };
    }

    return {
      freq: pt.freq,
      gain: parseFloat((sumGain / count).toFixed(2)),
      rawSpl: parseFloat((sumRaw / count).toFixed(2)),
    };
  });
};

/**
 * Resample points onto standard synthesis frequencies for ultra-smooth 60 FPS SVG rendering
 */
export const resampleToSynthesisFrequencies = (
  points: MeasurementPoint[]
): MeasurementPoint[] => {
  if (!points || points.length === 0) return [];

  const pointsForInterp = points.map((p) => ({ freq: p.freq, gain: p.gain }));
  const rawForInterp = points.map((p) => ({ freq: p.freq, gain: p.rawSpl }));

  return SYNTHESIS_FREQUENCIES.map((f) => ({
    freq: f,
    gain: parseFloat(interpolateSplAtFreq(f, pointsForInterp).toFixed(2)),
    rawSpl: parseFloat(interpolateSplAtFreq(f, rawForInterp).toFixed(2)),
  }));
};

/**
 * Main parse function for measurement text content (supports CSV, TSV, REW, and GraphicEQ formats)
 */
export const parseMeasurementFile = (
  textContent: string,
  fileName: string = 'Measurement',
  smoothing: SmoothingType = '1/3 OCT',
  normDatumFreq: number = 1000
): MeasurementData | null => {
  if (!textContent || !textContent.trim()) return null;

  const headerComments: string[] = [];
  const rawReadings: { freq: number; spl: number }[] = [];
  let isGraphicEQ = false;

  // 1. Check if the content is in GraphicEQ format (e.g. "GraphicEQ: 20 -4.8; 25 -4.2; ...")
  if (textContent.includes('GraphicEQ:') || textContent.toLowerCase().includes('graphiceq:')) {
    isGraphicEQ = true;
    const cleaned = textContent.replace(/GraphicEQ\s*:/i, '').trim();
    const pairs = cleaned.split(';');

    for (let pair of pairs) {
      const trimmedPair = pair.trim();
      if (!trimmedPair) continue;

      const tokens = trimmedPair.split(/[\s,]+/).filter((t) => t.length > 0);
      if (tokens.length >= 2) {
        const freq = parseFloat(tokens[0]);
        const spl = parseFloat(tokens[1]);

        if (!isNaN(freq) && !isNaN(spl) && freq >= 5 && freq <= 96000) {
          rawReadings.push({ freq, spl });
        }
      }
    }
  }

  // Also try: single line with semicolons but no GraphicEQ prefix
  if (rawReadings.length < 5 && textContent.includes(';') && !textContent.includes('\n')) {
    rawReadings.length = 0;
    isGraphicEQ = true;
    const pairs = textContent.trim().split(';');
    for (let pair of pairs) {
      const tokens = pair.trim().split(/[\s,]+/).filter((t) => t.length > 0);
      if (tokens.length >= 2) {
        const freq = parseFloat(tokens[0]);
        const spl = parseFloat(tokens[1]);
        if (!isNaN(freq) && !isNaN(spl) && freq >= 5 && freq <= 96000) {
          rawReadings.push({ freq, spl });
        }
      }
    }
  }

  // 2. If GraphicEQ didn't yield enough points, fallback to line-by-line CSV / TSV / Space parser
  if (rawReadings.length < 5) {
    rawReadings.length = 0; // reset
    isGraphicEQ = false;
    const lines = textContent.split(/\r?\n/);

    for (let line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Handle lines that contain GraphicEQ inside a multi-line file
      if (trimmed.toLowerCase().startsWith('graphiceq:')) {
        isGraphicEQ = true;
        const subPairs = trimmed.replace(/graphiceq\s*:/i, '').split(';');
        for (let pair of subPairs) {
          const tokens = pair.trim().split(/[\s,]+/).filter((t) => t.length > 0);
          if (tokens.length >= 2) {
            const freq = parseFloat(tokens[0]);
            const spl = parseFloat(tokens[1]);
            if (!isNaN(freq) && !isNaN(spl) && freq >= 5 && freq <= 96000) {
              rawReadings.push({ freq, spl });
            }
          }
        }
        continue;
      }

      // Detect and skip non-numeric header lines
      const isComment =
        trimmed.startsWith('*') ||
        trimmed.startsWith('#') ||
        trimmed.startsWith('//') ||
        trimmed.startsWith(';') ||
        trimmed.toLowerCase().startsWith('measurement') ||
        trimmed.toLowerCase().startsWith('date:') ||
        trimmed.toLowerCase().startsWith('freq') ||
        trimmed.toLowerCase().startsWith('hz') ||
        trimmed.toLowerCase().startsWith('frequency');

      if (isComment) {
        headerComments.push(trimmed);
        continue;
      }

      // Split on comma, tab, semicolon, or consecutive whitespace
      const parts = trimmed
        .split(/[\t,;]+|\s{2,}|\s+/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

      if (parts.length < 2) continue;

      const num1 = parseFloat(parts[0]);
      const num2 = parseFloat(parts[1]);
      const num3 = parts.length >= 3 ? parseFloat(parts[2]) : NaN;

      // Validate that at least first two tokens are numbers
      if (isNaN(num1) || isNaN(num2)) {
        headerComments.push(trimmed);
        continue;
      }

      // Sanity check for audio frequencies (5 Hz to 96 kHz)
      if (num1 < 5 || num1 > 96000) continue;

      // If 3 columns (e.g. Left and Right channel SPLs), average them
      let spl = num2;
      if (!isNaN(num3) && Math.abs(num3) < 200 && Math.abs(num2) < 200) {
        spl = (num2 + num3) / 2;
      }

      rawReadings.push({ freq: num1, spl });
    }
  }

  if (rawReadings.length < 3) {
    return null;
  }

  // Sort chronologically by frequency
  rawReadings.sort((a, b) => a.freq - b.freq);

  // For GraphicEQ / AutoEQ filter files: DO NOT normalize.
  // These values are absolute correction gains — normalizing them would distort the filter shape.
  // For raw measurements (CSV/TSV/REW): normalize to 0 dB at datum frequency.
  if (isGraphicEQ) {
    const rawPoints: MeasurementPoint[] = rawReadings.map((r) => ({
      freq: r.freq,
      gain: parseFloat(r.spl.toFixed(2)),
      rawSpl: parseFloat(r.spl.toFixed(2)),
    }));

    return {
      name: fileName.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '),
      rawPoints,
      smoothedPoints: rawPoints, // GraphicEQ data is already "smoothed" by the EQ algorithm
      normOffset: 0,
      sampleCount: rawPoints.length,
      smoothing: 'RAW',
      headerComments,
      isGraphicEQ: true,
    };
  }

  // Standard measurement normalization (1 kHz datum)
  const normOffset = interpolateSplAtFreq(
    normDatumFreq,
    rawReadings.map((r) => ({ freq: r.freq, gain: r.spl }))
  );

  const rawPoints: MeasurementPoint[] = rawReadings.map((r) => ({
    freq: r.freq,
    gain: parseFloat((r.spl - normOffset).toFixed(2)),
    rawSpl: parseFloat(r.spl.toFixed(2)),
  }));

  // Apply log-frequency smoothing
  const smoothedPoints = smoothLogCurve(rawPoints, smoothing);

  return {
    name: fileName.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '),
    rawPoints,
    smoothedPoints,
    normOffset: parseFloat(normOffset.toFixed(2)),
    sampleCount: rawPoints.length,
    smoothing,
    headerComments,
    isGraphicEQ: false,
  };
};
