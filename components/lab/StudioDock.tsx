import React from 'react';
import { audioWorkspace, useAudioWorkspace } from '../../store/audioWorkspace';
import { PEQFilter, PEQFilterType } from '../../types';
import { gainApplies } from '../FilterHandles';
import { InfoHint } from '../InfoHint';

const TYPES: PEQFilterType[] = ['PK', 'LS', 'HS', 'HP', 'LP', 'NOTCH'];
const clamp = (value: number, min: number, max: number, fallback: number) => Math.max(min, Math.min(max, Number.isFinite(value) ? value : fallback));

export const hasActiveDraft = (draft: { workbenchState: string; dirty: boolean; peqFilters: PEQFilter[]; eqMode: string }) =>
  draft.workbenchState !== 'IDLE' || draft.dirty;

/** Adds a parametric band, asking before replacing a graphic-mode draft with a parametric one. */
export const addStudioBand = (freq = 1000, gain = 0) => {
  const draft = audioWorkspace.getSnapshot().draft;
  if (draft.eqMode !== 'peq' && draft.dirty && !window.confirm('Add a parametric band and switch from graphic mode? Graphic settings will be kept.')) return;
  const id = crypto.randomUUID();
  audioWorkspace.update({
    eqMode: 'peq',
    workbenchState: draft.workbenchState === 'IDLE' ? 'ADDING' : draft.workbenchState,
    peqFilters: [...draft.peqFilters, { id, type: 'PK', freq: Math.round(freq), gain: Math.round(gain * 2) / 2, q: 1.4, enabled: true }],
    selectedBand: id,
  });
};

interface StudioDockProps {
  onStart: () => void;
  onFullEditor: () => void;
}

/** Compact in-place EQ editor shown under the comparison graph so editing never hides the curves. */
export const StudioDock: React.FC<StudioDockProps> = ({ onStart, onFullEditor }) => {
  const { draft, undoCount, redoCount } = useAudioWorkspace();
  const active = hasActiveDraft(draft);
  const filters = draft.eqMode === 'peq' ? draft.peqFilters : [];
  const update = (id: string, patch: Partial<PEQFilter>) => audioWorkspace.update({ peqFilters: draft.peqFilters.map(f => f.id === id ? { ...f, ...patch } : f) });
  return (
    <section className="studio-dock" aria-label="Your EQ">
      <div className="studio-dock-header">
        <h2>Your EQ{active && draft.dirty ? <span className="studio-dock-dirty"> · unsaved</span> : null}
          <InfoHint label="About Your EQ">The green curve on the graph is the filter response of this draft. Double-click the graph to add a band. Use Full editor to save, apply to Windows, export or listen.</InfoHint>
        </h2>
        <div className="studio-dock-actions">
          {active ? <>
            <button type="button" className="secondary-button" disabled={!undoCount} onClick={() => audioWorkspace.undo()}>Undo</button>
            <button type="button" className="secondary-button" disabled={!redoCount} onClick={() => audioWorkspace.redo()}>Redo</button>
            <button type="button" className="secondary-button" onClick={() => addStudioBand()}>Add band</button>
          </> : <button type="button" className="secondary-button" onClick={onStart}>Start an EQ here</button>}
          <button type="button" className="secondary-button" onClick={onFullEditor}>Full editor · save &amp; apply</button>
        </div>
      </div>
      {!active && <p className="studio-dock-empty">Compare curves above, then start an EQ to shape them without leaving this view.</p>}
      {active && draft.eqMode !== 'peq' && <p className="studio-dock-empty">This draft uses a {draft.eqMode} graphic EQ. Edit its sliders in the Full editor, or add a parametric band here.</p>}
      {filters.length > 0 && <ol className="studio-band-list">
        {filters.map((f, index) => (
          <li key={f.id} className={draft.selectedBand === f.id ? 'selected' : ''} onClick={() => audioWorkspace.update({ selectedBand: f.id }, false)}>
            <span className="studio-band-number">{index + 1}</span>
            <select aria-label={`Band ${index + 1} type`} value={f.type} onChange={e => update(f.id, { type: e.target.value as PEQFilterType })}>{TYPES.map(t => <option key={t}>{t}</option>)}</select>
            <label>Hz<input aria-label={`Band ${index + 1} frequency`} type="number" min="20" max="20000" value={f.freq} onChange={e => update(f.id, { freq: clamp(Number(e.target.value), 20, 20000, 20) })} /></label>
            {gainApplies(f.type) && <label>dB<input aria-label={`Band ${index + 1} gain`} type="number" min="-18" max="18" step="0.5" value={f.gain} onChange={e => update(f.id, { gain: clamp(Number(e.target.value), -18, 18, 0) })} /></label>}
            <label>Q<input aria-label={`Band ${index + 1} Q`} type="number" min="0.1" max="20" step="0.1" value={f.q} onChange={e => update(f.id, { q: clamp(Number(e.target.value), 0.1, 20, 1) })} /></label>
            <label className="studio-band-on"><input aria-label={`Band ${index + 1} enabled`} type="checkbox" checked={f.enabled !== false} onChange={e => update(f.id, { enabled: e.target.checked })} />On</label>
            <button type="button" className="secondary-button" aria-label={`Remove band ${index + 1}`} onClick={() => audioWorkspace.update({ peqFilters: draft.peqFilters.filter(p => p.id !== f.id), selectedBand: null })}>✕</button>
          </li>
        ))}
      </ol>}
    </section>
  );
};
