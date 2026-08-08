import { PEQFilter, PEQFilterType } from '../types';
import { ISO_10_BANDS, ISO_15_BANDS, ISO_31_BANDS } from '../constants/targetCurves';

export interface ParsedEQResult {
  name?: string;
  mode: '10-band' | '15-band' | '31-band' | 'peq';
  graphicGains?: number[];
  peqFilters?: PEQFilter[];
  preamp: number;
  rawText: string;
}

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
  customPreamp?: number
): string => {
  const allGains: number[] = [];
  if (peqFilters && peqFilters.length > 0) {
    allGains.push(...peqFilters.map((f) => f.gain || 0));
  }
  if (isoGains && isoGains.length > 0) {
    allGains.push(...isoGains);
  }

  const calculatedPreamp = customPreamp !== undefined ? customPreamp : calculatePreampHeadroom(allGains);
  const lines: string[] = [];

  lines.push(`# AudioSage EQ Export - Equalizer APO / Peace`);
  lines.push(`Preamp: ${calculatedPreamp > 0 ? `+${calculatedPreamp}` : calculatedPreamp} dB`);

  if (peqFilters && peqFilters.length > 0) {
    peqFilters.forEach((f, idx) => {
      const typeMap: Record<PEQFilterType, string> = {
        PK: 'PK',
        LS: 'LSC',
        HS: 'HSC',
        HP: 'HP',
        LP: 'LP',
        NOTCH: 'NO',
      };
      const typeStr = typeMap[f.type] || 'PK';
      const gainStr = f.gain > 0 ? `+${f.gain}` : `${f.gain}`;
      lines.push(
        `Filter ${idx + 1}: ON ${typeStr} Fc ${Math.round(f.freq)} Hz Gain ${gainStr} dB Q ${(f.q || 1.41).toFixed(2)}`
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
  customPreamp?: number
): string => {
  const gains = isoGains && isoGains.length > 0 ? isoGains : new Array(isoBands.length).fill(0);
  const calculatedPreamp = customPreamp !== undefined ? customPreamp : calculatePreampHeadroom(gains);

  // Wavelet GraphicEQ string
  const bandStrings = isoBands.map((f, i) => {
    const g = gains[i] || 0;
    const gStr = g > 0 ? `+${g}` : `${g}`;
    return `${f} ${gStr}`;
  });

  return `GraphicEQ: 20 0.0; ${bandStrings.join('; ')}\nPreamp: ${calculatedPreamp > 0 ? `+${calculatedPreamp}` : calculatedPreamp} dB`;
};

// Export to standard Parametric EQ text list
export const exportToParametricText = (
  peqFilters: PEQFilter[] = [],
  customPreamp?: number
): string => {
  const gains = peqFilters.map((f) => f.gain || 0);
  const calculatedPreamp = customPreamp !== undefined ? customPreamp : calculatePreampHeadroom(gains);
  const lines: string[] = [];

  lines.push(`Preamp: ${calculatedPreamp} dB`);
  peqFilters.forEach((f, i) => {
    lines.push(
      `Band ${i + 1}: ${f.type} | Freq: ${Math.round(f.freq)}Hz | Gain: ${f.gain > 0 ? `+${f.gain}` : f.gain}dB | Q: ${(f.q || 1.41).toFixed(2)}`
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
  if (clean.includes('GraphicEQ:')) {
    const match = clean.match(/GraphicEQ:\s*([^;\n]+(?:;[^;\n]+)*)/i);
    if (match && match[1]) {
      const pairs = match[1].split(';').map((s) => s.trim()).filter(Boolean);
      const parsedBands: { freq: number; gain: number }[] = [];

      pairs.forEach((p) => {
        const parts = p.split(/\s+/);
        if (parts.length >= 2) {
          const f = parseFloat(parts[0]);
          const g = parseFloat(parts[1]);
          if (!isNaN(f) && !isNaN(g)) {
            parsedBands.push({ freq: f, gain: g });
          }
        }
      });

      // Match against 10, 15, or 31 band ISO
      const count = parsedBands.length;
      const mode = count > 20 ? '31-band' : count > 12 ? '15-band' : '10-band';
      const targetIso = mode === '31-band' ? ISO_31_BANDS : mode === '15-band' ? ISO_15_BANDS : ISO_10_BANDS;

      const gains = targetIso.map((f) => {
        const found = parsedBands.find((b) => Math.abs(b.freq - f) < f * 0.15);
        return found ? found.gain : 0;
      });

      const preampMatch = clean.match(/Preamp:\s*([+-]?\d+(?:\.\d+)?)/i);
      const preamp = preampMatch ? parseFloat(preampMatch[1]) : calculatePreampHeadroom(gains);

      return {
        mode,
        graphicGains: gains,
        preamp,
        rawText: clean,
      };
    }
  }

  // 2. Check for Equalizer APO / Peace / Parametric Filter lines
  // Pattern: Filter [X]: [ON/OFF] [Type] Fc [Freq] Hz Gain [Gain] dB Q [Q]
  const filterRegex = /Filter\s*(?:\d+)?\s*:\s*(?:ON|OFF)?\s*([A-Z]+)\s+Fc\s+(\d+(?:\.\d+)?)\s*Hz\s+Gain\s*([+-]?\d+(?:\.\d+)?)\s*dB\s+Q\s*(\d+(?:\.\d+)?)/gi;
  const peqFilters: PEQFilter[] = [];
  let match: RegExpExecArray | null;

  while ((match = filterRegex.exec(clean)) !== null) {
    const rawType = match[1].toUpperCase();
    const freq = parseFloat(match[2]);
    const gain = parseFloat(match[3]);
    const q = parseFloat(match[4]);

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
      HIGHPASS: 'HP',
      LP: 'LP',
      LOWPASS: 'LP',
      NO: 'NOTCH',
      NOTCH: 'NOTCH',
    };

    const filterType = typeMap[rawType] || 'PK';

    if (!isNaN(freq) && !isNaN(gain)) {
      peqFilters.push({
        id: `f-${peqFilters.length + 1}-${Date.now()}`,
        type: filterType,
        freq: Math.round(freq),
        gain,
        q: isNaN(q) ? 1.41 : q,
        enabled: true,
      });
    }
  }

  if (peqFilters.length > 0) {
    const preampMatch = clean.match(/Preamp:\s*([+-]?\d+(?:\.\d+)?)/i);
    const preamp = preampMatch ? parseFloat(preampMatch[1]) : calculatePreampHeadroom(peqFilters.map((f) => f.gain));

    return {
      mode: 'peq',
      peqFilters,
      preamp,
      rawText: clean,
    };
  }

  return null;
};
