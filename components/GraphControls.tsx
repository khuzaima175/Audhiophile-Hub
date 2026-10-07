import React, { useState, useEffect } from 'react';
import { GraphSettings, AutoFitLimits } from '../types';
import { DEFAULT_GRAPH_SETTINGS, DEFAULT_FIT_LIMITS, validateFitLimits } from '../utils/graphTools';

export function GraphControls({ value, onChange }: { value: GraphSettings; onChange: (value: GraphSettings) => void }) {
  const patch = (p: Partial<GraphSettings>) => onChange({ ...value, ...p });
  return <details className="section-disclosure graph-display-controls"><summary>Graph controls</summary>
    <div className="graph-controls-grid">
      <label>Frequency range<select aria-label="Plot frequency range" value={value.minFreq===20&&value.maxFreq===20000?'full':value.maxFreq===250?'bass':value.minFreq===250&&value.maxFreq===4000?'mids':value.minFreq===4000?'treble':'custom'} onChange={e=>{const r=({full:[20,20000],bass:[20,250],mids:[250,4000],treble:[4000,20000]} as Record<string,number[]>)[e.target.value];if(r)patch({minFreq:r[0],maxFreq:r[1]});}}><option value="full">Full · 20 Hz–20 kHz</option><option value="bass">Bass</option><option value="mids">Mids</option><option value="treble">Treble</option><option value="custom">Custom</option></select></label>
      <label>From (Hz)<input aria-label="Plot minimum frequency" type="number" min="20" max={value.maxFreq-1} value={value.minFreq} onChange={e=>patch({minFreq:Math.max(20,Math.min(value.maxFreq-1,Number(e.target.value)||20))})}/></label>
      <label>To (Hz)<input aria-label="Plot maximum frequency" type="number" min={value.minFreq+1} max="20000" value={value.maxFreq} onChange={e=>patch({maxFreq:Math.min(20000,Math.max(value.minFreq+1,Number(e.target.value)||20000))})}/></label>
      <label>Vertical scale<select aria-label="Plot vertical scale" value={value.yRange?'manual':'auto'} onChange={e=>patch({yRange:e.target.value==='auto'?null:[-18,18]})}><option value="auto">Auto range</option><option value="manual">Manual dB range</option></select></label>
      {value.yRange && <><label>Minimum dB<input aria-label="Plot minimum dB" type="number" min="-120" max={value.yRange[1]-6} value={value.yRange[0]} onChange={e=>patch({yRange:[Math.max(-120,Math.min(value.yRange![1]-6,Number(e.target.value)||0)),value.yRange![1]]})}/></label><label>Maximum dB<input aria-label="Plot maximum dB" type="number" min={value.yRange[0]+6} max="140" value={value.yRange[1]} onChange={e=>patch({yRange:[value.yRange![0],Math.min(140,Math.max(value.yRange![0]+6,Number(e.target.value)||0))]})}/></label></>}
      <label className="checkbox-control"><input type="checkbox" checked={value.inspect} onChange={e=>patch({inspect:e.target.checked})}/>Inspect values</label>
      <label className="checkbox-control"><input type="checkbox" checked={value.showLabels} onChange={e=>patch({showLabels:e.target.checked})}/>Show curve labels</label>
      <button className="secondary-button" onClick={()=>onChange(structuredClone(DEFAULT_GRAPH_SETTINGS))}>Reset graph view</button>
    </div>
  </details>;
}
export function FitControls({ value, onChange }: {value:AutoFitLimits;onChange:(value:AutoFitLimits)=>void}) {
  const [editing, setEditing] = useState(value);
  const [error, setError] = useState('');
  useEffect(()=>setEditing(value),[value]);
  const apply = () => { if(!validateFitLimits(editing)){setError('Use ordered 20–20,000 Hz, −18 to +18 dB, 0.1–20 Q limits and at least one filter type.');return;}setError('');onChange(editing); };
  return <details className="section-disclosure"><summary>AutoEQ limits</summary>
    <div className="graph-controls-grid">
      {(['minFreq','maxFreq','minGain','maxGain','minQ','maxQ'] as const).map(key=><label key={key}>{({minFreq:'Fit from (Hz)',maxFreq:'Fit to (Hz)',minGain:'Minimum gain (dB)',maxGain:'Maximum gain (dB)',minQ:'Minimum Q',maxQ:'Maximum Q'})[key]}<input aria-label={key} type="number" step={key.includes('Q') ? 0.1 : 1} value={editing[key]} onChange={e=>{const n=Number(e.target.value);if(!Number.isFinite(n))return;const next={...editing,[key]:n};setEditing(next);}}/></label>)}
      {(['PK','LS','HS'] as const).map(type=><label className="checkbox-control" key={type}><input type="checkbox" checked={editing.types.includes(type)} onChange={e=>setEditing({...editing,types:e.target.checked?[...editing.types,type]:editing.types.filter(t=>t!==type)})}/>{({PK:'Peak',LS:'Low shelf',HS:'High shelf'})[type]}</label>)}
      <button className="primary-button" onClick={apply}>Apply limits</button>
      <button className="secondary-button" onClick={()=>{setError('');onChange(structuredClone(DEFAULT_FIT_LIMITS));}}>Reset AutoEQ limits</button>
    </div>{error && <p role="alert">{error}</p>}<p className="text-xs text-audio-muted">Limits apply to source fitting, independently of the displayed zoom and offsets.</p>
  </details>;
}
