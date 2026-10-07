import { ToneControls } from './ToneControls';
import { audioWorkspace, freshDraft, storeMeasurement, useAudioWorkspace } from '../store/audioWorkspace';
import { GraphControls, FitControls } from './GraphControls';
import { DEFAULT_GRAPH_SETTINGS, DEFAULT_FIT_LIMITS, frequencyTicks, channelPoints, meanDatum, curveColor } from '../utils/graphTools';
import { exportPlot } from '../utils/plotExport';
import { EQWorkbench } from './EQWorkbench';
import { useElementSize } from '../hooks/useElementSize';
import { useDismissSurface } from '../hooks/useDismissSurface';
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useLabStore, labStore } from '../store/labStore';
import { LabToolbar } from './lab/LabToolbar';
import { MeasurementCatalog } from './lab/MeasurementCatalog';
import { PerCurveRow } from './lab/PerCurveRow';
import { BandLabels } from './lab/BandLabels';
import {
  TARGET_CURVES,
  CRINGRAPH_FREQ_TICKS,
  getInterpolatedTargetGain,
  CurvePoint,
} from '../constants/targetCurves';
import {
  calculateAutoRangedYBounds,
  freqToX,
  xToFreq,
  dbToY,
  generateSvgPathFromPoints,
  ViewportDimensions,
  SYNTHESIS_FREQUENCIES,
} from '../utils/curveSynthesizer';
import { synthesizeAutoPeq } from '../utils/autoPeqGenerator';
import { parseMeasurementFile, smoothLogCurve } from '../utils/measurementParser';
import { useAudioEngine } from '../hooks/useAudioEngine';
import { useLiveTabCapture } from '../hooks/useLiveTabCapture';
import { LabCurve, EQPreset, GearItem } from '../types';
import Led from './ui/Led';
import Engraved from './ui/Engraved';
import { WaveformIcon } from './Icon';

interface GraphLabProps {
  presets: EQPreset[];
  gear: GearItem[];
  onSavePresets: (presets: EQPreset[]) => void;
}

