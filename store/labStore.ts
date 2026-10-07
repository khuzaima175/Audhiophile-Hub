import { workspaceDatabase } from './audioWorkspace';
import { useSyncExternalStore } from 'react';
import { LabCurve, LabState, LabZoomRange, SmoothingType, CurvePoint } from '../types';
import { TARGET_CURVES, CRINACLE_IEF_2025_POINTS } from '../constants/targetCurves';

const DEFAULT_TARGET_ID = 'crinacle-ief-2025';

const DEFAULT_STATE: LabState = {
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
    let updatedCurves = state.curves.filter((c) => !c.isTarget);

    if (foundTarget && targetId !== 'none') {
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
    state = { ...state, zoomRange };
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
    state = { ...state, ...newState, isOpen: newState.isOpen ?? true };
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
  return !!s && typeof s.isOpen === 'boolean' && typeof s.targetCurveId === 'string' &&
    Number.isFinite(s.normDb) && Number.isFinite(s.normHz) && s.normHz >= 20 && s.normHz <= 20000 &&
    ['full','bass','mids','treble'].includes(s.zoomRange) && ['RAW','1/6 OCT','1/3 OCT'].includes(s.smoothing) &&
    typeof s.deltaMode === 'boolean' &&
    (s.fitSmoothing === undefined || ['RAW','1/6 OCT','1/3 OCT'].includes(s.fitSmoothing)) &&
    (s.fitNormalize === undefined || typeof s.fitNormalize === 'boolean') && ['reconstructed','rawFilter','netPostEq'].includes(s.viewMode || 'rawFilter') &&
    Array.isArray(s.curves) && new Set(s.curves.map((c:any)=>c.id)).size === s.curves.length && s.curves.every((c:any) =>
      typeof c.id === 'string' && typeof c.name === 'string' && typeof c.color === 'string' && Number.isFinite(c.offset) && Math.abs(c.offset) <= 12 &&
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
