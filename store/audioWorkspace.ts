import { validateStereoFilters } from '../utils/stereoEq';
import { DEFAULT_GRAPH_SETTINGS, DEFAULT_FIT_LIMITS, validateGraphSettings, validateFitLimits } from '../utils/graphTools';
import { useSyncExternalStore, Dispatch, SetStateAction } from 'react';
import { EQPreset, PEQFilter, MeasurementData, SmoothingType, AutoPeqFitResult, GraphSettings, AutoFitLimits, StereoFilters } from '../types';
import { parseImportedEQText } from '../utils/importExportParser';
export type EqMode = '10-band' | '15-band' | '31-band' | 'peq';
export interface AudioDraft {
  stereoFilters: StereoFilters|null; eqChannel:'left'|'right';
  graphSettings: GraphSettings; fitLimits: AutoFitLimits; targetMeasurementRef: string | null;
  version: 2; editingPresetId: string | null; presetName: string; hardwareAssigned: string; gearId: string | null;
  dirty: boolean; eqMode: EqMode; selectedTargetId: string; measurementRef: string | null;
  gains10: number[]; gains15: number[]; gains31: number[]; peqFilters: PEQFilter[]; selectedBand: string | null;
  requestedPreamp: number; preampMode: 'automatic' | 'manual'; sampleRate: number;
  graphView: 'iem' | 'filter' | 'compensated'; responseLevel: 'absolute' | 'shape';
  smoothing: SmoothingType; normalize: boolean; maxAutoFilters: number;
  workbenchState: 'IDLE' | 'ADDING' | 'IMPORTING' | 'MEASUREMENT'; originalFit: AutoPeqFitResult | null;
}
export const freshDraft = (): AudioDraft => ({
  stereoFilters:null,eqChannel:'left',
  graphSettings: structuredClone(DEFAULT_GRAPH_SETTINGS), fitLimits: structuredClone(DEFAULT_FIT_LIMITS), targetMeasurementRef: null,
  version: 2, editingPresetId: null, presetName: '', hardwareAssigned: '', gearId: null, dirty: false,
  eqMode: '10-band', selectedTargetId: 'crinacle-ief-2025', measurementRef: null,
  gains10: Array(10).fill(0), gains15: Array(15).fill(0), gains31: Array(31).fill(0),
  peqFilters: [], selectedBand: null, requestedPreamp: 0, preampMode: 'automatic', sampleRate: 48000,
  graphView: 'filter', responseLevel: 'absolute',
  smoothing: '1/3 OCT', normalize: true, maxAutoFilters: 10, workbenchState: 'IDLE', originalFit: null,
});
const KEY = 'audiosage_audio_draft_v2';
const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
export function validateDraft(d: any): d is AudioDraft {
  return (d?.stereoFilters===null||validateStereoFilters(d?.stereoFilters)) && ['left','right'].includes(d?.eqChannel) && (!d.stereoFilters || JSON.stringify(d.peqFilters)===JSON.stringify(d.stereoFilters[d.eqChannel])) && validateGraphSettings(d?.graphSettings) && validateFitLimits(d?.fitLimits) && (d.targetMeasurementRef === null || typeof d.targetMeasurementRef === 'string') && d?.version === 2 && Object.keys(d).every(k => k in freshDraft()) &&
    typeof d.dirty === 'boolean' && (d.gearId === null || typeof d.gearId === 'string') && (d.editingPresetId === null || typeof d.editingPresetId === 'string') && (d.selectedBand === null || typeof d.selectedBand === 'string') &&
    (d.originalFit === null || validateFit(d.originalFit)) && ['10-band','15-band','31-band','peq'].includes(d.eqMode) &&
    ['IDLE','ADDING','IMPORTING','MEASUREMENT'].includes(d.workbenchState) &&
    ['filter','iem','compensated'].includes(d.graphView) && ['absolute','shape'].includes(d.responseLevel) &&
    ['RAW','1/48 OCT','1/24 OCT','1/12 OCT','1/6 OCT','1/3 OCT'].includes(d.smoothing) && typeof d.normalize === 'boolean' &&
    typeof d.presetName === 'string' && typeof d.hardwareAssigned === 'string' && typeof d.selectedTargetId === 'string' &&
    (d.measurementRef === null || typeof d.measurementRef === 'string') &&
    [10,15,31].every(n => Array.isArray(d[`gains${n}`]) && d[`gains${n}`].length === n && d[`gains${n}`].every((v: any) => finite(v) && Math.abs(v) <= 18)) &&
    ['automatic','manual'].includes(d.preampMode) && finite(d.requestedPreamp) && Math.abs(d.requestedPreamp) <= 36 &&
    [44100,48000,96000].includes(d.sampleRate) && finite(d.maxAutoFilters) && d.maxAutoFilters >= 1 && d.maxAutoFilters <= 20 &&
    Array.isArray(d.peqFilters) && new Set(d.peqFilters.map((f: any) => f.id)).size === d.peqFilters.length &&
    d.peqFilters.every((f: any) => typeof f.id === 'string' && ['PK','LS','HS','HP','LP','NOTCH'].includes(f.type) && finite(f.freq) && f.freq >= 20 && f.freq <= 20000 && finite(f.gain) && Math.abs(f.gain) <= 36 && finite(f.q) && f.q > 0 && f.q <= 20 && (f.enabled === undefined || typeof f.enabled === 'boolean'));
}
function validateFit(r: any): boolean {
  return !!r && [r.preamp,r.initialRms,r.finalRms,r.matchPercentage].every(finite) && r.matchPercentage >= 0 && r.matchPercentage <= 100 &&
    Array.isArray(r.filters) && validateDraft({ ...freshDraft(), peqFilters: r.filters, originalFit: null }) &&
    [r.correctedPoints,r.residualPoints].every(points => Array.isArray(points) && points.length > 0 && points.every((p: any) => finite(p.freq) && p.freq > 0 && finite(p.gain)));
}
let draft = freshDraft(), error = '', blocked = false;
try {
  const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
  if (raw) { const parsed = JSON.parse(raw); if (parsed.version === 2) { parsed.stereoFilters ??= null; parsed.eqChannel ??= 'left'; parsed.graphView ??= 'filter'; parsed.responseLevel ??= 'absolute'; parsed.graphSettings ??= structuredClone(DEFAULT_GRAPH_SETTINGS); parsed.fitLimits ??= structuredClone(DEFAULT_FIT_LIMITS); parsed.targetMeasurementRef ??= null; } if (!validateDraft(parsed)) throw new Error('Unsupported or damaged Audio draft'); draft = parsed; }
} catch { error = 'Saved Audio draft could not be opened. Original data is preserved. Export a backup, then recover the draft or start fresh.'; blocked = true; }
let snapshot = { draft, error, undoCount: 0, redoCount: 0 };
const listeners = new Set<() => void>();
const undo: AudioDraft[] = [], redo: AudioDraft[] = [];
let gesture: AudioDraft | null = null;
const clone = (d: AudioDraft) => structuredClone(d);
function publish() {
  if (!blocked && !gesture) {
    try { localStorage.setItem(KEY, JSON.stringify(draft)); error = ''; }
    catch { error = 'Audio storage write failed. Work remains in memory. Export a backup before refreshing or retry saving.'; }
  }
  snapshot = { draft, error, undoCount: undo.length, redoCount: redo.length };
  listeners.forEach(l => l());
}
export const audioWorkspace = {
  getSnapshot: () => snapshot,
  subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
  update(patch: Partial<AudioDraft>, history = true) {
    if (history && !gesture) { undo.push(clone(draft)); if (undo.length > 60) undo.shift(); redo.length = 0; }
    if (patch.peqFilters && draft.stereoFilters && patch.stereoFilters === undefined) patch = { ...patch, stereoFilters: { ...draft.stereoFilters, [draft.eqChannel]: patch.peqFilters } };
    if (patch.eqChannel && draft.stereoFilters && patch.peqFilters === undefined) patch = { ...patch, peqFilters: draft.stereoFilters[patch.eqChannel], selectedBand: null, originalFit: null };
    const fitInputs = ['measurementRef','targetMeasurementRef','fitLimits','selectedTargetId','smoothing','normalize','maxAutoFilters','sampleRate','eqChannel'] as const;
    if (patch.originalFit === undefined && fitInputs.some(k => patch[k] !== undefined && patch[k] !== draft[k])) patch = { ...patch, originalFit: null };
    const contentChanged = Object.keys(patch).some(k => !['workbenchState','selectedBand','editingPresetId','dirty','graphView','responseLevel','graphSettings'].includes(k));
    draft = { ...draft, ...patch, dirty: patch.dirty ?? (contentChanged ? true : draft.dirty) };
    publish();
  },
  beginGesture() { if (!gesture) gesture = clone(draft); },
  endGesture(cancel = false) {
    if (!gesture) return;
    if (cancel) draft = gesture;
    else if (JSON.stringify(draft) !== JSON.stringify(gesture)) { undo.push(gesture); if (undo.length > 60) undo.shift(); redo.length = 0; }
    gesture = null; publish();
  },
  undo() { const previous = undo.pop(); if (previous) { redo.push(clone(draft)); draft = previous; publish(); } },
  redo() { const next = redo.pop(); if (next) { undo.push(clone(draft)); draft = next; publish(); } },
  replace(next: AudioDraft) { if (!validateDraft(next)) throw new Error('Invalid Audio draft'); undo.length = 0; redo.length = 0; draft = clone(next); publish(); },
  restoreValidatedDraft(next: AudioDraft) { if (!validateDraft(next)) throw new Error('Invalid recovery draft'); blocked = false; error = ''; this.replace(next); },
  retry() { publish(); },
  recoverFresh() { if (blocked) { const raw = localStorage.getItem(KEY); if (raw) localStorage.setItem(KEY + '_recovery', raw); } blocked = false; error = ''; this.replace(freshDraft()); },
  original() { return localStorage.getItem(KEY); },
};
export function useAudioWorkspace() { return useSyncExternalStore(audioWorkspace.subscribe, audioWorkspace.getSnapshot); }
export function useDraftField<K extends keyof AudioDraft>(key: K): [AudioDraft[K], Dispatch<SetStateAction<AudioDraft[K]>>] {
  const { draft } = useAudioWorkspace();
  return [draft[key], value => audioWorkspace.update({ [key]: typeof value === 'function' ? (value as (v: AudioDraft[K]) => AudioDraft[K])(audioWorkspace.getSnapshot().draft[key]) : value })];
}
let database: Promise<IDBDatabase> | undefined;
export function workspaceDatabase() {
  return database ||= new Promise((resolve, reject) => {
    const req = indexedDB.open('audiosage_audio_v2', 2);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains('records')) req.result.createObjectStore('records', { keyPath: 'id' }); if (!req.result.objectStoreNames.contains('comparison')) req.result.createObjectStore('comparison'); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { database = undefined; reject(new Error('Measurement storage unavailable')); };
  });
}
export interface MeasurementRecord { id: string; kind: 'measurement'; value: MeasurementData; }
export async function getMeasurementRecords(): Promise<MeasurementRecord[]> {
  const database = await workspaceDatabase();
  return new Promise((resolve, reject) => { const r = database.transaction('records').objectStore('records').getAll(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
}
export function validateMeasurementRecord(r: any): r is MeasurementRecord {
  return typeof r?.id === 'string' && r.kind === 'measurement' && typeof r.value?.name === 'string' &&
    ['RAW','1/48 OCT','1/24 OCT','1/12 OCT','1/6 OCT','1/3 OCT'].includes(r.value.smoothing) && finite(r.value.normOffset) &&
    Array.isArray(r.value.rawPoints) && r.value.rawPoints.length >= 2 &&
    (r.value.channels === undefined || (!!r.value.channels && ['left','right'].every(key=>Array.isArray(r.value.channels[key]) && r.value.channels[key].length>=2 && r.value.channels[key].every((p:any,i:number,a:any[])=>finite(p.freq)&&p.freq>0&&finite(p.gain)&&finite(p.rawSpl)&&(!i||p.freq>a[i-1].freq))))) &&
    r.value.rawPoints.every((p: any, i: number, a: any[]) => finite(p.freq) && p.freq > 0 && finite(p.gain) && finite(p.rawSpl) && (!i || p.freq > a[i-1].freq));
}
export async function writeMeasurementRecords(records: MeasurementRecord[]) {
  if (!records.every(validateMeasurementRecord) || new Set(records.map(r => r.id)).size !== records.length) throw new Error('Invalid or duplicate measurement records');
  const database = await workspaceDatabase();
  return new Promise<void>((resolve, reject) => { const tx = database.transaction('records','readwrite'); records.forEach(r => tx.objectStore('records').put(r)); tx.oncomplete = () => resolve(); tx.onerror = () => reject(new Error('Measurement storage write failed; existing records preserved')); tx.onabort = () => reject(new Error('Measurement write interrupted')); });
}
export async function storeMeasurement(value: MeasurementData) {
  const bytes = new TextEncoder().encode(JSON.stringify({ name: value.name, points: value.rawPoints, norm: value.normOffset }));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const id = 'measurement-' + Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
  await writeMeasurementRecords([{ id, kind: 'measurement', value }]);
  return id;
}
export function draftFromPreset(p: EQPreset): AudioDraft {
  const parsed = parseImportedEQText(p.bands);
  const mode = p.mode || parsed?.mode || (p.type === 'Parametric' ? 'peq' : '10-band');
  const d = { ...freshDraft(), editingPresetId: p.id, presetName: p.name, hardwareAssigned: p.hardware,
    stereoFilters: p.stereoFilters || parsed?.stereoFilters || null, eqChannel: p.eqChannel || 'left', gearId: p.gearId || null, eqMode: mode, selectedTargetId: p.targetCurveId || 'none', targetMeasurementRef: p.targetMeasurementRef || null, fitLimits: p.fitLimits || structuredClone(DEFAULT_FIT_LIMITS), measurementRef: p.measurementRef || null,
    peqFilters: structuredClone(p.stereoFilters?.[p.eqChannel || 'left'] || parsed?.stereoFilters?.left || p.peqFilters || parsed?.peqFilters || []), requestedPreamp: p.requestedPreamp ?? p.preamp ?? parsed?.preamp ?? 0,
    preampMode: p.preampMode || 'manual', sampleRate: p.sampleRate || 48000, workbenchState: 'ADDING',
    smoothing: p.analysis?.smoothing || '1/3 OCT', normalize: p.analysis?.normalize ?? true,
  } as AudioDraft;
  if (mode !== 'peq') d[mode === '31-band' ? 'gains31' : mode === '15-band' ? 'gains15' : 'gains10'] = [...(p.graphicGains || parsed?.graphicGains || Array(parseInt(mode)).fill(0))];
  if (!validateDraft(d)) throw new Error('Preset has unsupported values. Export its original text for recovery.');
  return d;
}
