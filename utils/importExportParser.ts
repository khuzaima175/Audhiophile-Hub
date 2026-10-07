import { PEQFilter, PEQFilterType } from '../types';
import { ISO_10_BANDS, ISO_15_BANDS, ISO_31_BANDS } from '../constants/targetCurves';
import { evaluateCompositeCurve, SYNTHESIS_FREQUENCIES } from './curveSynthesizer';
import { graphicFilters, safePreamp } from './biquad';

export interface ParsedEQResult {
  name?: string;
  mode: '10-band' | '15-band' | '31-band' | 'peq';
  graphicGains?: number[];
  peqFilters?: PEQFilter[];
  preamp: number;
  rawText: string;
  graphicPoints?: { freq: number; gain: number }[];
}

// Required by Wavelet's documented import format, not an arbitrary ISO slider list.
// https://pittvandewitt.github.io/Wavelet/Import/
export const WAVELET_FREQUENCIES = [
  20, 21, 22, 23, 24, 26, 27, 29, 30, 32, 34, 36, 38, 40, 43, 45, 48, 50, 53, 56, 59, 63, 66, 70, 74, 78, 83,
  87, 92, 97, 103, 109, 115, 121, 128, 136, 143, 151, 160, 169, 178, 188, 199, 210, 222, 235, 248, 262, 277,
  292, 309, 326, 345, 364, 385, 406, 429, 453, 479, 506, 534, 565, 596, 630, 665, 703, 743, 784, 829, 875,
  924, 977, 1032, 1090, 1151, 1216, 1284, 1357, 1433, 1514, 1599, 1689, 1784, 1885, 1991, 2103, 2221, 2347,
  2479, 2618, 2766, 2921, 3086, 3260, 3443, 3637, 3842, 4058, 4287, 4528, 4783, 5052, 5337, 5637, 5955, 6290,
  6644, 7018, 7414, 7831, 8272, 8738, 9230, 9749, 10298, 10878, 11490, 12137, 12821, 13543, 14305, 15110,
  15961, 16860, 17809, 18812, 19871,
];

// Calculate digital safety headroom preamp value
export const calculatePreampHeadroom = (gains: number[]): number => {
  if (!gains || gains.length === 0) return 0;
  const maxGain = Math.max(...gains, 0);
  if (maxGain <= 0) return 0;
  return parseFloat((-maxGain - 0.2).toFixed(1));
};

// Export to Equalizer APO / Peace format with preamp clipping protection
export const exportToEqualizerAPO = (
  peqFilters: PEQFilter[] = [],
  isoBands: number[] = [],
  isoGains: number[] = [],
  customPreamp?: number,
): string => {
  const hasParametric = peqFilters && peqFilters.length > 0;
  const response = evaluateCompositeCurve(
    SYNTHESIS_FREQUENCIES,
    hasParametric ? [] : isoBands,
    hasParametric ? [] : isoGains,
    peqFilters,
  );
  const calculatedPreamp = Math.min(
    customPreamp ?? 0,
    safePreamp(hasParametric ? peqFilters : graphicFilters(isoBands, isoGains)),
  );
  const lines: string[] = [];

  lines.push(`# AudioSage EQ Export - Equalizer APO / Peace`);
  lines.push(`Preamp: ${calculatedPreamp > 0 ? `+${calculatedPreamp}` : calculatedPreamp} dB`);

  if (peqFilters && peqFilters.length > 0) {
    peqFilters.forEach((f, idx) => {
      const typeMap: Record<PEQFilterType, string> = {
        PK: 'PK',
        LS: 'LSC',
        HS: 'HSC',
        HP: 'HPQ',
        LP: 'LPQ',
        NOTCH: 'NO',
      };
      const typeStr = typeMap[f.type] || 'PK';
      const gainStr = f.gain > 0 ? `+${f.gain}` : `${f.gain}`;
      const gainPart = ['PK', 'LS', 'HS'].includes(f.type) ? ` Gain ${gainStr} dB` : '';
      lines.push(
        `Filter ${idx + 1}: ${f.enabled === false ? 'OFF' : 'ON'} ${typeStr} Fc ${f.freq} Hz${gainPart} Q ${f.q}`,
      );
    });
  } else if (isoBands && isoGains && isoBands.length > 0) {
    const q = isoBands.length === 31 ? 4.3 : isoBands.length === 15 ? 2.0 : 1.41;
    isoBands.forEach((freq, idx) => {
      const gain = isoGains[idx] || 0;
      if (gain !== 0) {
        const gainStr = gain > 0 ? `+${gain}` : `${gain}`;
        lines.push(`Filter ${idx + 1}: ON PK Fc ${freq} Hz Gain ${gainStr} dB Q ${q.toFixed(2)}`);
      }
    });
  }

  return lines.join('\n');
};

