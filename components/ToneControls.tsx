import React, {useState} from 'react';
export function ToneControls({active,play,stop,onFrequency}: {active:boolean;play:(frequency:number)=>Promise<void>;stop:()=>void;onFrequency:(frequency:number)=>void}) {
  const [frequency,setFrequency]=useState(1000);
  const [error,setError]=useState('');
  const change=(value:number)=>{const next=Math.max(20,Math.min(20000,value||20));setFrequency(next);if(active)onFrequency(next);};
  return <div className="tone-controls">
    <label>Tone (Hz)<input aria-label="Tone frequency" type="number" min="20" max="20000" value={frequency} onChange={e=>change(Number(e.target.value))}/></label>
    <input aria-label="Tone frequency sweep" type="range" min={Math.log10(20)} max={Math.log10(20000)} step="0.005" value={Math.log10(frequency)} onChange={e=>change(Math.round(10**Number(e.target.value)))}/>
    <button className="secondary-button" onClick={()=>{setError('');if(active)stop();else void play(frequency).catch(e=>setError(e.message));}}>{active?'Stop tone':'Play tone'}</button>
    {error&&<p role="alert">{error}</p>}
  </div>;
}
