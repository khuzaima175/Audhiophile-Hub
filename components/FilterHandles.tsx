import React, { useRef, useState, useEffect } from 'react';
import { audioWorkspace, useAudioWorkspace } from '../store/audioWorkspace';
import { freqToX, dbToY, xToFreq, yToDb, ViewportDimensions } from '../utils/curveSynthesizer';
import { useDismissSurface } from '../hooks/useDismissSurface';
import { PEQFilter } from '../types';
export const gainApplies = (type: string) => ['PK','LS','HS'].includes(type);
interface Props {
  viewport: ViewportDimensions; bands: number[]; gains: number[];
  onGain: (index: number, gain: number) => void;
  onFilter: (id: string, updates: Partial<PEQFilter>) => void;
  onDragging: (active: boolean) => void;
}
export function FilterHandles({ viewport, bands, gains, onGain, onFilter, onDragging }: Props) {
  const { draft } = useAudioWorkspace();
  const root = useRef<SVGGElement>(null);
  const [hitRadius, setHitRadius] = useState({ x: 22, y: 22 });
  useEffect(() => { const svg = root.current?.ownerSVGElement; if (!svg) return; const measure = () => { const r = svg.getBoundingClientRect(); if (r.width && r.height) setHitRadius({ x: 22 * viewport.width / r.width, y: 22 * viewport.height / r.height }); }; const observer = new ResizeObserver(measure); observer.observe(svg); measure(); return () => observer.disconnect(); }, [viewport.width, viewport.height]);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ id: string; index: number; pointer: number; node: Element; viewport: ViewportDimensions } | null>(null);
  const frame = useRef(0);
  const pending = useRef<(() => void) | null>(null);
  const finish = (cancel = false) => {
    if (!drag.current) return;
    cancelAnimationFrame(frame.current); frame.current = 0;
    if (!cancel) pending.current?.(); pending.current = null;
    const d = drag.current; drag.current = null;
    audioWorkspace.endGesture(cancel); setDragging(false); onDragging(false);
    if (d.node.hasPointerCapture(d.pointer)) d.node.releasePointerCapture(d.pointer);
  };
  useEffect(() => () => { cancelAnimationFrame(frame.current); if (drag.current) audioWorkspace.endGesture(true); }, []);
  useDismissSurface(dragging, () => finish(true), 150);
  const filters = draft.eqMode === 'peq' ? draft.peqFilters : bands.map((freq,i) => ({ id: `graphic-${i}`, type: 'PK' as const, freq, gain: gains[i], q: 1, enabled: true }));
  return <g ref={root} aria-label="Editable EQ bands">{filters.map((filter, index) => {
    if (filter.freq < (viewport.minFreq || 20) || filter.freq > (viewport.maxFreq || 20000)) return null;
    const selected = draft.selectedBand === filter.id;
    const gain = gainApplies(filter.type) ? filter.gain : 0;
    return <g key={filter.id} transform={`translate(${freqToX(filter.freq, viewport)},${dbToY(gain, viewport)})`}
      className="eq-handle" tabIndex={0} role="button" aria-label={`Band ${index+1}, ${filter.type}, ${Math.round(filter.freq)} Hz, ${gain} dB. Arrow keys edit frequency and gain; Page Up/Down edit Q; Delete removes; Escape cancels drag.`}
      onFocus={() => { if (!selected) audioWorkspace.update({ selectedBand: filter.id }, false); }}
      onPointerDown={e => {
        e.preventDefault(); e.stopPropagation(); e.currentTarget.focus();
        audioWorkspace.beginGesture();
        drag.current = { id: filter.id, index, pointer: e.pointerId, node: e.currentTarget, viewport: structuredClone(viewport) };
        e.currentTarget.setPointerCapture(e.pointerId); setDragging(true); onDragging(true);
      }}
      onPointerMove={e => {
        const d = drag.current; if (!d || d.pointer !== e.pointerId) return;
        e.stopPropagation();
        const svg = e.currentTarget.ownerSVGElement!, rect = svg.getBoundingClientRect(), v = d.viewport;
        const x = Math.max(v.padding.left, Math.min(v.width-v.padding.right, (e.clientX-rect.left)*v.width/rect.width));
        const y = Math.max(v.padding.top, Math.min(v.height-v.padding.bottom, (e.clientY-rect.top)*v.height/rect.height));
        const nextGain = Math.max(draft.eqMode === 'peq' ? -18 : -12, Math.min(draft.eqMode === 'peq' ? 18 : 12, Math.round(yToDb(y,v)*2)/2));
        pending.current = () => draft.eqMode === 'peq' ? onFilter(d.id, { freq: Math.round(Math.max(20, Math.min(20000,draft.sampleRate/2-1,xToFreq(x,v)))), ...(gainApplies(filter.type) ? { gain: nextGain } : {}) }) : onGain(d.index, nextGain);
        if (!frame.current) frame.current = requestAnimationFrame(() => { frame.current = 0; pending.current?.(); pending.current = null; });
      }}
      onPointerUp={() => finish()}
      onPointerCancel={() => finish(true)}
      onLostPointerCapture={() => { if (drag.current) finish(true); }}
      onKeyDown={e => {
        if (draft.eqMode === 'peq' && ['Delete','Backspace'].includes(e.key)) { e.preventDefault(); audioWorkspace.update({ peqFilters: draft.peqFilters.filter(f => f.id !== filter.id), selectedBand: null }); return; }
        if (draft.eqMode === 'peq' && ['PageUp','PageDown'].includes(e.key)) { e.preventDefault(); onFilter(filter.id, {q: Math.round(Math.max(.1,Math.min(20,filter.q * (e.key === 'PageUp' ? 1.1 : 1/1.1)))*100)/100}); return; }
        if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) return;
        e.preventDefault();
        const sign = ['ArrowLeft','ArrowDown'].includes(e.key) ? -1 : 1;
        if (draft.eqMode !== 'peq') { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') onGain(index, Math.max(-12,Math.min(12,gain+sign*(e.shiftKey ? 2 : .5)))); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') onFilter(filter.id, { freq: Math.round(Math.max(20,Math.min(20000,draft.sampleRate/2-1,filter.freq*2**(sign*(e.shiftKey ? 1/3 : 1/24))))) });
        else if (gainApplies(filter.type)) onFilter(filter.id, { gain: Math.max(-18,Math.min(18,gain+sign*(e.shiftKey ? 2 : .5))) });
      }}>
      <ellipse rx={hitRadius.x} ry={hitRadius.y} fill="transparent" />
      <circle r={selected ? 11 : 9} fill={selected ? '#eceef0' : '#262a2e'} stroke={filter.enabled === false ? '#888' : '#79aaff'} strokeWidth="2" />
      <text textAnchor="middle" y="3" fontSize="9" fill={selected ? '#101214' : '#eceef0'} style={{ pointerEvents: 'none' }}>{index+1}</text>
    </g>;
  })}</g>;
}
