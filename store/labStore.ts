import { DEFAULT_GRAPH_SETTINGS, DEFAULT_FIT_LIMITS, validateGraphSettings, validateFitLimits, averageCurves, channelPoints, curveColor } from '../utils/graphTools';
import { workspaceDatabase } from './audioWorkspace';
import { useSyncExternalStore } from 'react';
import { LabCurve, LabState, LabZoomRange, SmoothingType, CurvePoint } from '../types';
import { TARGET_CURVES, CRINACLE_IEF_2025_POINTS } from '../constants/targetCurves';

const DEFAULT_TARGET_ID = 'crinacle-ief-2025';

const DEFAULT_STATE: LabState = {
  graphSettings: structuredClone(DEFAULT_GRAPH_SETTINGS), fitLimits: structuredClone(DEFAULT_FIT_LIMITS), normalizationMode: 'frequency', baselineId: null,
  isOpen: false,
  curves: [
    {
      id: 'crinacle-ief-2025-ref',
      name: 'Crinacle IEF 2025 Target',
      color: '#6FC9A6',
      points: CRINACLE_IEF_2025_POINTS,
      provenance: 'target',
      provenanceDetails: 'Bundled target approximation; numerical source not independently verified',
      pointsCount: 400,
      offset: 0,
      visible: true,
      solo: false,
      isReference: true,
      isTarget: true,
    },
  ],
  targetCurveId: DEFAULT_TARGET_ID,
  normDb: 0.0,
  normHz: 1000,
  zoomRange: 'full',
  smoothing: 'RAW',
  deltaMode: false,
  viewMode: 'rawFilter',
  fitSmoothing: 'RAW',
  fitNormalize: true,
  primaryCurveId: null,
  auditionAId: null,
  auditionBId: null,
};

let state: LabState = { ...DEFAULT_STATE };
const listeners = new Set<() => void>();

let persistenceTimer: ReturnType<typeof setTimeout>;
let persistenceError = '';
let hydrationComplete = false;
const notify = () => {
  clearTimeout(persistenceTimer);
  if (hydrationComplete) persistenceTimer = setTimeout(() => { persistComparison(state).catch(() => { persistenceError = 'Comparison storage write failed. Export a backup before refreshing.'; state = { ...state }; listeners.forEach(l=>l()); }); }, 250);
  listeners.forEach((listener) => listener());
};

