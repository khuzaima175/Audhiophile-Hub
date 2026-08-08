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
      provenanceDetails: 'squig.link • B&K 5128 • 400 pts verbatim',
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
  primaryCurveId: null,
  auditionAId: null,
  auditionBId: null,
};

let state: LabState = { ...DEFAULT_STATE };
const listeners = new Set<() => void>();

const notify = () => {
  listeners.forEach((listener) => listener());
};

export const labStore = {
  getSnapshot: (): LabState => state,

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
    const target = state.curves.find((c) => c.id === id);
    const nextSolo = !target?.solo;

    state = {
      ...state,
      curves: state.curves.map((c) => {
        if (c.id === id) return { ...c, solo: nextSolo, visible: true };
        return { ...c, solo: false, visible: nextSolo ? (c.isTarget ? true : false) : true };
      }),
    };
    notify();
  },

  toggleDeltaCompensate: (id: string) => {
    state = {
      ...state,
      curves: state.curves.map((c) =>
        c.id === id ? { ...c, deltaCompensate: !c.deltaCompensate } : c
      ),
    };
    notify();
  },

  toggleInvertCurve: (id: string) => {
    state = {
      ...state,
      curves: state.curves.map((c) =>
        c.id === id ? { ...c, isInverted: !c.isInverted } : c
      ),
    };
    notify();
  },

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
    state = { ...state, ...newState, isOpen: true };
    notify();
  },

  resetAll: () => {
    state = { ...DEFAULT_STATE, isOpen: true };
    notify();
  },
};

export const useLabStore = (): LabState => {
  return useSyncExternalStore(labStore.subscribe, labStore.getSnapshot);
};
