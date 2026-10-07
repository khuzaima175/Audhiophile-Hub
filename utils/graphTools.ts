import { CurvePoint, LabCurve, GraphSettings, AutoFitLimits } from '../types';
import { CRINGRAPH_FREQ_TICKS, getInterpolatedTargetGain } from '../constants/targetCurves';
import { freqToX, ViewportDimensions, SYNTHESIS_FREQUENCIES } from './curveSynthesizer';

export const DEFAULT_GRAPH_SETTINGS: GraphSettings = { minFreq: 20, maxFreq: 20000, yRange: null, inspect: true, showLabels: false };
export const DEFAULT_FIT_LIMITS: AutoFitLimits = { minFreq: 20, maxFreq: 20000, minGain: -12, maxGain: 12, minQ: .5, maxQ: 4, types: ['PK','LS','HS'] };
export const SMOOTHING_VALUES = ['RAW','1/48 OCT','1/24 OCT','1/12 OCT','1/6 OCT','1/3 OCT'] as const;
export function validateGraphSettings(v: any): v is GraphSettings {
  return !!v && Number.isFinite(v.minFreq) && Number.isFinite(v.maxFreq) && v.minFreq >= 20 && v.maxFreq <= 20000 && v.minFreq < v.maxFreq && typeof v.inspect === 'boolean' && typeof v.showLabels === 'boolean' &&
    (v.yRange === null || (Array.isArray(v.yRange) && v.yRange.length === 2 && v.yRange.every(Number.isFinite) && v.yRange[0] >= -120 && v.yRange[1] <= 140 && v.yRange[1]-v.yRange[0] >= 6));
}
export function validateFitLimits(v: any): v is AutoFitLimits {
  return !!v && [v.minFreq,v.maxFreq,v.minGain,v.maxGain,v.minQ,v.maxQ].every(Number.isFinite) && v.minFreq >= 20 && v.maxFreq <= 20000 && v.minFreq < v.maxFreq && v.minGain >= -18 && v.maxGain <= 18 && v.minGain <= v.maxGain && v.minQ >= .1 && v.maxQ <= 20 && v.minQ <= v.maxQ && Array.isArray(v.types) && v.types.length > 0 && v.types.every((t:string)=>['PK','LS','HS'].includes(t));
}
/** Tick labels reserve their actual text width in CSS pixels. Grid lines may remain denser. */
export function frequencyTicks(viewport: ViewportDimensions, renderedWidth = viewport.width) {
  const scale = renderedWidth / viewport.width;
  const candidates = CRINGRAPH_FREQ_TICKS.filter(t=>t.freq >= (viewport.minFreq || 20) && t.freq <= (viewport.maxFreq || 20000));
  const accepted: typeof candidates = [];
  const bounds: [number,number][] = [];
  const ordered = [...candidates].sort((a,b)=>Number(b.major)-Number(a.major) || a.freq-b.freq);
  for (const tick of ordered) {
    const x = freqToX(tick.freq,viewport)*scale;
    const half = tick.label.length*3.9+6;
    if (bounds.some(([l,r])=>x+half > l && x-half < r)) continue;
    accepted.push(tick); bounds.push([x-half,x+half]);
  }
  return accepted.sort((a,b)=>a.freq-b.freq);
}
export function averageCurves(sets: CurvePoint[][]): CurvePoint[] {
  if (!sets.length || sets.some(s=>s.length<2)) throw new Error('Select at least one complete curve');
  const lower=Math.max(...sets.map(s=>s[0].freq)), upper=Math.min(...sets.map(s=>s.at(-1)!.freq));
  if(lower>=upper) throw new Error('Selected curves have no common frequency support');
  const freqs=[lower,...SYNTHESIS_FREQUENCIES.filter(f=>f>lower&&f<upper),upper];
  return freqs.map(freq=>({freq,gain:20*Math.log10(sets.reduce((sum,s)=>sum+10**(getInterpolatedTargetGain(freq,s)/20),0)/sets.length)}));
}
export function channelPoints(curve: LabCurve): CurvePoint[] {
  if (!curve.channels) return curve.points;
  if (curve.channel === 'left') return curve.channels.left;
  if (curve.channel === 'right') return curve.channels.right;
  return averageCurves([curve.channels.left,curve.channels.right]);
}
export function channelImbalance(curve: LabCurve): number | null {
  if(!curve.channels) return null;
  const {left,right}=curve.channels;
  const lo=Math.max(100,left[0].freq,right[0].freq),hi=Math.min(10000,left.at(-1)!.freq,right.at(-1)!.freq);
  const freqs=SYNTHESIS_FREQUENCIES.filter(f=>f>=lo&&f<=hi);
  return freqs.length?Math.sqrt(freqs.reduce((sum,f)=>sum+(getInterpolatedTargetGain(f,left)-getInterpolatedTargetGain(f,right))**2,0)/freqs.length):null;
}
/** Log-spaced mean dB alignment; deliberately not an ISO perceptual-loudness estimate. */
export function meanDatum(points: CurvePoint[]): number {
  const f=[points[0].freq,...SYNTHESIS_FREQUENCIES.filter(f=>f>points[0].freq&&f<points.at(-1)!.freq),points.at(-1)!.freq];
  if(!f.length) throw new Error('Curve has no alignment evaluation points');
  return f.reduce((sum,f)=>sum+getInterpolatedTargetGain(f,points),0)/f.length;
}
export const curveColor = (index: number) => ['#79aaff','#edab77','#be90ec','#70cfac','#ee8a9a','#d9d078'][index%6];