export const labStore = {
  getSnapshot: (): LabState => state,
  getPersistenceError: () => persistenceError,
  enablePersistence: () => { hydrationComplete = true; persistenceError = ''; notify(); },
  reportRecoveryError: (message: string) => { persistenceError = message; state = { ...state }; listeners.forEach(l => l()); },

  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  openLab: (initialCurves?: LabCurve[], targetId?: string) => {
    let updatedCurves = [...state.curves];
    if (initialCurves && initialCurves.length > 0) {
      // Merge initial curves avoiding duplicate IDs
      initialCurves.forEach((newC) => {
        const idx = updatedCurves.findIndex((c) => c.id === newC.id || c.name === newC.name);
        if (idx >= 0) {
          updatedCurves[idx] = { ...updatedCurves[idx], ...newC, visible: true };
        } else {
          updatedCurves.push(newC);
        }
      });
    }

    state = {
      ...state,
      isOpen: true,
      curves: updatedCurves,
      targetCurveId: targetId || state.targetCurveId,
      primaryCurveId: initialCurves?.[0]?.id || state.primaryCurveId || updatedCurves[0]?.id || null,
    };
    if (typeof window !== 'undefined' && !window.location.hash.startsWith('#/lab')) {
      window.location.hash = '#/lab';
    }
    notify();
  },

  closeLab: () => {
    state = { ...state, isOpen: false };
    if (typeof window !== 'undefined' && window.location.hash.startsWith('#/lab')) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    notify();
  },

  setIsOpen: (isOpen: boolean) => {
    state = { ...state, isOpen };
    if (typeof window !== 'undefined') {
      if (isOpen && !window.location.hash.startsWith('#/lab')) {
        window.location.hash = '#/lab';
      } else if (!isOpen && window.location.hash.startsWith('#/lab')) {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
    notify();
  },

  addCurve: (curve: LabCurve) => {
    const existingIdx = state.curves.findIndex((c) => c.id === curve.id);
    let updated: LabCurve[];
    if (existingIdx >= 0) {
      updated = [...state.curves];
      updated[existingIdx] = curve;
    } else {
      updated = [...state.curves, curve];
    }
    state = {
      ...state,
      curves: updated,
      primaryCurveId: state.primaryCurveId || curve.id,
    };
    notify();
  },

  removeCurve: (id: string) => {
    // Keep at least one curve or targets
    const curveToRemove = state.curves.find((c) => c.id === id);
    if (curveToRemove?.isTarget && state.curves.filter((c) => c.isTarget).length <= 1) {
      return; // Do not delete the primary target
    }
    const updated = state.curves.filter((c) => c.id !== id);
    state = {
      ...state,
      curves: updated,
      primaryCurveId: state.primaryCurveId === id ? updated[0]?.id || null : state.primaryCurveId,
      baselineId: state.baselineId === id ? null : state.baselineId,
      auditionAId: state.auditionAId === id ? null : state.auditionAId,
      auditionBId: state.auditionBId === id ? null : state.auditionBId,
    };
    notify();
  },

  toggleVisibility: (id: string) => {
    state = {
      ...state,
      curves: state.curves.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c)),
    };
    notify();
  },

  toggleSolo: (id: string) => {
    const nextSolo = !state.curves.find(c => c.id === id)?.solo;
    state = { ...state, curves: state.curves.map(c => ({ ...c, solo: c.id === id && nextSolo })) };
    notify();
  },

  toggleDeltaCompensate: (id: string) => {
    state = {
      ...state,
      curves: state.curves.map((c) => (c.id === id ? { ...c, deltaCompensate: !c.deltaCompensate } : c)),
    };
    notify();
  },

  toggleInvertCurve: (id: string) => {
    state = {
      ...state,
      curves: state.curves.map((c) => (c.id === id ? { ...c, isInverted: !c.isInverted } : c)),
    };
    notify();
  },

  updateCurve: (id: string, patch: Partial<LabCurve>) => { state={...state,curves:state.curves.map(c=>c.id===id?{...c,...patch,id:c.id}:c)};notify(); },
  setGraphSettings: (graphSettings: NonNullable<LabState['graphSettings']>) => { if(!validateGraphSettings(graphSettings))return;state={...state,graphSettings};notify(); },
  setFitLimits: (fitLimits: NonNullable<LabState['fitLimits']>) => { if(!validateFitLimits(fitLimits))return;state={...state,fitLimits};notify(); },
  setNormalizationMode: (normalizationMode: NonNullable<LabState['normalizationMode']>) => { state={...state,normalizationMode};notify(); },
  setBaseline: (baselineId: string|null) => { state={...state,baselineId};notify(); },
  recolor: () => { state={...state,curves:state.curves.map((c,i)=>c.pinned?c:{...c,color:curveColor(i)})};notify(); },
  clearUnpinned: () => { const curves=state.curves.filter(c=>c.isTarget||c.pinned);state={...state,curves,primaryCurveId:curves[0]?.id||null,baselineId:curves.some(c=>c.id===state.baselineId)?state.baselineId:null};notify(); },
  averageVisible: () => { const curves=state.curves.filter(c=>c.visible&&!c.isTarget&&!c.isFilterCurve);if(curves.length<2)throw new Error('Show at least two acoustic curves to average');const points=averageCurves(curves.map(channelPoints));labStore.addCurve({id:crypto.randomUUID(),name:'Average of '+curves.map(c=>c.name).join(', '),points,provenance:curves.every(c=>c.provenance==='measured')?'measured':'custom',provenanceDetails:'Derived linear-amplitude average over common support; '+curves.map(c=>c.name).join(', '),rig:curves.every(c=>c.rig===curves[0].rig)?curves[0].rig:undefined,color:curveColor(state.curves.length),offset:0,visible:true,solo:false}); },
  setFitSettings: (fitSmoothing: SmoothingType, fitNormalize: boolean) => { state = { ...state, fitSmoothing, fitNormalize }; notify(); },

  setViewMode: (viewMode: 'reconstructed' | 'rawFilter' | 'netPostEq') => {
    state = { ...state, viewMode };
    notify();
  },

  setOffset: (id: string, offset: number) => {
    state = {
      ...state,
      curves: state.curves.map((c) => (c.id === id ? { ...c, offset } : c)),
    };
    notify();
  },

  setPrimaryCurve: (id: string) => {
    state = { ...state, primaryCurveId: id };
    notify();
  },

  setTargetCurveId: (targetId: string) => {
    const foundTarget = TARGET_CURVES.find((t) => t.id === targetId);
    let updatedCurves = state.curves.filter((c) => !c.isTarget || (!!c.measurementRef || (!c.id.startsWith('target-') && c.id !== 'crinacle-ief-2025-ref'))).map(c=>c.isTarget?{...c,visible:c.id===targetId}:c);
    const customTarget = updatedCurves.find(c=>c.isTarget && c.id===targetId);

    if (foundTarget && !customTarget && targetId !== 'none') {
      updatedCurves.unshift({
        id: `target-${foundTarget.id}`,
        name: foundTarget.shortName,
        color: foundTarget.color,
        points: foundTarget.points,
        provenance: 'target',
        provenanceDetails: foundTarget.provenance || 'Official Acoustic Benchmark',
        pointsCount: foundTarget.pointsCount || foundTarget.points.length,
        offset: 0,
        visible: true,
        solo: false,
        isReference: true,
        isTarget: true,
      });
    }

    state = {
      ...state,
      targetCurveId: targetId,
      curves: updatedCurves,
    };
    notify();
  },

  setNormalize: (normDb: number, normHz: number) => {
    state = { ...state, normDb, normHz };
    notify();
  },

  setZoomRange: (zoomRange: LabZoomRange) => {
    const ranges={full:[20,20000],bass:[20,250],mids:[250,4000],treble:[4000,20000]};const r=ranges[zoomRange];
    state = { ...state, zoomRange, graphSettings:{...(state.graphSettings||DEFAULT_GRAPH_SETTINGS),minFreq:r[0],maxFreq:r[1]} };
    notify();
  },

  setSmoothing: (smoothing: SmoothingType) => {
    state = { ...state, smoothing };
    notify();
  },

  setDeltaMode: (deltaMode: boolean) => {
    state = { ...state, deltaMode };
    notify();
  },

  setAuditionPair: (auditionAId: string | null, auditionBId: string | null) => {
    state = { ...state, auditionAId, auditionBId };
    notify();
  },

  loadState: (newState: Partial<LabState>) => {
    state = { ...state, ...newState, graphSettings: newState.graphSettings || {...structuredClone(DEFAULT_GRAPH_SETTINGS),minFreq:({full:20,bass:20,mids:250,treble:4000})[newState.zoomRange || 'full'],maxFreq:({full:20000,bass:250,mids:4000,treble:20000})[newState.zoomRange || 'full']}, fitLimits: newState.fitLimits || structuredClone(DEFAULT_FIT_LIMITS), normalizationMode: newState.normalizationMode || 'frequency', isOpen: newState.isOpen ?? true };
    if (!state.curves.some((c) => c.id === state.primaryCurveId))
      state = { ...state, primaryCurveId: state.curves.find((c) => !c.isTarget)?.id || null };
    if (state.targetCurveId !== 'none' && !state.curves.some(c => c.isTarget)) labStore.setTargetCurveId(state.targetCurveId);
    else notify();
  },

  resetAll: () => {
    state = { ...DEFAULT_STATE, isOpen: true };
    notify();
  },
};

