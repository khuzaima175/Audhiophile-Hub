import { LabState, LabCurve, CurvePoint } from '../types';

interface EncodedCurve {
  n: string; // name
  c: string; // color
  p: string; // provenance
  pts: [number, number][]; // [freq, gain]
  off?: number; // offset
  filter?: boolean;
  sourceTarget?: string;
  inverted?: boolean;
  deltaCompensate?: boolean;
  visible?: boolean;
  solo?: boolean;
  absolute?: boolean;
}

interface EncodedLabPayload {
  v: number;
  norm: [number, number]; // [db, hz]
  zoom: string;
  targetId: string;
  delta: boolean;
  curves: EncodedCurve[];
  view?: LabState['viewMode'];
  smoothing?: LabState['smoothing'];
  fitSmoothing?: LabState['fitSmoothing'];
  fitNormalize?: boolean;
}

/**
 * Base64 URL encode utility
 */
const toBase64Url = (str: string): string => {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

/**
 * Base64 URL decode utility
 */
const fromBase64Url = (b64: string): string => {
  let str = b64.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  return decodeURIComponent(escape(atob(str)));
};

/**
 * Encode full Lab State into URL hash string
 */
export const encodeLabStateToUrl = (state: LabState): string => {
  const customCurves = state.curves.filter((c) => !c.isTarget);

  const encodedCurves: EncodedCurve[] = customCurves.map((c) => {
    let pts = c.points.map(
      (p) => [Math.round(p.freq * 10) / 10, Math.round(p.gain * 10) / 10] as [number, number],
    );

    // Stride downsample if points exceed 120
    if (pts.length > 120) {
      const stride = Math.ceil(pts.length / 120);
      pts = pts.filter((_, i) => i % stride === 0 || i === pts.length - 1);
    }

    return {
      n: c.name.slice(0, 40),
      c: c.color,
      p: c.provenance,
      off: c.offset !== 0 ? c.offset : undefined,
      filter: c.isFilterCurve,
      sourceTarget: c.sourceTargetId,
      inverted: c.isInverted,
      deltaCompensate: c.deltaCompensate,
      visible: c.visible,
      solo: c.solo,
      absolute: c.preserveAbsolute,
      pts,
    };
  });

  const payload: EncodedLabPayload = {
    v: 1,
    norm: [state.normDb, state.normHz],
    zoom: state.zoomRange,
    targetId: state.targetCurveId,
    delta: state.deltaMode,
    curves: encodedCurves,
    view: state.viewMode,
    smoothing: state.smoothing,
    fitSmoothing: state.fitSmoothing,
    fitNormalize: state.fitNormalize,
  };

  const jsonStr = JSON.stringify(payload);
  const base64 = toBase64Url(jsonStr);

  const baseUrl = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '';
  return `${baseUrl}#/lab?c=${base64}`;
};

/**
 * Decode URL hash string into Lab State
 */
export const decodeUrlToLabState = (hash: string): Partial<LabState> | null => {
  try {
    const match = hash.match(/c=([A-Za-z0-9_-]+)/);
    if (!match || !match[1]) return null;

    const jsonStr = fromBase64Url(match[1]);
    const payload: EncodedLabPayload = JSON.parse(jsonStr);

    if (!payload || payload.v !== 1 || !Array.isArray(payload.curves)) return null;
    if (
      payload.curves.some(
        (c) =>
          typeof c.n !== 'string' ||
          !Array.isArray(c.pts) ||
          c.pts.length < 2 ||
          c.pts.some(
            (p) => !Array.isArray(p) || !Number.isFinite(p[0]) || p[0] <= 0 || !Number.isFinite(p[1]),
          ),
      )
    )
      return null;

    const restoredCurves: LabCurve[] = (payload.curves || []).map((ec, i) => ({
      id: `shared-curve-${i}-${Date.now()}`,
      name: ec.n,
      color: ec.c || '#E7B87A',
      points: ec.pts.map(([freq, gain]) => ({ freq, gain })),
      provenance: (ec.p as any) || 'custom',
      provenanceDetails: 'Imported via AudioSage Share URL',
      pointsCount: ec.pts.length,
      offset: ec.off || 0,
      visible: ec.visible !== false,
      solo: !!ec.solo,
      isFilterCurve: !!ec.filter,
      sourceTargetId: ec.sourceTarget,
      isInverted: !!ec.inverted,
      deltaCompensate: !!ec.deltaCompensate,
      preserveAbsolute: !!ec.absolute,
    }));

    return {
      normDb: payload.norm?.[0] ?? 0.0,
      normHz: payload.norm?.[1] ?? 1000,
      zoomRange: (payload.zoom as any) || 'full',
      targetCurveId: payload.targetId || 'crinacle-ief-2025',
      deltaMode: !!payload.delta,
      viewMode: payload.view,
      smoothing: payload.smoothing || 'RAW',
      fitSmoothing: payload.fitSmoothing || 'RAW',
      fitNormalize: payload.fitNormalize ?? true,
      curves: restoredCurves,
      isOpen: true,
    };
  } catch (e) {
    console.warn('Failed to decode Lab share URL payload:', e);
    return null;
  }
};
