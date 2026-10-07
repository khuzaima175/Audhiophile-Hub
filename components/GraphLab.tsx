import { audioWorkspace, freshDraft, storeMeasurement } from '../store/audioWorkspace';
import { useDismissSurface } from '../hooks/useDismissSurface';
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useLabStore, labStore } from '../store/labStore';
import { LabToolbar } from './lab/LabToolbar';
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
import { LabCurve, EQPreset } from '../types';
import Led from './ui/Led';
import Engraved from './ui/Engraved';
import { WaveformIcon } from './Icon';

interface GraphLabProps {
  onSavePreset?: (preset: EQPreset) => void;
  onOpenEditor?: () => void;
}

export const GraphLab: React.FC<GraphLabProps> = ({ onSavePreset, onOpenEditor }) => {
  const labState = useLabStore();
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

  useDismissSurface(showFeedbackGuard, dismissFeedbackGuard, 50);
  const svgRef = useRef<SVGSVGElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active Target Curve
  const activeTarget = useMemo(() => {
    if (labState.targetCurveId === 'none') return null;
    return TARGET_CURVES.find((t) => t.id === labState.targetCurveId) || TARGET_CURVES[0];
  }, [labState.targetCurveId]);

  // Transform and normalize points for each curve with squig.link-grade datum alignment
  const displayCurves = useMemo(() => {
    // 1. Calculate active target's datum gain at normHz (1000 Hz)
    const activeTargetNormGain = activeTarget
      ? getInterpolatedTargetGain(labState.normHz, activeTarget.points)
      : 0;

    return labState.curves.map((curve) => {
      if (!curve.points.length) return { ...curve, displayPoints: [] };
      const normSupported = curve.points[0].freq <= labState.normHz && curve.points.at(-1)!.freq >= labState.normHz;
      if (!normSupported && !curve.isFilterCurve) return { ...curve, displayPoints: [] };
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
        const found = TARGET_CURVES.find((t) => t.id === curve.sourceTargetId);
        if (found) sourceTarget = found;
      }
      if (!sourceTarget) {
        sourceTarget = TARGET_CURVES[0]; // Crinacle IEF 2025
      }

      // Pre-compute raw reconstructed IEM curve at all frequencies if it's a filter curve:
      // IEM_raw(f) = SourceTarget(f) - FilterCut(f)
      // Datum at normHz:
      const filterAtNormHz = getInterpolatedTargetGain(labState.normHz, smoothed);
      const srcTargetAtNormHz = getInterpolatedTargetGain(labState.normHz, sourceTarget.points);
      const reconstructedIemAtNormHz = srcTargetAtNormHz - filterAtNormHz;

      // Base anchor gain at normalization frequency for normal curves
      const curveNormGain = getInterpolatedTargetGain(labState.normHz, smoothed);

      const transformedPoints: CurvePoint[] = SYNTHESIS_FREQUENCIES.map((f) => {
        const rawGain = getInterpolatedTargetGain(f, smoothed);
        let dispGain = rawGain;

        if (isTargetCurve) {
          // Target Curve: normalize to normDb at normHz (1000 Hz)
          // T_plot(f) = T(f) - T(normHz) + normDb
          const targetNorm = rawGain - activeTargetNormGain + labState.normDb;
          dispGain = labState.deltaMode ? 0 : targetNorm;
        } else if (labState.deltaMode && activeTarget) {
          // Global DELTA Mode: deviation from target
          if (isFilter) {
            // Reconstruct IEM relative to its own source target, normalize at normHz,
            // then take delta against the *active* target (may differ from source target)
            const srcTargetGain = getInterpolatedTargetGain(f, sourceTarget.points);
            const targetGain = getInterpolatedTargetGain(f, activeTarget.points);
            const iemPlot = srcTargetGain - rawGain - reconstructedIemAtNormHz + labState.normDb;
            const targetPlot = targetGain - activeTargetNormGain + labState.normDb;
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
            const iemPlot = srcTargetGain - rawGain - reconstructedIemAtNormHz + labState.normDb;
            const targetPlot = targetGain - activeTargetNormGain + labState.normDb;
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
          const netGain = srcTargetGain - srcTargetAtNormHz + labState.normDb;
          const iemRaw = srcTargetGain - rawGain;
          const iemNormalized = iemRaw - reconstructedIemAtNormHz + labState.normDb;

          if (labState.viewMode === 'rawFilter') {
            // "Filter Cuts" mode: shows raw cuts by default, flips to reconstructed if inverted
            dispGain = (curve.isInverted ? iemNormalized : rawGain) + curve.offset;
          } else if (labState.viewMode === 'netPostEq') {
            // "Post-EQ Net" mode: shows ideal equalized sound; if inverted, shows residual error vs active target
            const activeTargetGain = activeTarget
              ? getInterpolatedTargetGain(f, activeTarget.points) - activeTargetNormGain + labState.normDb
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
          const normalized = rawGain - curveNormGain + labState.normDb;
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
  }, [
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
      .filter((c) => c.visible && (!anySolo || c.solo || c.isTarget))
      .map((c) => c.displayPoints);
  }, [displayCurves, anySolo]);

  const { minY, maxY, yTicks } = useMemo(() => {
    return calculateAutoRangedYBounds(activeVisiblePointSets, isTargetInVisible);
  }, [activeVisiblePointSets, isTargetInVisible]);

  // Viewport with responsive zoom range
  const viewport: ViewportDimensions = useMemo(() => {
    const range = { full: [20, 20000], bass: [20, 250], mids: [250, 4000], treble: [4000, 20000] }[
      labState.zoomRange
    ] || [20, 20000];
    return {
      width: Math.min(960, Math.max(300, screenWidth - (screenWidth > 980 ? 340 : 40))),
      height: screenWidth < 768 ? 320 : 380,
      padding: { top: 28, right: screenWidth < 768 ? 14 : 28, bottom: 42, left: screenWidth < 768 ? 38 : 54 },
      minFreq: range[0],
      maxFreq: range[1],
      minY,
      maxY,
    };
  }, [minY, maxY, labState.zoomRange, screenWidth]);

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

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = viewport.width / rect.width;
    const clientX = (e.clientX - rect.left) * scaleX;

    if (clientX >= viewport.padding.left && clientX <= viewport.width - viewport.padding.right) {
      const freq = xToFreq(clientX, viewport);
      const values = displayCurves
        .filter(
          (c) =>
            c.visible &&
            (!anySolo || c.solo || c.isTarget) &&
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

      setHoveredPoint({ x: clientX, freq, values });
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
    try {
    // Fit original source arrays; display changes never affect analysis.
    const peqResult = synthesizeAutoPeq(smoothLogCurve(curveA.points.map(p => ({ ...p, rawSpl: p.gain })), labState.fitSmoothing || 'RAW'), curveB.points, {
      normalize: labState.fitNormalize ?? true,
      sampleRate: audioEngine.audioContext?.sampleRate || 48000,
      smoothing: labState.fitSmoothing || 'RAW',
      maxFilters: 10,
      targetCurveId: 'audition-delta',
    });

    if (peqResult) {
      audioEngine.loadExternalPeq(peqResult.filters, peqResult.preamp);
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

  useEffect(() => { setAuditionResult(null); audioEngine.stopAudio(); }, [labState.curves.map(c => c.id + JSON.stringify(c.points)).join('|'), labState.fitNormalize, labState.fitSmoothing]);

  // Auto-PEQ send to Workbench
  const handleSendAutoPeq = async (curve: LabCurve) => {
    if (!activeTarget || curve.provenance !== 'measured' || curve.isFilterCurve) { showToast('Generate correction requires a measured source and reference target.'); return; }
    if (audioWorkspace.getSnapshot().draft.dirty && !window.confirm('Replace unfinished Audio work with this correction?')) return;
    try {
      const measured = smoothLogCurve(curve.points.map(p => ({ ...p, rawSpl: p.gain })), labState.fitSmoothing || 'RAW');
      const result = synthesizeAutoPeq(measured, activeTarget.points, {
        normalize: labState.fitNormalize ?? true, sampleRate: 48000, smoothing: labState.fitSmoothing || 'RAW', maxFilters: 10, targetCurveId: activeTarget.id,
      });
      const ref = await storeMeasurement({ name: curve.name, rawPoints: curve.points.map(p => ({ ...p, rawSpl: p.gain })), smoothedPoints: [], normOffset: 0, sampleCount: curve.points.length, smoothing: 'RAW' });
      audioWorkspace.replace({ ...freshDraft(), dirty: true, eqMode: 'peq', peqFilters: result.filters, requestedPreamp: result.preamp, presetName: `${curve.name} Auto-PEQ`, hardwareAssigned: curve.name, selectedTargetId: activeTarget.id, measurementRef: ref, workbenchState: 'ADDING', originalFit: result, smoothing: labState.fitSmoothing || 'RAW', normalize: labState.fitNormalize ?? true });
      labStore.closeLab(); onOpenEditor?.();
    } catch (e) { showToast((e as Error).message); }
  };

  // Ingest Measurement File
  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleProcessFile(file);
  };

  const handleProcessFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseMeasurementFile(text, file.name, labState.smoothing, labState.normHz);
      if (parsed && parsed.rawPoints.length > 0) {
        const colors = ['#c9f3d0', '#F06543', '#72B01D', '#3F88C5', '#D1495B', '#9D4EDD'];
        const color = colors[(labState.curves.length - 1) % colors.length] || '#c9f3d0';
        const isFilter = !!parsed.isGraphicEQ;
        const newCurve: LabCurve = {
          id: `measured-${Date.now()}`,
          name: parsed.name || file.name.replace(/\.[^/.]+$/, ''),
          color,
          points: parsed.rawPoints,
          provenance: isFilter ? 'eq-compensated' : 'measured',
          provenanceDetails: isFilter
            ? `GraphicEQ Filter • ${parsed.sampleCount} pts • raw correction values`
            : `Imported • ${parsed.sampleCount} pts • norm ${labState.normHz}Hz`,
          pointsCount: parsed.sampleCount,
          offset: 0,
          visible: true,
          solo: false,
          isFilterCurve: isFilter,
          sourceTargetId: isFilter ? labState.targetCurveId : undefined,
        };
        labStore.addCurve(newCurve);
        labStore.setPrimaryCurve(newCurve.id);
        showToast(
          `✓ Ingested ${newCurve.name} (${parsed.sampleCount} pts${isFilter ? ' • GraphicEQ filter' : ''})`,
        );
      } else {
        showToast('⚠️ Could not parse points. Supported: GraphicEQ, CSV, TSV, REW format.');
      }
    } catch (err) {
      console.error('File parsing error:', err);
      showToast('⚠️ Error reading measurement file.');
    }
  };

  if (!labState.isOpen) return null;

  return (
    <div
      className="graph-lab fixed inset-0 z-50 flex flex-col text-audio-text overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Graph lab"
    >
      {/* 1. TOP TOOLBAR */}
      <LabToolbar
        onToast={showToast}
        onExportCsv={() => {
          const rows = [`# Displayed data: mode=${labState.viewMode}; normalization=${labState.normDb}dB@${labState.normHz}Hz; smoothing=${labState.smoothing}; delta=${labState.deltaMode}. Per-curve offset/inversion/difference below.`, 'curve,frequency_hz,gain_db,offset_db,inverted,difference,provenance'];
          displayCurves
            .filter((c) => c.visible)
            .forEach((c) =>
              c.displayPoints.forEach((p) =>
                rows.push(`"${c.name.replaceAll('"', '""')}",${p.freq},${p.gain},${c.offset},${!!c.isInverted},${!!c.deltaCompensate},${c.provenance}`),
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
      <div className="lab-workspace">
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
              type="file"
              accept=".txt,.csv,.tsv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  handleProcessFile(f);
                  e.target.value = '';
                }
              }}
            />
          </div>

          {/* Drag & Drop Box */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            className="p-3 rounded-xl border border-dashed border-audio-border/70 bg-[#151c17] text-center hover:border-audio-accent/60 transition-colors"
          >
            <p className="text-[10px] font-mono text-audio-muted">
              Drop squig.link / REW measurement CSV here
            </p>
          </div>

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
                    value={labState.auditionAId || ''}
                    onChange={(e) => labStore.setAuditionPair(e.target.value, labState.auditionBId)}
                    className="w-full bg-[#161d18] border border-audio-border/60 rounded px-1.5 py-1 text-audio-text focus:outline-none"
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
                    value={labState.auditionBId || ''}
                    onChange={(e) => labStore.setAuditionPair(labState.auditionAId, e.target.value)}
                    className="w-full bg-[#161d18] border border-audio-border/60 rounded px-1.5 py-1 text-audio-text focus:outline-none"
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
                <div className="px-2 py-1 bg-[#151c17] rounded border border-audio-signal/40 text-[9px] font-mono text-audio-signal flex items-center justify-between">
                  <span>RMS: {auditionResult.rmsResidual} dB</span>
                  <span>{auditionResult.filterCount} FILTERS ACTIVE</span>
                </div>
              )}

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
        <main className="flex-1 flex flex-col overflow-hidden bg-[#101512] p-3 md:p-5 gap-3">
          {/* 3. MEASUREMENT-GRADE SVG CANVAS */}
          <div className="relative flex-1 min-h-[300px] w-full bg-[#151c17] rounded-2xl border border-audio-border/90 shadow-panel overflow-hidden flex flex-col justify-center">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${viewport.width} ${viewport.height}`}
              className="w-full h-full block cursor-crosshair"
              onPointerMove={handleMouseMove}
              onPointerDown={handleMouseMove}
              onPointerLeave={(e) => {
                if (e.pointerType === 'mouse') setHoveredPoint(null);
              }}
            >
              {/* Decade Freq Grid */}
              {CRINGRAPH_FREQ_TICKS.filter(
                (t) =>
                  t.freq >= viewport.minFreq! &&
                  t.freq <= viewport.maxFreq! &&
                  (screenWidth >= 768 || t.major || labState.zoomRange !== 'full'),
              ).map(({ freq, label, major }) => {
                const x = freqToX(freq, viewport);
                return (
                  <g key={freq}>
                    <line
                      x1={x}
                      y1={viewport.padding.top}
                      x2={x}
                      y2={viewport.height - viewport.padding.bottom}
                      stroke={major ? '#2A221B' : '#202a23'}
                      strokeWidth={major ? 1.0 : 0.6}
                      strokeDasharray={major ? undefined : '2 2'}
                    />
                    <text
                      x={x}
                      y={viewport.height - 22}
                      fill={major ? '#edf0ec' : '#6A5F52'}
                      fontSize={major ? 8.5 : 7.5}
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
                      stroke={isZero ? '#4A3E33' : '#222b25'}
                      strokeWidth={isZero ? 1.2 : 0.6}
                      strokeDasharray={isZero ? undefined : '2 2'}
                    />
                    <text
                      x={viewport.padding.left - 6}
                      y={y + 3}
                      fill={isZero ? '#b4e4bd' : '#6A5F52'}
                      fontSize="8"
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
                .filter((c) => c.visible && (!anySolo || c.solo || c.isTarget))
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

              {/* Multi-Curve Hover Tooltip */}
              {hoveredPoint &&
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
                    <g data-testid="graph-crosshair">
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
                        fontSize="8.5"
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
                          fontSize="8.5"
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

          {/* 4. BOTTOM PER-CURVE ROWS */}
          <div className="max-h-48 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
            {labState.curves.map((curve) => (
              <PerCurveRow
                key={curve.id}
                curve={curve}
                isPrimary={curve.id === labState.primaryCurveId}
                onSendAutoPeq={handleSendAutoPeq}
                onManualEq={() => { if (audioWorkspace.getSnapshot().draft.dirty && !window.confirm('Replace unfinished Audio work?')) return; audioWorkspace.replace({ ...freshDraft(), workbenchState: 'ADDING', selectedTargetId: labState.targetCurveId }); labStore.closeLab(); onOpenEditor?.(); }}
                onToast={showToast}
              />
            ))}
          </div>
        </main>
      </div>

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
      {toastMessage && (
        <div className="notification-area" role="status" aria-live="polite">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default GraphLab;