// Export to Wavelet Android GraphicEQ format
export const exportToWavelet = (
  isoBands: number[] = ISO_10_BANDS,
  isoGains: number[] = [],
  customPreamp?: number,
): string => {
  const gains = isoGains && isoGains.length > 0 ? isoGains : new Array(isoBands.length).fill(0);
  const calculatedPreamp = Math.min(customPreamp ?? 0, calculatePreampHeadroom(gains));

  // Wavelet GraphicEQ string
  const bandStrings = WAVELET_FREQUENCIES.map((f) => {
    let value = gains[0] || 0;
    if (f >= isoBands.at(-1)!) value = gains.at(-1) || 0;
    else if (f > isoBands[0]) {
      const i = isoBands.findIndex((x) => x >= f);
      value =
        gains[i - 1] +
        ((gains[i] - gains[i - 1]) * Math.log(f / isoBands[i - 1])) / Math.log(isoBands[i] / isoBands[i - 1]);
    }
    const g = Number((value + calculatedPreamp).toFixed(4));
    const gStr = g > 0 ? `+${g}` : `${g}`;
    return `${f} ${gStr}`;
  });

  return `GraphicEQ: ${bandStrings.join('; ')}`;
};

// Export to standard Parametric EQ text list
export const exportToParametricText = (peqFilters: PEQFilter[] = [], customPreamp?: number): string => {
  const gains = peqFilters.map((f) => f.gain || 0);
  const calculatedPreamp = customPreamp !== undefined ? customPreamp : calculatePreampHeadroom(gains);
  const lines: string[] = [];

  lines.push(`Preamp: ${calculatedPreamp} dB`);
  peqFilters.forEach((f, i) => {
    lines.push(
      `Band ${i + 1}: ${f.type} | Freq: ${Math.round(f.freq)}Hz | Gain: ${f.gain > 0 ? `+${f.gain}` : f.gain}dB | Q: ${(f.q || 1.41).toFixed(2)}`,
    );
  });

  return lines.join('\n');
};

