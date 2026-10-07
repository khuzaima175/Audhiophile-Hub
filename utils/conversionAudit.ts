import { CurvePoint, PEQFilter } from '../types';
import { getInterpolatedTargetGain } from '../constants/targetCurves';
import { SYNTHESIS_FREQUENCIES, evaluateCompositeCurve } from './curveSynthesizer';
import { exportToWavelet, parseImportedEQText } from './importExportParser';
export interface ConversionError { rms: number; max: number; points: number; withinTolerance: boolean; deepNotch: boolean; }
// Compare absolute levels on the 180-point grid. Clamp nulls to -60 dB; report the excluded-depth limitation.
export function compareResponses(original: CurvePoint[], converted: CurvePoint[]): ConversionError {
  if (!original.length || !converted.length) throw new Error('Conversion response data missing');
  const lower = Math.max(original[0].freq,converted[0].freq), upper = Math.min(original.at(-1)!.freq,converted.at(-1)!.freq);
  const grid = SYNTHESIS_FREQUENCIES.filter(f => f>=lower && f<=upper);
  if (!grid.length) throw new Error('Conversion has no comparable points');
  let deepNotch = false;
  const errors = grid.map(f => { const a=getInterpolatedTargetGain(f,original), b=getInterpolatedTargetGain(f,converted); if (a < -60 || b < -60) deepNotch=true; return Math.abs(Math.max(-60,a)-Math.max(-60,b)); });
  const rms = Math.sqrt(errors.reduce((sum,e)=>sum+e*e,0)/errors.length), max = Math.max(...errors);
  return { rms, max, points:grid.length, withinTolerance: rms<=1 && max<=3 && !deepNotch, deepNotch };
}
export function auditWavelet(filters: PEQFilter[], bands: number[], gains: number[], preamp: number, sampleRate: number) {
  const response = evaluateCompositeCurve(SYNTHESIS_FREQUENCIES.filter(f=>f<sampleRate/2), filters.length ? [] : bands, filters.length ? [] : gains,filters,sampleRate);
  const text = exportToWavelet(response.map(p=>p.freq),response.map(p=>p.gain),preamp);
  const converted = parseImportedEQText(text)?.graphicPoints;
  if (!converted) throw new Error('Could not evaluate Wavelet conversion');
  const error = compareResponses(response.map(p=>({...p,gain:p.gain+preamp})),converted);
  return {text,error};
}