export const GraphLab: React.FC<GraphLabProps> = ({ presets, gear, onSavePresets }) => {
  const labState = useLabStore();
  const { draft } = useAudioWorkspace();
  const [curveSearch, setCurveSearch] = useState('');
  const graphSettings = labState.graphSettings || DEFAULT_GRAPH_SETTINGS;
  const [panel, setPanel] = useState<'compare' | 'eq'>('compare');
  const plot = useElementSize();
  const openEditor = () => {
    audioWorkspace.update({ workbenchState: 'ADDING', graphView: 'filter' }, false);
    setPanel('eq');
  };
  const startManualEq = async () => {
    if (audioWorkspace.getSnapshot().draft.dirty && !window.confirm('Replace unfinished Audio work?')) return;
    const target = labState.curves.find(c => c.id === labState.targetCurveId && c.isTarget);
    const targetRef = target ? target.measurementRef || await storeMeasurement({name:target.name,rawPoints:target.points.map(p=>({...p,rawSpl:p.gain})),smoothedPoints:[],smoothing:'RAW',sampleCount:target.points.length,normOffset:0}) : null;
    const id = crypto.randomUUID();
    audioWorkspace.replace({ ...freshDraft(), workbenchState: 'ADDING', eqMode: 'peq',
      selectedTargetId: labState.targetCurveId, targetMeasurementRef: targetRef, selectedBand: id,
      peqFilters: [{ id, type: 'PK', freq: 1000, gain: 0, q: 1.4, enabled: true }] });
    setPanel('eq');
  };
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);
  useEffect(() => {
    const resize = () => setScreenWidth(window.innerWidth);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useDismissSurface(labState.isOpen, () => labStore.closeLab(), 10);

  // Audio Engine Hook for Audition Delta
  const [isBypassed, setIsBypassed] = useState(false);
  const audioEngine = useAudioEngine({
    isoBands: [],
    isoGains: [],
    peqFilters: [],
    isBypassed,
  });

  const {
    isCapturing,
    startTabCapture,
    stopTabCapture,
    showFeedbackGuard,
    confirmFeedbackGuard,
    dismissFeedbackGuard,
    error: captureError,
    isSupported: tabSupported,
  } = useLiveTabCapture({
    audioContext: audioEngine.audioContext,
    getAudioContext: audioEngine.getAudioContext,
    onStreamAvailable: (streamNode) => {
      audioEngine.playLiveTab(streamNode);
      showToast('Live Tab stream connected');
    },
    onStreamEnded: () => {
      audioEngine.stopAudio();
      showToast('Capture ended');
    },
  });

  useEffect(() => {
    if (panel === 'eq') { audioEngine.stopAudio(); if (isCapturing) stopTabCapture(); }
  }, [panel, audioEngine.stopAudio, isCapturing, stopTabCapture]);

  useDismissSurface(showFeedbackGuard, dismissFeedbackGuard, 50);
  const svgRef = useRef<SVGSVGElement>(null);
  const pendingChannels = useRef(new Map<string, { channel: string; id: string; points: CurvePoint[] }>());
  const targetInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active Target Curve
  const activeTarget = useMemo(() => {
    if (labState.targetCurveId === 'none') return null;
    return labState.curves.find(c => c.id === labState.targetCurveId && c.isTarget) || TARGET_CURVES.find((t) => t.id === labState.targetCurveId) || null;
  }, [labState.targetCurveId, labState.curves]);

  // Transform and normalize points for each curve with squig.link-grade datum alignment
  const displayCurves = useMemo(() => {
    const datum = (points: CurvePoint[]) => labState.normalizationMode === 'none' ? 0 : labState.normalizationMode === 'mean' ? meanDatum(points) : getInterpolatedTargetGain(labState.normHz, points);
    const level = labState.normalizationMode === 'none' ? 0 : labState.normDb;
    // 1. Calculate active target's datum gain at normHz (1000 Hz)
    const activeTargetNormGain = activeTarget
      ? datum(activeTarget.points)
      : 0;

    const expanded = labState.curves.flatMap(c => c.channel === 'both' && c.channels ? [{ ...c, id: c.id + '-left', name: c.name + ' L', channel: 'left' as const }, { ...c, id: c.id + '-right', name: c.name + ' R', channel: 'right' as const }] : [c]);
    const transformed = expanded.map((original) => {
      const curve = { ...original, points: channelPoints(original) };
      if (!curve.points.length) return { ...curve, displayPoints: [] };
      const normSupported = curve.points[0].freq <= labState.normHz && curve.points.at(-1)!.freq >= labState.normHz;
      if (labState.normalizationMode !== 'none' && labState.normalizationMode !== 'mean' && !normSupported && !curve.preserveAbsolute && (!curve.isFilterCurve || labState.viewMode !== 'rawFilter' || labState.deltaMode || curve.deltaCompensate)) return { ...curve, displayPoints: [] };
      const smoothed = curve.isTarget
        ? curve.points
        : smoothLogCurve(
            curve.points.map((p) => ({ ...p, rawSpl: p.gain })),
            labState.smoothing,
          );
      const isTargetCurve = curve.isTarget;
      const isFilter = curve.isFilterCurve;

      // Look up source target for filter curves (default to active target or IEF 2025)
      let sourceTarget = activeTarget;
      if (isFilter && curve.sourceTargetId) {
        const found = labState.curves.find(c => c.isTarget && c.id === curve.sourceTargetId) || TARGET_CURVES.find((t) => t.id === curve.sourceTargetId);
        if (found) sourceTarget = found;
      }
      if (!sourceTarget) {
        sourceTarget = TARGET_CURVES[0]; // Legacy inferred filter reference
      }

      // Pre-compute raw reconstructed IEM curve at all frequencies if it's a filter curve:
      // IEM_raw(f) = SourceTarget(f) - FilterCut(f)
      // Datum at normHz:
      const filterAtNormHz = datum(smoothed);
      const srcTargetAtNormHz = datum(sourceTarget.points);
      const reconstructedIemAtNormHz = srcTargetAtNormHz - filterAtNormHz;

      // Base anchor gain at normalization frequency for normal curves
      const curveNormGain = datum(curve.channels ? smoothLogCurve(channelPoints({ ...curve, channel: 'average' }).map(p => ({ ...p, rawSpl: p.gain })), labState.smoothing) : smoothed);

      const transformedPoints: CurvePoint[] = SYNTHESIS_FREQUENCIES.map((f) => {
        const rawGain = getInterpolatedTargetGain(f, smoothed);
        let dispGain = rawGain;

        if (curve.preserveAbsolute && !isTargetCurve) {
          const targetGain = activeTarget ? getInterpolatedTargetGain(f, activeTarget.points) - activeTargetNormGain + level : 0;
          dispGain = (curve.isInverted ? -rawGain : rawGain) + curve.offset - ((labState.deltaMode || curve.deltaCompensate) ? targetGain : 0);
        } else if (isTargetCurve) {
          // Target Curve: normalize to normDb at normHz (1000 Hz)
          // T_plot(f) = T(f) - T(normHz) + normDb
          const targetNorm = rawGain - datum(smoothed) + level;
          dispGain = labState.deltaMode ? 0 : targetNorm;
        } else if (labState.deltaMode && activeTarget) {
          // Global DELTA Mode: deviation from target
          if (isFilter) {
            // Reconstruct IEM relative to its own source target, normalize at normHz,
            // then take delta against the *active* target (may differ from source target)
            const srcTargetGain = getInterpolatedTargetGain(f, sourceTarget.points);
            const targetGain = getInterpolatedTargetGain(f, activeTarget.points);
            const iemPlot = srcTargetGain - rawGain - reconstructedIemAtNormHz + level;
            const targetPlot = targetGain - activeTargetNormGain + level;
            dispGain = iemPlot - targetPlot + curve.offset;
          } else {
            const targetGain = getInterpolatedTargetGain(f, activeTarget.points);
            const targetNorm = targetGain - activeTargetNormGain;
            const curveNorm = rawGain - curveNormGain;
            dispGain = curveNorm - targetNorm + curve.offset;
          }
        } else if (curve.deltaCompensate && activeTarget) {
          // Individual Delta Compensate
          if (isFilter) {
            const srcTargetGain = getInterpolatedTargetGain(f, sourceTarget.points);
            const targetGain = getInterpolatedTargetGain(f, activeTarget.points);
            const iemPlot = srcTargetGain - rawGain - reconstructedIemAtNormHz + level;
            const targetPlot = targetGain - activeTargetNormGain + level;
            dispGain = iemPlot - targetPlot + curve.offset;
          } else {
            const targetGain = getInterpolatedTargetGain(f, activeTarget.points);
            const targetNorm = targetGain - activeTargetNormGain;
            const curveNorm = rawGain - curveNormGain;
            dispGain = curveNorm - targetNorm + curve.offset;
          }
        } else if (isFilter) {
          // GraphicEQ / AutoEQ Filter Curves:
          const srcTargetGain = getInterpolatedTargetGain(f, sourceTarget.points);
          const netGain = srcTargetGain - srcTargetAtNormHz + level;
          const iemRaw = srcTargetGain - rawGain;
          const iemNormalized = iemRaw - reconstructedIemAtNormHz + level;

          if (labState.viewMode === 'rawFilter') {
            // "Filter Cuts" mode: shows raw cuts by default, flips to reconstructed if inverted
            dispGain = (curve.isInverted ? iemNormalized : rawGain) + curve.offset;
          } else if (labState.viewMode === 'netPostEq') {
            // "Post-EQ Net" mode: shows ideal equalized sound; if inverted, shows residual error vs active target
            const activeTargetGain = activeTarget
              ? getInterpolatedTargetGain(f, activeTarget.points) - activeTargetNormGain + level
              : netGain;
            const residualDelta = netGain - activeTargetGain;
            dispGain = (curve.isInverted ? residualDelta : netGain) + curve.offset;
          } else {
            // Default & "IEM vs Target": Reconstructs natural IEM response, flips to raw cuts if inverted
            dispGain = (curve.isInverted ? rawGain : iemNormalized) + curve.offset;
          }
        } else {
          // Standard Measured / AI-Estimate Curves:
          // Normalized to normDb at normHz (1000 Hz), inverts polarity if inverted
          const normalized = rawGain - curveNormGain + level;
          dispGain = (curve.isInverted ? -normalized : normalized) + curve.offset;
        }

        return { freq: f, gain: parseFloat(dispGain.toFixed(2)) };
      });

      return {
        ...curve,
        displayPoints: transformedPoints.filter(
          (p) => p.freq >= curve.points[0].freq && p.freq <= curve.points.at(-1)!.freq,
        ),
      };
    });
    const baseline = transformed.find(c => c.id === labState.baselineId);
    return !baseline ? transformed : transformed.map(c => ({ ...c, displayPoints: c.displayPoints.filter(p => p.freq >= (baseline.displayPoints[0]?.freq ?? Infinity) && p.freq <= (baseline.displayPoints.at(-1)?.freq ?? -Infinity)).map(p => ({ freq: p.freq, gain: p.gain - getInterpolatedTargetGain(p.freq, baseline.displayPoints) })) }));
  }, [
    labState.baselineId, labState.normalizationMode,
    labState.curves,
    labState.normDb,
    labState.normHz,
    labState.deltaMode,
    labState.viewMode,
    labState.smoothing,
    activeTarget,
  ]);

  const anySolo = useMemo(() => labState.curves.some((c) => c.solo), [labState.curves]);

  // Visible points for Auto-Ranging (focuses on solo'd curve + target if solo is active)
  const isTargetInVisible = useMemo(() => {
    return labState.curves.some((c) => c.isTarget && c.visible);
  }, [labState.curves]);

  const activeVisiblePointSets = useMemo(() => {
    return displayCurves
      .filter((c) => anySolo ? c.solo || (c.isTarget && c.visible) : c.visible)
      .map((c) => c.displayPoints);
  }, [displayCurves, anySolo]);

  const { minY, maxY, yTicks } = useMemo(() => {
    if (graphSettings.yRange) { const [minY, maxY] = graphSettings.yRange; const step = maxY-minY > 48 ? 12 : 6; return { minY, maxY, yTicks: Array.from({length:Math.floor(maxY/step)-Math.ceil(minY/step)+1},(_,i)=>(Math.ceil(minY/step)+i)*step) }; }
    return calculateAutoRangedYBounds(activeVisiblePointSets, isTargetInVisible);
  }, [activeVisiblePointSets, isTargetInVisible, graphSettings.yRange]);

  // Viewport with responsive zoom range
  const viewport: ViewportDimensions = useMemo(() => {
    const range = { full: [20, 20000], bass: [20, 250], mids: [250, 4000], treble: [4000, 20000] }[
      labState.zoomRange
    ] || [20, 20000];
    return {
      width: Math.max(260, plot.size.width || 960),
      height: Math.max(280, plot.size.height || 440),
      padding: { top: 28, right: screenWidth < 768 ? 14 : 28, bottom: 56, left: screenWidth < 768 ? 38 : 54 },
      minFreq: graphSettings.minFreq,
      maxFreq: graphSettings.maxFreq,
      minY,
      maxY,
    };
  }, [minY, maxY, graphSettings.minFreq, graphSettings.maxFreq, screenWidth, plot.size.width, plot.size.height]);

  // Paths
  const renderedPaths = useMemo(() => {
    return displayCurves.map((c) => {
      const lower = Math.max(viewport.minFreq!, c.displayPoints[0]?.freq ?? Infinity);
      const upper = Math.min(viewport.maxFreq!, c.displayPoints.at(-1)?.freq ?? -Infinity);
      const points =
        lower < upper
          ? [
              { freq: lower, gain: getInterpolatedTargetGain(lower, c.displayPoints) },
              ...c.displayPoints.filter((p) => p.freq > lower && p.freq < upper),
              { freq: upper, gain: getInterpolatedTargetGain(upper, c.displayPoints) },
            ]
          : [];
      return { ...c, path: generateSvgPathFromPoints(points, viewport, minY, maxY) };
    });
  }, [displayCurves, viewport, minY, maxY]);

  // Interactive Hover Point
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    freq: number;
    values: { name: string; db: number; color: string; isPrimary: boolean }[];
  } | null>(null);

  const incompatibleRigs = [...new Set(labState.curves.filter(c=>c.visible&&!c.isTarget&&!c.isFilterCurve).map(c=>c.rig).filter(Boolean))];
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg || !graphSettings.inspect) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = viewport.width / rect.width;
    const clientX = (e.clientX - rect.left) * scaleX;

    if (clientX >= viewport.padding.left && clientX <= viewport.width - viewport.padding.right) {
      const freq = xToFreq(clientX, viewport);
      const values = displayCurves
        .filter(
          (c) =>
            (anySolo ? c.solo || (c.isTarget && c.visible) : c.visible) &&
            c.displayPoints.length > 0 &&
            freq >= c.points[0].freq &&
            freq <= c.points.at(-1)!.freq,
        )
        .map((c) => ({
          name: c.name,
          db: parseFloat(getInterpolatedTargetGain(freq, c.displayPoints).toFixed(1)),
          color: c.color,
          isPrimary: c.id === labState.primaryCurveId,
        }))
        .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));

      const pointerY = (e.clientY-rect.top)*viewport.height/rect.height;
      values.sort((a,b)=>Math.abs(dbToY(a.db,viewport)-pointerY)-Math.abs(dbToY(b.db,viewport)-pointerY));
      if(e.type === 'pointerdown' && values[0]) { const curve=displayCurves.find(c=>c.name===values[0].name);if(curve)labStore.setPrimaryCurve(curve.id.replace(/-(left|right)$/,'')); }
      setHoveredPoint({ x: clientX, freq, values: values.slice(0,8) });
    } else {
      setHoveredPoint(null);
    }
  };

  // Audition Delta Synthesis State
  const [auditionResult, setAuditionResult] = useState<{
    rmsResidual: number;
    filterCount: number;
  } | null>(null);

  const handleSynthesizeAndAuditionDelta = () => {
    const curveA = labState.curves.find((c) => c.id === labState.auditionAId);
    const curveB =
      labState.curves.find((c) => c.id === labState.auditionBId) || labState.curves.find((c) => c.isTarget);

    if (!curveA || !curveB) {
      showToast('Select Curve A and Curve B for Audition Delta');
      return;
    }

    if (curveA.isFilterCurve || curveA.isTarget || curveA.provenance !== 'measured') { showToast('Choose a measured source for comparison EQ.'); return; }
    if (curveB.isFilterCurve || (!curveB.isTarget && curveB.provenance !== 'measured')) { showToast('Choose a measured destination or reference target.'); return; }
    try {
    // Fit original source arrays; display changes never affect analysis.
    const peqResult = synthesizeAutoPeq(smoothLogCurve(channelPoints(curveA).map(p => ({ ...p, rawSpl: p.gain })), labState.fitSmoothing || 'RAW'), channelPoints(curveB), {
      ...(labState.fitLimits || DEFAULT_FIT_LIMITS), normalize: labState.fitNormalize ?? true,
      sampleRate: audioEngine.audioContext?.sampleRate || 48000,
      smoothing: labState.fitSmoothing || 'RAW',
      maxFilters: 10,
      targetCurveId: 'audition-delta',
    });

    if (peqResult) {
      void audioEngine.loadExternalPeq(peqResult.filters, peqResult.preamp).catch(error => showToast(error.message));
      setAuditionResult({
        rmsResidual: parseFloat(peqResult.finalRms.toFixed(2)),
        filterCount: peqResult.filters.length,
      });
      showToast(
        `Audition Delta PEQ Loaded (${peqResult.filters.length} filters • RMS ${peqResult.finalRms}dB)`,
      );
    }
    } catch (e) { showToast((e as Error).message); }
  };

  useEffect(() => { setAuditionResult(null); audioEngine.stopAudio(); audioEngine.clearExternalPeq(); }, [labState.curves.map(c => c.id + JSON.stringify(c.points)).join('|'), labState.fitNormalize, labState.fitSmoothing, JSON.stringify(labState.fitLimits), labState.curves.map(c=>c.channel).join('|')]);

  // Auto-PEQ send to Workbench
  const handleSendAutoPeq = async (curve: LabCurve) => {
    if (!activeTarget || curve.provenance !== 'measured' || curve.isFilterCurve) { showToast('Generate correction requires a measured source and reference target.'); return; }
    if (audioWorkspace.getSnapshot().draft.dirty && !window.confirm('Replace unfinished Audio work with this correction?')) return;
    try {
      const target = labState.curves.find(c => c.id === labState.targetCurveId && c.isTarget);
      const targetRef = target ? target.measurementRef || await storeMeasurement({name:target.name,rawPoints:target.points.map(p=>({...p,rawSpl:p.gain})),smoothedPoints:[],smoothing:'RAW',sampleCount:target.points.length,normOffset:0}) : null;
      const measured = smoothLogCurve(channelPoints(curve).map(p => ({ ...p, rawSpl: p.gain })), labState.fitSmoothing || 'RAW');
      const result = synthesizeAutoPeq(measured, activeTarget.points, {
        ...(labState.fitLimits || DEFAULT_FIT_LIMITS), normalize: labState.fitNormalize ?? true, sampleRate: 48000, smoothing: labState.fitSmoothing || 'RAW', maxFilters: 10, targetCurveId: activeTarget.id,
      });
      const ref = await storeMeasurement({ name: curve.name, rawPoints: channelPoints(curve).map(p => ({ ...p, rawSpl: p.gain })), channels: curve.channels ? {left:curve.channels.left.map(p=>({...p,rawSpl:p.gain})),right:curve.channels.right.map(p=>({...p,rawSpl:p.gain}))} : undefined, smoothedPoints: [], normOffset: 0, sampleCount: curve.points.length, smoothing: 'RAW' });
      audioWorkspace.replace({ ...freshDraft(), dirty: true, eqMode: 'peq', peqFilters: result.filters, requestedPreamp: result.preamp, presetName: `${curve.name} Auto-PEQ`, hardwareAssigned: curve.name, selectedTargetId: activeTarget.id, measurementRef: ref, targetMeasurementRef: targetRef, fitLimits: labState.fitLimits || structuredClone(DEFAULT_FIT_LIMITS), workbenchState: 'ADDING', originalFit: result, smoothing: labState.fitSmoothing || 'RAW', normalize: labState.fitNormalize ?? true });
      setPanel('eq');
    } catch (e) { showToast((e as Error).message); }
  };

  const handleProcessFiles = async (files: File[], isTarget = false, context?: {url:string;rig:string}) => {
    let imported = 0;
    for (const file of files) {
      try {
        const parsed = parseMeasurementFile(await file.text(), file.name, 'RAW', labState.normHz);
        if (!parsed || parsed.rawPoints.length < 2 || (isTarget && parsed.isGraphicEQ)) throw new Error(`Could not read ${file.name}. Use frequency/dB measurement text or CSV.`);
        const raw = (points: typeof parsed.rawPoints) => points.map(p => ({ freq: p.freq, gain: p.rawSpl ?? p.gain }));
        const measurementRef = await storeMeasurement(parsed);
        const name = parsed.name || file.name.replace(/\.[^/.]+$/, '');
        const match = !isTarget && name.match(/^(.*?)\s+([LR])$/i);
        const pending = match ? pendingChannels.current.get(match[1]) : undefined;
        const existing = pending && match && pending.channel !== match[2].toUpperCase() && labStore.getSnapshot().curves.find(c => c.id === pending.id);
        const points = raw(parsed.rawPoints);
        if (existing && match) {
          const channels = match[2].toUpperCase() === 'L' ? { left: points, right: pending!.points } : { left: pending!.points, right: points };
          const average = channelPoints({ ...existing, channels, channel: 'average' });
          labStore.updateCurve(existing.id, { channels, points: average, channel: 'average', name: match[1], provenanceDetails: 'Imported left/right measurements paired by filename' });
          pendingChannels.current.delete(match[1]);
        } else {
          const channels = parsed.channels ? { left: raw(parsed.channels.left), right: raw(parsed.channels.right) } : undefined;
          const curve: LabCurve = { id: `custom-${crypto.randomUUID()}`, name, color: curveColor(labStore.getSnapshot().curves.length), sourceUrl: context?.url, rig: context?.rig, points, channels, channel: channels ? 'average' : undefined, measurementRef, provenance: isTarget ? 'target' : parsed.isGraphicEQ ? 'eq-compensated' : 'measured', provenanceDetails: `Imported ${file.name}${context ? ' • '+context.url : ''}${match ? ' • single channel; import the opposite L/R file to pair' : ''}`, pointsCount: points.length, offset: 0, visible: true, solo: false, isTarget, isFilterCurve: !!parsed.isGraphicEQ, sourceTargetId: parsed.isGraphicEQ ? labState.targetCurveId : undefined };
          labStore.addCurve(curve); labStore.setPrimaryCurve(curve.id);
          if (match) pendingChannels.current.set(match[1], { id: curve.id, channel: match[2].toUpperCase(), points });
          if (isTarget) labStore.setTargetCurveId(curve.id);
        }
        imported++;
      } catch (error) { showToast((error as Error).message); }
    }
    if (imported) showToast(`Imported ${imported} file${imported > 1 ? 's' : ''}`);
  };
  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); void handleProcessFiles(Array.from(e.dataTransfer.files)); };

  if (!labState.isOpen) return null;

  return (
    <div
      className="graph-lab fixed inset-0 z-50 flex flex-col text-audio-text overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Graph lab"
    >
      {labStore.getPersistenceError() && <p role="alert">{labStore.getPersistenceError()}</p>}
      {/* 1. TOP TOOLBAR */}
      <LabToolbar
        onToast={showToast}
        showComparisonControls={panel === 'compare'}
        onNewPreset={startManualEq}
        workspaceNavigation={<nav className="lab-view-tabs" aria-label="Graph Lab workspace views">
          <button className="secondary-button" aria-pressed={panel === 'compare'} onClick={() => setPanel('compare')}>Compare curves</button>
          <button className="secondary-button" aria-pressed={panel === 'eq' && draft.workbenchState !== 'IDLE'} onClick={openEditor}>Edit EQ {draft.dirty ? '•' : ''}</button>
          <button className="secondary-button" aria-pressed={panel === 'eq' && draft.workbenchState === 'IDLE'} onClick={() => { audioWorkspace.update({ workbenchState: 'IDLE' }, false); setPanel('eq'); }}>Presets ({presets.length})</button>
        </nav>}
        onExportCsv={() => {
          const rows = [`# Displayed data: mode=${labState.viewMode}; alignment=${labState.normalizationMode || "frequency"}; baseline=${labState.baselineId || "none"}; normalization=${labState.normDb}dB@${labState.normHz}Hz; smoothing=${labState.smoothing}; delta=${labState.deltaMode}. Per-curve offset/inversion/difference below.`, 'curve,frequency_hz,gain_db,offset_db,inverted,difference,provenance,preserve_absolute'];
          displayCurves
            .filter((c) => anySolo ? c.solo || (c.isTarget && c.visible) : c.visible)
            .forEach((c) =>
              c.displayPoints.forEach((p) =>
                rows.push(`"${c.name.replaceAll('"', '""')}",${p.freq},${p.gain},${c.offset},${!!c.isInverted},${!!c.deltaCompensate},${c.provenance},${!!c.preserveAbsolute}`),
              ),
            );
          const url = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }));
          const link = document.createElement('a');
          link.href = url;
          link.download = 'audiosage-graph.csv';
          link.click();
          URL.revokeObjectURL(url);
        }}
      />

      {/* 2. MAIN WORKSPACE */}
      {panel === 'eq' ? <main className="lab-eq-main">
        <EQWorkbench embeddedInLab presets={presets} gear={gear} onSavePresets={onSavePresets} onCompare={() => setPanel('compare')} />
      </main> : <div className="lab-workspace">
        {/* LEFT RAIL: Curve Manager & Audition Delta Engine */}
        <aside className="lab-sidebar flex flex-col gap-3">
          <div className="flex items-center justify-between pb-2 border-b border-audio-border/60">
            <Engraved size="xs" glow>
              Your curves ({labState.curves.length})
            </Engraved>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-2 py-1 rounded bg-audio-surface border border-audio-border text-[9.5px] font-mono text-audio-accent hover:border-audio-accent transition-all"
            >
              + Import file
            </button>
            <input
              ref={fileInputRef}
              aria-label="Import measurement files"
              type="file"
              multiple
              accept=".txt,.csv,.tsv"
              className="hidden"
              onChange={(e) => { const files = Array.from(e.target.files || []); e.target.value = ''; void handleProcessFiles(files); }}
            />
          </div>

          <label className="control-field">Search your curves<input type="search" value={curveSearch} onChange={e => setCurveSearch(e.target.value)} placeholder="Model, variant or target" /></label>
          <div className="graph-action-row">
            <button className="secondary-button" onClick={() => targetInputRef.current?.click()}>Import target</button>
            <button className="secondary-button" onClick={() => { try { labStore.averageVisible(); showToast('Created amplitude average of visible measurements'); } catch (error) { showToast((error as Error).message); } }}>Average visible</button>
            <button className="secondary-button" onClick={() => labStore.recolor()}>Recolor</button>
            <button className="secondary-button" onClick={() => labStore.clearUnpinned()}>Clear unpinned</button>
          </div>
          <input ref={targetInputRef} type="file" accept=".txt,.csv,.tsv" className="hidden" onChange={e => { const files = Array.from(e.target.files || []); e.target.value = ''; void handleProcessFiles(files, true); }} />
          <MeasurementCatalog onImport={(files, context) => handleProcessFiles(files, false, context)} />
          <GraphControls value={graphSettings} onChange={value => labStore.setGraphSettings(value)} />
          <FitControls value={labState.fitLimits || DEFAULT_FIT_LIMITS} onChange={value => labStore.setFitLimits(value)} />
          <div className="graph-action-row">{(['png','svg'] as const).map(format => <button key={format} className="secondary-button" onClick={() => { if (svgRef.current) void exportPlot(svgRef.current, 'audiosage-graph', format, `AudioSage • ${labState.normalizationMode || 'frequency'} normalization • ${labState.smoothing} • ${labState.normHz} Hz • ${labState.curves.filter(c=>c.visible).map(c=>c.name+' ('+c.provenance+')').join('; ')}`).catch(error => showToast(error.message)); }}>Export {format.toUpperCase()}</button>)}</div>
          {/* Drag & Drop Box */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            className="p-3 rounded-xl border border-dashed border-audio-border/70 bg-audio-surface text-center hover:border-audio-accent/60 transition-colors"
          >
            <p className="text-[10px] font-mono text-audio-muted">
              Drop squig.link / REW measurement CSV here
            </p>
          </div>

          <details className="section-disclosure lab-curves-panel" open={screenWidth >= 768}><summary>Curves</summary>
          <div className="space-y-2 pr-1">
            {labState.curves.filter(c => c.name.toLowerCase().includes(curveSearch.toLowerCase())).sort((a,b) => Number(!!b.pinned)-Number(!!a.pinned)).map((curve) => (
              <PerCurveRow
                key={curve.id}
                curve={curve}
                isPrimary={curve.id === labState.primaryCurveId}
                onSendAutoPeq={handleSendAutoPeq}
                onManualEq={startManualEq}
                onToast={showToast}
              />
            ))}
          </div>
          </details>
          {/* AUDITION DELTA PANEL (The Kill Shot) */}
          <details className="section-disclosure space-y-2.5">
            <summary>Listen to the difference</summary>
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5">
                <Led color="amber" pulse size="sm" />
                <span className="text-[10px] font-mono font-bold text-audio-accent uppercase tracking-wider">
                  Compare two curves
                </span>
              </div>
              <p className="text-[9px] font-mono text-audio-muted">
                Choose a starting curve and a destination, then try the EQ that matches them.
              </p>

              <div className="grid grid-cols-2 gap-1.5 text-[9.5px] font-mono">
                <div>
                  <label className="text-audio-muted/70 block mb-0.5">CURVE A:</label>
                  <select
                    aria-label="Comparison source"
                    value={labState.auditionAId || ''}
                    onChange={(e) => labStore.setAuditionPair(e.target.value, labState.auditionBId)}
                    className="w-full bg-audio-surface border border-audio-border/60 rounded px-1.5 py-1 text-audio-text focus:outline-none"
                  >
                    <option value="">Select Curve A</option>
                    {labState.curves.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-audio-muted/70 block mb-0.5">CURVE B:</label>
                  <select
                    aria-label="Comparison destination"
                    value={labState.auditionBId || ''}
                    onChange={(e) => labStore.setAuditionPair(labState.auditionAId, e.target.value)}
                    className="w-full bg-audio-surface border border-audio-border/60 rounded px-1.5 py-1 text-audio-text focus:outline-none"
                  >
                    <option value="">Target / Baseline</option>
                    {labState.curves.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSynthesizeAndAuditionDelta}
                className="w-full py-1.5 rounded-lg bg-audio-accent text-black font-mono font-bold text-xs hover:bg-audio-accent-bright transition-all shadow-glow-brass"
              >
                Generate comparison EQ
              </button>

              {auditionResult && (
                <div className="px-2 py-1 bg-audio-surface rounded border border-audio-signal/40 text-[9px] font-mono text-audio-signal flex items-center justify-between">
                  <span>RMS: {auditionResult.rmsResidual} dB</span>
                  <span>{auditionResult.filterCount} FILTERS ACTIVE</span>
                </div>
              )}

              <ToneControls active={audioEngine.activeSource === 'tone'} play={async frequency=>{if(isCapturing)stopTabCapture();await audioEngine.playTone(frequency);}} stop={audioEngine.stopAudio} onFrequency={audioEngine.setToneFrequency}/>
              <label className="control-field">Audition track<input type="file" accept="audio/*" onChange={e=>{const file=e.target.files?.[0];if(file){if(isCapturing)stopTabCapture();void audioEngine.handleFileUpload(file);}}}/></label>
              <label className="control-field">Listening volume<input aria-label="Comparison volume" type="range" min="0" max="1" step=".01" value={audioEngine.volume} onChange={e=>audioEngine.setVolume(Number(e.target.value))}/></label>
              <button className="secondary-button" onClick={()=>{audioEngine.stopAudio();if(isCapturing)stopTabCapture();}}>Stop playback</button>
              {/* Audition Playback Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (isCapturing) stopTabCapture();
                    void audioEngine.playPinkNoise();
                  }}
                  className={`px-2 py-1 rounded text-[9.5px] font-mono font-semibold border ${
                    audioEngine.isPlaying && audioEngine.activeSource === 'pink-noise'
                      ? 'bg-audio-signal text-black font-bold'
                      : 'bg-audio-surface border-audio-border text-audio-muted'
                  }`}
                >
                  ▶ Pink Noise
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (isCapturing) stopTabCapture();
                    void audioEngine.playSineSweep();
                  }}
                  className={`px-2 py-1 rounded text-[9.5px] font-mono font-semibold border ${
                    audioEngine.isPlaying && audioEngine.activeSource === 'sweep'
                      ? 'bg-audio-warn text-black font-bold'
                      : 'bg-audio-surface border-audio-border text-audio-muted'
                  }`}
                >
                  ▶ Sweep
                </button>
                <button
                  type="button"
                  onClick={() => (isCapturing ? stopTabCapture() : startTabCapture())}
                  disabled={!tabSupported}
                  className={`px-2 py-1 rounded text-[9.5px] font-mono font-semibold border ${
                    isCapturing
                      ? 'bg-audio-warn text-black font-bold'
                      : 'bg-audio-surface border-audio-border text-audio-muted'
                  }`}
                >
                  {isCapturing ? '■ Stop Tab' : '● Live Tab'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsBypassed(!isBypassed)}
                  className={`px-2 py-1 rounded text-[9.5px] font-mono font-bold border ${
                    isBypassed
                      ? 'bg-audio-warn text-black'
                      : 'bg-audio-surface border-audio-signal text-audio-signal'
                  }`}
                >
                  {isBypassed ? 'BYPASS' : 'A/B ON'}
                </button>
              </div>
            </div>
          </details>
        </aside>

        {/* CENTER & BOTTOM: SVG Canvas & Per-Curve Rows */}
        <main className="flex-1 flex flex-col overflow-hidden bg-audio-surface p-3 md:p-5 gap-3">
          {incompatibleRigs.length>1 && <p className="text-xs text-audio-muted">Different measurement rigs: {incompatibleRigs.join(", ")}. Direct differences may reflect the rig.</p>}
          {/* 3. MEASUREMENT-GRADE SVG CANVAS */}
          <div ref={plot.ref} className="lab-plot relative flex-1 w-full bg-audio-surface rounded-2xl border border-audio-border/90 shadow-panel overflow-hidden">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${viewport.width} ${viewport.height}`}
              className="w-full h-full block cursor-crosshair lab-compare-graph"
              aria-label="Comparison frequency response"
              role="img"
              onPointerMove={handleMouseMove}
              onPointerDown={handleMouseMove}
              onPointerLeave={(e) => {
                if (e.pointerType === 'mouse') setHoveredPoint(null);
              }}
            >
              {/* Decade Freq Grid */}
              {frequencyTicks(viewport).map(({ freq, label, major }) => {
                const x = freqToX(freq, viewport);
                return (
                  <g key={freq}>
                    <line
                      x1={x}
                      y1={viewport.padding.top}
                      x2={x}
                      y2={viewport.height - viewport.padding.bottom}
                      stroke={major ? '#343a40' : '#272d33'}
                      strokeWidth={major ? 1.0 : 0.6}
                      strokeDasharray={major ? undefined : '2 2'}
                    />
                    <text
                      data-axis="frequency"
                      x={x}
                      y={viewport.height - 22}
                      fill={major ? '#edf0ec' : '#9ba3ad'}
                      fontSize={major ? 12 : 11}
                      fontWeight={major ? 'bold' : 'normal'}
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      {label}
                    </text>
                  </g>
                );
              })}

              {/* dB Horizontal Grid */}
              {yTicks.map((db) => {
                const y = dbToY(db, viewport, minY, maxY);
                const isZero = db === 0;
                return (
                  <g key={db}>
                    <line
                      x1={viewport.padding.left}
                      y1={y}
                      x2={viewport.width - viewport.padding.right}
                      y2={y}
                      stroke={isZero ? '#565e68' : '#272d33'}
                      strokeWidth={isZero ? 1.2 : 0.6}
                      strokeDasharray={isZero ? undefined : '2 2'}
                    />
                    <text
                      x={viewport.padding.left - 6}
                      y={y + 3}
                      fill={isZero ? '#edf0ec' : '#9ba3ad'}
                      fontSize="12"
                      fontFamily="monospace"
                      textAnchor="end"
                      fontWeight={isZero ? 'bold' : 'normal'}
                    >
                      {db > 0 ? `+${db}` : db}
                    </text>
                  </g>
                );
              })}

              {/* Band Labels Strip */}
              <BandLabels viewport={viewport} />

              {/* Render Curves */}
              {renderedPaths
                .filter((c) => anySolo ? c.solo || (c.isTarget && c.visible) : c.visible)
                .map((c) => {
                  const isPrimary = c.id === labState.primaryCurveId;
                  return (
                    <path
                      key={c.id}
                      d={c.path}
                      fill="none"
                      stroke={c.color}
                      strokeWidth={c.isTarget ? 1.8 : isPrimary ? 3.0 : 2.2}
                      strokeDasharray={c.isTarget ? '4 3' : undefined}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={c.isTarget ? 0.85 : isPrimary ? 1.0 : 0.85}
                    />
                  );
                })}

              {graphSettings.showLabels && renderedPaths.filter(c => c.visible && c.displayPoints.length).slice(0, 10).map((c,i) => <text key={c.id} x={viewport.padding.left + 8} y={viewport.padding.top + 15 + i*17} fill={c.color} fontSize="12">{c.name.slice(0,30)}</text>)}
              {/* Multi-Curve Hover Tooltip */}
              {graphSettings.inspect && hoveredPoint &&
                (() => {
                  const freqLabel =
                    hoveredPoint.freq >= 1000
                      ? `${(hoveredPoint.freq / 1000).toFixed(1)}kHz`
                      : `${Math.round(hoveredPoint.freq)}Hz`;

                  const pillW = 175;
                  const pillH = 18 + hoveredPoint.values.length * 14;
                  const pillX = Math.min(
                    hoveredPoint.x + 10,
                    viewport.width - viewport.padding.right - pillW - 4,
                  );
                  const pillY = Math.max(viewport.padding.top + 4, 32);

                  return (
                    <g data-testid="graph-crosshair" pointerEvents="none">
                      <line
                        x1={hoveredPoint.x}
                        y1={viewport.padding.top}
                        x2={hoveredPoint.x}
                        y2={viewport.height - viewport.padding.bottom}
                        stroke="#edf0ec"
                        strokeWidth="0.8"
                        strokeDasharray="3 3"
                        opacity="0.45"
                      />

                      <rect
                        x={pillX}
                        y={pillY}
                        width={pillW}
                        height={pillH}
                        rx="6"
                        fill="#1a211c"
                        stroke="#382D24"
                        strokeWidth="1"
                        filter="drop-shadow(0 4px 14px rgba(0,0,0,0.85))"
                      />
                      <text
                        x={pillX + 9}
                        y={pillY + 13}
                        fill="#edf0ec"
                        fontSize="12"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        FREQ: {freqLabel}
                      </text>

                      {hoveredPoint.values.map((v, i) => (
                        <text
                          key={i}
                          x={pillX + 9}
                          y={pillY + 14 + (i + 1) * 14}
                          fill={v.color}
                          fontSize="12"
                          fontFamily="monospace"
                          fontWeight={v.isPrimary ? 'bold' : '600'}
                        >
                          <tspan>{v.name.slice(0, 16)}:</tspan>{' '}
                          <tspan fontWeight="bold">{v.db > 0 ? `+${v.db}` : v.db} dB</tspan>
                        </text>
                      ))}
                    </g>
                  );
                })()}
            </svg>
          </div>


        </main>
      </div>}

      {/* Toast */}
      {captureError && (
        <div className="storage-notice" role="alert">
          {captureError}
        </div>
      )}
      {showFeedbackGuard && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/80 p-5">
          <div
            className="panel p-6 max-w-md space-y-4"
            role="alertdialog"
            aria-modal="true"
            aria-label="Capture browser audio"
          >
            <h2 className="text-xl">Capture browser audio</h2>
            <p className="text-sm text-audio-muted">
              Choose a music or video tab and enable “Share tab audio”. Select a different tab from AudioSage
              to avoid audio feedback.
            </p>
            <div className="flex gap-3">
              <button className="secondary-button" onClick={dismissFeedbackGuard}>
                Cancel
              </button>
              <button className="primary-button" onClick={confirmFeedbackGuard}>
                Choose a tab
              </button>
            </div>
          </div>
        </div>
      )}
      {toastMessage && panel === 'compare' && (
        <div className="notification-area" role="status" aria-live="polite">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default GraphLab;
