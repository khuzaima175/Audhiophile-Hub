import type { PEQFilter } from '../types';

export const DSP_SAMPLE_RATE = 48000;
export const filterTypeMap: Record<string, BiquadFilterType> = {
  PK: 'peaking',
  LS: 'lowshelf',
  HS: 'highshelf',
  HP: 'highpass',
  LP: 'lowpass',
  NOTCH: 'notch',
};
export interface BiquadCoefficients {
  b: number[];
  a: number[];
}

// RBJ Audio EQ Cookbook, using linear Q (including for shelves and pass filters).
// https://www.w3.org/TR/audio-eq-cookbook/
export function biquadCoefficients(
  type: string,
  fc: number,
  gain: number,
  q: number,
  sampleRate = DSP_SAMPLE_RATE,
): BiquadCoefficients {
  if (
    ![fc, gain, q, sampleRate].every(Number.isFinite) ||
    fc <= 0 ||
    q <= 0 ||
    sampleRate < 8000 ||
    fc >= sampleRate / 2
  )
    throw new Error('Invalid filter frequency, gain, Q or sample rate');
  const w = (2 * Math.PI * fc) / sampleRate,
    c = Math.cos(w),
    sin = Math.sin(w),
    A = 10 ** (gain / 40),
    alpha = sin / (2 * q),
    root = 2 * Math.sqrt(A) * alpha;
  let b: number[], a: number[];
  switch (filterTypeMap[type] || type) {
    case 'peaking':
      b = [1 + alpha * A, -2 * c, 1 - alpha * A];
      a = [1 + alpha / A, -2 * c, 1 - alpha / A];
      break;
    case 'lowshelf':
      b = [A * (A + 1 - (A - 1) * c + root), 2 * A * (A - 1 - (A + 1) * c), A * (A + 1 - (A - 1) * c - root)];
      a = [A + 1 + (A - 1) * c + root, -2 * (A - 1 + (A + 1) * c), A + 1 + (A - 1) * c - root];
      break;
    case 'highshelf':
      b = [
        A * (A + 1 + (A - 1) * c + root),
        -2 * A * (A - 1 + (A + 1) * c),
        A * (A + 1 + (A - 1) * c - root),
      ];
      a = [A + 1 - (A - 1) * c + root, 2 * (A - 1 - (A + 1) * c), A + 1 - (A - 1) * c - root];
      break;
    case 'highpass':
      b = [(1 + c) / 2, -(1 + c), (1 + c) / 2];
      a = [1 + alpha, -2 * c, 1 - alpha];
      break;
    case 'lowpass':
      b = [(1 - c) / 2, 1 - c, (1 - c) / 2];
      a = [1 + alpha, -2 * c, 1 - alpha];
      break;
    case 'notch':
      b = [1, -2 * c, 1];
      a = [1 + alpha, -2 * c, 1 - alpha];
      break;
    default:
      throw new Error('Unsupported filter type: ' + type);
  }
  const a0 = a[0];
  return { b: b.map((v) => v / a0), a: a.map((v) => v / a0) };
}

export function coefficientGain(
  f: number,
  coefficients: BiquadCoefficients,
  sampleRate = DSP_SAMPLE_RATE,
): number {
  const w = (2 * Math.PI * Math.max(0, Math.min(sampleRate / 2, f))) / sampleRate;
  const power = (v: number[]) => {
    const re = v[0] + v[1] * Math.cos(w) + v[2] * Math.cos(2 * w);
    const im = -v[1] * Math.sin(w) - v[2] * Math.sin(2 * w);
    return re * re + im * im;
  };
  return 10 * Math.log10(Math.max(1e-24, power(coefficients.b)) / Math.max(1e-24, power(coefficients.a)));
}

export function graphicFilters(bands: number[], gains: number[]): PEQFilter[] {
  const q = bands.length === 31 ? 4.3 : bands.length === 15 ? 2 : 1.41;
  return bands.map((freq, i) => ({
    id: 'graphic-' + i,
    type: 'PK',
    freq,
    gain: gains[i] || 0,
    q,
    enabled: true,
  }));
}

export function createDSPNode(ctx: AudioContext, filter: PEQFilter): BiquadFilterNode | IIRFilterNode {
  if (filter.type === 'LS' || filter.type === 'HS') {
    const { b, a } = biquadCoefficients(filter.type, filter.freq, filter.gain, filter.q, ctx.sampleRate);
    return ctx.createIIRFilter(b, a);
  }
  const node = ctx.createBiquadFilter();
  node.type = filterTypeMap[filter.type];
  node.frequency.value = filter.freq;
  node.gain.value = filter.gain;
  node.Q.value = filter.type === 'HP' || filter.type === 'LP' ? 20 * Math.log10(filter.q) : filter.q;
  return node;
}

export function safePreamp(filters: PEQFilter[], sampleRate = DSP_SAMPLE_RATE): number {
  const active = filters.filter((f) => f.enabled !== false);
  const coefficients = active.map((f) => biquadCoefficients(f.type, f.freq, f.gain, f.q, sampleRate));
  // Include every filter center as well as a dense log grid to catch narrow boosts.
  const frequencies = [
    ...active.map((f) => f.freq),
    ...Array.from({ length: 2049 }, (_, i) => 20 * (Math.min(20000, sampleRate / 2 - 1) / 20) ** (i / 2048)),
  ];
  let peak = 0;
  for (const freq of frequencies)
    peak = Math.max(
      peak,
      coefficients.reduce((sum, c) => sum + coefficientGain(freq, c, sampleRate), 0),
    );
  return peak > 1e-6 ? -Math.ceil((peak + 0.2 - 1e-9) * 10) / 10 : 0;
}