// Download .txt preset file directly in browser
export const downloadPresetFile = (filename: string, content: string): void => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.txt') ? filename : `${filename}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Bidirectional parser for AutoEQ, Equalizer APO, and Wavelet text
export const parseImportedEQText = (text: string): ParsedEQResult | null => {
  if (!text || !text.trim()) return null;
  const clean = text.trim();

  // 1. Check for Wavelet GraphicEQ format
  if (/GraphicEQ:/i.test(clean)) {
    const match = clean.match(/GraphicEQ:\s*([^;\n]+(?:;[^;\n]+)*)/i);
    if (match && match[1]) {
      const pairs = match[1]
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean);
      const parsedBands: { freq: number; gain: number }[] = [];

      pairs.forEach((p) => {
        const parts = p.split(/\s+/);
        if (parts.length >= 2) {
          const f = parseFloat(parts[0]);
          const g = parseFloat(parts[1]);
          if (Number.isFinite(f) && Number.isFinite(g) && f >= 20 && f <= 20000) {
            parsedBands.push({ freq: f, gain: g });
          }
        }
      });

      // Match against 10, 15, or 31 band ISO
      const count = parsedBands.length;
      const mode = count > 20 ? '31-band' : count > 12 ? '15-band' : '10-band';
      const targetIso = mode === '31-band' ? ISO_31_BANDS : mode === '15-band' ? ISO_15_BANDS : ISO_10_BANDS;

      if (parsedBands.length < 2) return null;
      parsedBands.sort((a, b) => a.freq - b.freq);
      const gains = targetIso.map((f) => {
        if (f <= parsedBands[0].freq) return parsedBands[0].gain;
        if (f >= parsedBands.at(-1)!.freq) return parsedBands.at(-1)!.gain;
        const i = parsedBands.findIndex((p) => p.freq >= f),
          a = parsedBands[i - 1],
          b = parsedBands[i];
        return a.gain + ((b.gain - a.gain) * Math.log(f / a.freq)) / Math.log(b.freq / a.freq);
      });

      const preampMatch = clean.match(/Preamp:\s*([+-]?\d+(?:\.\d+)?)/i);
      const preamp = preampMatch ? parseFloat(preampMatch[1]) : calculatePreampHeadroom(gains);

      return {
        mode,
        graphicGains: gains,
        preamp,
        rawText: clean,
        graphicPoints: parsedBands,
      };
    }
  }

  // 2. Check for Equalizer APO / Peace / Parametric Filter lines
  // Pattern: Filter [X]: [ON/OFF] [Type] Fc [Freq] Hz Gain [Gain] dB Q [Q]
  const filterRegex =
    /Filter\s*(?:\d+)?\s*:\s*(ON|OFF)?\s*([A-Z]+)\s+Fc\s+(\d+(?:\.\d+)?)\s*Hz(?:\s+Gain\s*([+-]?\d+(?:\.\d+)?)\s*dB)?(?:\s+Q\s*(\d+(?:\.\d+)?))?/gi;
  const peqFilters: PEQFilter[] = [];
  let match: RegExpExecArray | null;

  while ((match = filterRegex.exec(clean)) !== null) {
    const rawType = match[2].toUpperCase();
    const freq = parseFloat(match[3]);
    const gain = parseFloat(match[4]);
    const q = parseFloat(match[5]);

    const typeMap: Record<string, PEQFilterType> = {
      PK: 'PK',
      PEAK: 'PK',
      LSC: 'LS',
      LOWSHELF: 'LS',
      LS: 'LS',
      HSC: 'HS',
      HIGHSHELF: 'HS',
      HS: 'HS',
      HP: 'HP',
      HPQ: 'HP',
      HIGHPASS: 'HP',
      LP: 'LP',
      LPQ: 'LP',
      LOWPASS: 'LP',
      NO: 'NOTCH',
      NOTCH: 'NOTCH',
    };

    const filterType = typeMap[rawType];

    if (
      filterType &&
      Number.isFinite(freq) &&
      freq >= 20 &&
      freq <= 20000 &&
      (gain === undefined || !Number.isFinite(gain)
        ? !['PK', 'LS', 'HS'].includes(filterType)
        : Math.abs(gain) <= 36) &&
      (Number.isNaN(q) || (q > 0 && q <= 20))
    ) {
      peqFilters.push({
        id: `f-${peqFilters.length + 1}-${Date.now()}`,
        type: filterType,
        freq,
        gain: Number.isFinite(gain) ? gain : 0,
        q: Number.isFinite(q) ? q : ['HP', 'LP'].includes(filterType) ? Math.SQRT1_2 : 1.41,
        enabled: match[1]?.toUpperCase() !== 'OFF',
      });
    }
  }

  if (peqFilters.length > 0) {
    const preampMatch = clean.match(/Preamp:\s*([+-]?\d+(?:\.\d+)?)/i);
    const preamp = preampMatch
      ? parseFloat(preampMatch[1])
      : calculatePreampHeadroom(peqFilters.map((f) => f.gain));

    return {
      mode: 'peq',
      peqFilters,
      preamp,
      rawText: clean,
    };
  }

  return null;
};