export const useLabStore = (): LabState => {
  return useSyncExternalStore(labStore.subscribe, labStore.getSnapshot);
};

export function validateLabState(s: any): s is LabState {
  return (s?.graphSettings===undefined||validateGraphSettings(s.graphSettings)) && (s?.fitLimits===undefined||validateFitLimits(s.fitLimits)) && (s?.normalizationMode===undefined||['frequency','mean','none'].includes(s.normalizationMode)) && (s?.baselineId===undefined||s.baselineId===null||typeof s.baselineId==='string') && !!s && typeof s.isOpen === 'boolean' && typeof s.targetCurveId === 'string' &&
    Number.isFinite(s.normDb) && Number.isFinite(s.normHz) && s.normHz >= 20 && s.normHz <= 20000 &&
    ['full','bass','mids','treble'].includes(s.zoomRange) && ['RAW','1/48 OCT','1/24 OCT','1/12 OCT','1/6 OCT','1/3 OCT'].includes(s.smoothing) &&
    typeof s.deltaMode === 'boolean' &&
    (s.fitSmoothing === undefined || ['RAW','1/48 OCT','1/24 OCT','1/12 OCT','1/6 OCT','1/3 OCT'].includes(s.fitSmoothing)) &&
    (s.fitNormalize === undefined || typeof s.fitNormalize === 'boolean') && ['reconstructed','rawFilter','netPostEq'].includes(s.viewMode || 'rawFilter') &&
    Array.isArray(s.curves) && new Set(s.curves.map((c:any)=>c.id)).size === s.curves.length && s.curves.every((c:any) =>
      typeof c.id === 'string' && typeof c.name === 'string' && typeof c.color === 'string' && Number.isFinite(c.offset) && Math.abs(c.offset) <= 12 &&
      (c.pinned===undefined||typeof c.pinned==='boolean') && (c.rig===undefined||typeof c.rig==='string') && (c.channels===undefined||(!!c.channels&&typeof c.channels==='object'&&['left','right'].every(k=>Array.isArray(c.channels[k])&&c.channels[k].length>=2&&c.channels[k].every((p:any,i:number,a:any[])=>Number.isFinite(p.freq)&&p.freq>0&&Number.isFinite(p.gain)&&(!i||p.freq>a[i-1].freq))))) && (c.channels===undefined || (Math.max(c.channels.left[0].freq,c.channels.right[0].freq)<Math.min(c.channels.left.at(-1).freq,c.channels.right.at(-1).freq))) && (c.channel===undefined||['average','left','right','both'].includes(c.channel)) &&
      typeof c.visible === 'boolean' && typeof c.solo === 'boolean' && ['measured','target','ai-estimate','eq-compensated','custom'].includes(c.provenance) &&
      Array.isArray(c.points) && c.points.length >= 2 && c.points.every((p:any,i:number,a:any[])=>Number.isFinite(p.freq) && p.freq>0 && Number.isFinite(p.gain) && (!i || p.freq>a[i-1].freq)));
}
export async function persistComparison(value: LabState) {
  if (!validateLabState(value)) throw new Error('Invalid comparison session');
  const db = await workspaceDatabase();
  return new Promise<void>((resolve,reject)=>{ const tx=db.transaction('comparison','readwrite'); tx.objectStore('comparison').put(value,'active'); tx.oncomplete=()=>{ persistenceError=''; resolve(); }; tx.onerror=()=>reject(new Error('Comparison write failed')); tx.onabort=()=>reject(new Error('Comparison write interrupted')); });
}
export async function readComparison(): Promise<LabState | null> {
  const db = await workspaceDatabase();
  return new Promise((resolve,reject)=>{ const r=db.transaction('comparison').objectStore('comparison').get('active'); r.onsuccess=()=>{ if (!r.result) resolve(null); else if (validateLabState(r.result)) resolve(r.result); else reject(new Error('Saved comparison has unsupported data. Restore a valid backup.')); }; r.onerror=()=>reject(new Error('Comparison storage unavailable')); });
}

export async function readComparisonRaw(): Promise<unknown> {
  const db = await workspaceDatabase();
  return new Promise((resolve,reject)=>{ const r=db.transaction('comparison').objectStore('comparison').get('active'); r.onsuccess=()=>resolve(r.result || null); r.onerror=()=>reject(new Error('Comparison storage unavailable')); });
}
export async function writeRestoreRecovery(recovery: unknown) {
  const db = await workspaceDatabase();
  return new Promise<void>((resolve,reject)=>{ const tx=db.transaction('comparison','readwrite'); tx.objectStore('comparison').put(recovery,'restore-recovery'); tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(new Error('Recovery staging failed; live data unchanged')); tx.onabort=()=>reject(new Error('Recovery staging interrupted; live data unchanged')); });
}
export async function readRestoreRecovery(): Promise<unknown> {
  const db = await workspaceDatabase();
  return new Promise((resolve,reject)=>{ const r=db.transaction('comparison').objectStore('comparison').get('restore-recovery'); r.onsuccess=()=>resolve(r.result || null); r.onerror=()=>reject(new Error('Recovery storage unavailable')); });
}
