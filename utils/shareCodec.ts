import { validateLabState, labStore } from '../store/labStore';
import { LabState, LabCurve, CurvePoint } from '../types';

interface EncodedCurve {
  id?: string; target?: boolean; pinned?: boolean; rig?: string; sourceUrl?: string; channel?: LabCurve['channel']; channels?: {left:[number,number][];right:[number,number][]};
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
  graphSettings?: LabState['graphSettings']; fitLimits?: LabState['fitLimits']; baselineId?: string|null; normalizationMode?: LabState['normalizationMode'];
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
  const customCurves = state.curves.filter((c) => !c.isTarget || (!c.id.startsWith('target-') && c.id !== 'crinacle-ief-2025-ref'));

  const encodedCurves: EncodedCurve[] = customCurves.map((c) => {
    let pts = c.points.map(
      (p) => [p.freq, Math.round(p.gain * 1000) / 1000] as [number, number],
    );

    // Stride downsample if points exceed 120
    if (pts.length > 120) {
      const stride = Math.ceil(pts.length / 120);
      pts = pts.filter((_, i) => i % stride === 0 || i === pts.length - 1);
    }

    return {
      id: c.id, target: c.isTarget, pinned: c.pinned, rig: c.rig, sourceUrl: c.sourceUrl, channel: c.channel,
      channels: c.channels ? { left: c.channels.left.filter((_,i,a)=>i%Math.ceil(a.length/120)===0||i===a.length-1).map(p=>[p.freq,p.gain]), right: c.channels.right.filter((_,i,a)=>i%Math.ceil(a.length/120)===0||i===a.length-1).map(p=>[p.freq,p.gain]) } : undefined,
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
    graphSettings:state.graphSettings,fitLimits:state.fitLimits,baselineId:state.baselineId,normalizationMode:state.normalizationMode,
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

    if(match[1].length > 2000000) return null;
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
      id: ec.id || `shared-curve-${i}-${Date.now()}`,
      isTarget: !!ec.target, pinned: !!ec.pinned, rig: ec.rig, sourceUrl: ec.sourceUrl, channel: ec.channel,
      channels: ec.channels ? {left:ec.channels.left.map(([freq,gain])=>({freq,gain})),right:ec.channels.right.map(([freq,gain])=>({freq,gain}))} : undefined,
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

    const settings = { graphSettings:payload.graphSettings,fitLimits:payload.fitLimits,baselineId:payload.baselineId,normalizationMode:payload.normalizationMode };
    if (!validateLabState({ ...labStore.getSnapshot(), ...settings, curves:restoredCurves, normDb:payload.norm?.[0]??0, normHz:payload.norm?.[1]??1000, smoothing:payload.smoothing||'RAW', fitSmoothing:payload.fitSmoothing||'RAW', fitNormalize:payload.fitNormalize??true, viewMode:payload.view||'rawFilter', zoomRange:payload.zoom||'full', targetCurveId:payload.targetId||'crinacle-ief-2025' })) return null;
    return {
      ...Object.fromEntries(Object.entries(settings).filter(([,v])=>v!==undefined)),
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
