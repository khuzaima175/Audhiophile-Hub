import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useLabStore, labStore } from '../store/labStore';
import { LabToolbar } from './lab/LabToolbar';
import { PerCurveRow } from './lab/PerCurveRow';
import { BandLabels } from './lab/BandLabels';
import { TARGET_CURVES, CRINGRAPH_FREQ_TICKS, getInterpolatedTargetGain, CurvePoint } from '../constants/targetCurves';
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
import { parseMeasurementFile } from '../utils/measurementParser';
import { useAudioEngine } from '../hooks/useAudioEngine';
import { useLiveTabCapture } from '../hooks/useLiveTabCapture';
import { LabCurve, EQPreset } from '../types';
import Led from './ui/Led';
import Engraved from './ui/Engraved';
import { WaveformIcon } from './Icon';

interface GraphLabProps {
  onSavePreset?: (preset: EQPreset) => void;
}

export const GraphLab: React.FC<GraphLabProps> = ({ onSavePreset }) => {
  const labState = useLabStore();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && labState.isOpen) {
        labStore.closeLab();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [labState.isOpen]);

  // Audio Engine Hook for Audition Delta
  const [isBypassed, setIsBypassed] = useState(false);
  const audioEngine = useAudioEngine({
    isoBands: [],
    isoGains: [],
    peqFilters: [],
    isBypassed,
  });

  const { isCapturing, startTabCapture, stopTabCapture, isSupported: tabSupported } = useLiveTabCapture({
    audioContext: audioEngine.audioContext,
    onStreamAvailable: (streamNode) => {
      audioEngine.playLiveTab(streamNode);
      showToast('Live Tab stream connected');
    },
    onStreamEnded: () => {
      audioEngine.stopAudio();
      showToast('Capture ended');
    },
  });

  const svgRef = useRef<SVGSVGElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active Target Curve
  const activeTarget = useMemo(() => {
    if (labState.targetCurveId === 'none') return null;
    return TARGET_CURVES.find((t) => t.id === labState.targetCurveId) || TARGET_CURVES[0];
  }, [labState.targetCurveId]);

  // Transform and normalize points for each curve
  const displayCurves = useMemo(() => {
    return labState.curves.map((curve) => {
      const isTargetCurve = curve.isTarget;
      const isFilter = curve.isFilterCurve;

      // Base anchor gain at normalization frequency
      const normGain = getInterpolatedTargetGain(labState.normHz, curve.points);

      const transformedPoints: CurvePoint[] = SYNTHESIS_FREQUENCIES.map((f) => {
        const rawGain = getInterpolatedTargetGain(f, curve.points);
        let dispGain = rawGain;

        if (labState.deltaMode && activeTarget) {
          // DELTA Mode: deviation from target
          const targetGain = getInterpolatedTargetGain(f, activeTarget.points);
          dispGain = isTargetCurve ? 0 : rawGain - targetGain + curve.offset;

        } else if (curve.deltaCompensate && activeTarget && !isTargetCurve) {
          // Individual Delta Compensate
          const targetGain = getInterpolatedTargetGain(f, activeTarget.points);
          dispGain = rawGain - targetGain + curve.offset;

        } else if ((curve.isInverted || labState.viewMode === 'reconstructed') && !isTargetCurve) {
          // "IEM vs Target" — Reconstruction / Inversion
          // For FILTER curves (GraphicEQ/AutoEQ): simply negate the raw correction values.
          //   If filter = -7 dB at 5.6k → IEM is 7 dB ABOVE whatever target the filter was made for.
          //   This is always correct regardless of which target is currently selected.
          // For RAW measurements: this mode doesn't apply (they're already positive IEM curves).
          if (isFilter) {
            dispGain = -rawGain + curve.offset;
          } else if (activeTarget) {
            // For non-filter raw curves, show deviation above/below target
            const targetGain = getInterpolatedTargetGain(f, activeTarget.points);
            dispGain = rawGain - targetGain + curve.offset;
          } else {
            dispGain = -rawGain + curve.offset;
          }

        } else if (labState.viewMode === 'netPostEq' && activeTarget && !isTargetCurve) {
          // Post-EQ Net: show the target curve directly (flat reference)
          const targetGain = getInterpolatedTargetGain(f, activeTarget.points);
          dispGain = targetGain + curve.offset;

        } else if (labState.viewMode === 'rawFilter' && !isTargetCurve) {
          // "Filter Cuts" — show raw correction values as-is
          // For filter curves: raw negative attenuation cuts
          // For measurements: normalized response
          const normalized = rawGain - normGain + labState.normDb;
          dispGain = normalized + curve.offset;

        } else {
          // Default: Normalization
          // disp = raw - raw(normHz) + normDb + offset
          const normalized = rawGain - normGain + labState.normDb;
          dispGain = isTargetCurve ? rawGain : normalized + curve.offset;
        }

        return { freq: f, gain: parseFloat(dispGain.toFixed(2)) };
      });

      return {
        ...curve,
        displayPoints: transformedPoints,
      };
    });
  }, [labState.curves, labState.normDb, labState.normHz, labState.deltaMode, labState.viewMode, activeTarget]);

  // Visible points for Auto-Ranging
  const activeVisiblePointSets = useMemo(() => {
    return displayCurves
      .filter((c) => c.visible && (!c.solo || c.solo))
      .map((c) => c.displayPoints);
  }, [displayCurves]);

  const { minY, maxY, yTicks } = useMemo(() => {
    return calculateAutoRangedYBounds(activeVisiblePointSets, true);
  }, [activeVisiblePointSets]);

  // Viewport with responsive zoom range
  const viewport: ViewportDimensions = useMemo(() => {
    return {
      width: 960,
      height: 380,
      padding: { top: 28, right: 28, bottom: 42, left: 54 },
      minY,
      maxY,
    };
  }, [minY, maxY]);

  // Paths
  const renderedPaths = useMemo(() => {
    return displayCurves.map((c) => ({
      ...c,
      path: generateSvgPathFromPoints(c.displayPoints, viewport, minY, maxY),
    }));
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
        .filter((c) => c.visible)
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
    const curveB = labState.curves.find((c) => c.id === labState.auditionBId) || labState.curves.find((c) => c.isTarget);

    if (!curveA || !curveB) {
      showToast('Select Curve A and Curve B for Audition Delta');
      return;
    }

    // Synthesize PEQ from Delta (Curve A to Curve B)
    const peqResult = synthesizeAutoPeq(curveA.points, curveB.points, {
      maxFilters: 10,
      targetCurveId: 'audition-delta',
    });

    if (peqResult) {
      audioEngine.loadExternalPeq(peqResult.filters, peqResult.preamp);
      setAuditionResult({
        rmsResidual: parseFloat(peqResult.finalRms.toFixed(2)),
        filterCount: peqResult.filters.length,
      });
      showToast(`Audition Delta PEQ Loaded (${peqResult.filters.length} filters • RMS ${peqResult.finalRms}dB)`);
    }
  };

  // Auto-PEQ send to Workbench
  const handleSendAutoPeq = (curve: LabCurve) => {
    if (!activeTarget) return;
    const peqResult = synthesizeAutoPeq(curve.points, activeTarget.points, {
      maxFilters: 10,
      targetCurveId: activeTarget.id,
    });
    if (peqResult && onSavePreset) {
      const newPreset: EQPreset = {
        id: `peq-${Date.now()}`,
        name: `${curve.name} Auto-PEQ`,
        hardware: curve.name,
        type: 'Parametric',
        mode: 'peq',
        bands: peqResult.filters.map((f) => `Filter: ON ${f.type} Fc ${f.freq} Hz Gain ${f.gain} dB Q ${f.q}`).join('\n'),
        peqFilters: peqResult.filters,
        preamp: peqResult.preamp,
        targetCurveId: activeTarget.id,
        timestamp: Date.now(),
      };
      onSavePreset(newPreset);
      showToast(`Saved "${newPreset.name}" to EQ Library`);
    }
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
        const colors = ['#E7B87A', '#F06543', '#72B01D', '#3F88C5', '#D1495B', '#9D4EDD'];
        const color = colors[(labState.curves.length - 1) % colors.length] || '#E7B87A';
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
        };
        labStore.addCurve(newCurve);
        labStore.setPrimaryCurve(newCurve.id);
        showToast(`✓ Ingested ${newCurve.name} (${parsed.sampleCount} pts${isFilter ? ' • GraphicEQ filter' : ''})`);
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
    <div className="fixed inset-0 z-50 bg-[#0A0705] flex flex-col text-audio-text overflow-hidden select-none animate-in fade-in duration-200">
      {/* 1. TOP TOOLBAR */}
      <LabToolbar onToast={showToast} />

      {/* 2. MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* LEFT RAIL: Curve Manager & Audition Delta Engine */}
        <aside className="w-full lg:w-80 bg-[#120D0A] border-r border-audio-border p-3.5 flex flex-col gap-3 overflow-y-auto shrink-0 shadow-panel">
          <div className="flex items-center justify-between pb-2 border-b border-audio-border/60">
            <Engraved size="xs" glow>
              ACOUSTIC CURVE STACK ({labState.curves.length})
            </Engraved>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-2 py-1 rounded bg-audio-surface border border-audio-border text-[9.5px] font-mono text-audio-accent hover:border-audio-accent transition-all"
            >
              + Ingest CSV
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
            className="p-3 rounded-xl border border-dashed border-audio-border/70 bg-[#0E0A08] text-center hover:border-audio-accent/60 transition-colors"
          >
            <p className="text-[10px] font-mono text-audio-muted">
              Drop squig.link / REW measurement CSV here
            </p>
          </div>

          {/* AUDITION DELTA PANEL (The Kill Shot) */}
          <div className="p-3 bg-[#18120E] rounded-xl border border-audio-border/80 space-y-2.5">
            <div className="flex items-center gap-1.5">
              <Led color="amber" pulse size="sm" />
              <span className="text-[10px] font-mono font-bold text-audio-accent uppercase tracking-wider">
                Audition Delta Engine
              </span>
            </div>
            <p className="text-[9px] font-mono text-audio-muted">
              Synthesizes the acoustic difference between Curve A & Curve B into a live biquad filter.
            </p>

            <div className="grid grid-cols-2 gap-1.5 text-[9.5px] font-mono">
              <div>
                <label className="text-audio-muted/70 block mb-0.5">CURVE A:</label>
                <select
                  value={labState.auditionAId || ''}
                  onChange={(e) => labStore.setAuditionPair(e.target.value, labState.auditionBId)}
                  className="w-full bg-[#0D0907] border border-audio-border/60 rounded px-1.5 py-1 text-audio-text focus:outline-none"
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
                  className="w-full bg-[#0D0907] border border-audio-border/60 rounded px-1.5 py-1 text-audio-text focus:outline-none"
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
              Synthesize &amp; Load Delta PEQ
            </button>

            {auditionResult && (
              <div className="px-2 py-1 bg-[#100C09] rounded border border-audio-signal/40 text-[9px] font-mono text-audio-signal flex items-center justify-between">
                <span>RMS: {auditionResult.rmsResidual} dB</span>
                <span>{auditionResult.filterCount} FILTERS ACTIVE</span>
              </div>
            )}

            {/* Audition Playback Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={audioEngine.playPinkNoise}
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
                onClick={audioEngine.playSineSweep}
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
                onClick={isCapturing ? stopTabCapture : startTabCapture}
                disabled={!tabSupported}
                className={`px-2 py-1 rounded text-[9.5px] font-mono font-semibold border ${
                  isCapturing ? 'bg-audio-warn text-black font-bold' : 'bg-audio-surface border-audio-border text-audio-muted'
                }`}
              >
                {isCapturing ? '■ Stop Tab' : '● Live Tab'}
              </button>
              <button
                type="button"
                onClick={() => setIsBypassed(!isBypassed)}
                className={`px-2 py-1 rounded text-[9.5px] font-mono font-bold border ${
                  isBypassed ? 'bg-audio-warn text-black' : 'bg-audio-surface border-audio-signal text-audio-signal'
                }`}
              >
                {isBypassed ? 'BYPASS' : 'A/B ON'}
              </button>
            </div>
          </div>
        </aside>

        {/* CENTER & BOTTOM: SVG Canvas & Per-Curve Rows */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#0A0705] p-3 md:p-5 gap-3">
          {/* 3. MEASUREMENT-GRADE SVG CANVAS */}
          <div className="relative flex-1 min-h-[300px] w-full bg-[#0E0A08] rounded-2xl border border-audio-border/90 shadow-panel overflow-hidden flex flex-col justify-center">
            {/* Subtle Watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.04]">
              <span className="font-display font-black text-7xl tracking-widest text-audio-text">
                AUDIOSAGE LAB
              </span>
            </div>

            <svg
              ref={svgRef}
              viewBox={`0 0 ${viewport.width} ${viewport.height}`}
              className="w-full h-full block cursor-crosshair"
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHoveredPoint(null)}
            >
              {/* Decade Freq Grid */}
              {CRINGRAPH_FREQ_TICKS.map(({ freq, label, major }) => {
                const x = freqToX(freq, viewport);
                return (
                  <g key={freq}>
                    <line
                      x1={x}
                      y1={viewport.padding.top}
                      x2={x}
                      y2={viewport.height - viewport.padding.bottom}
                      stroke={major ? '#2A221B' : '#18120E'}
                      strokeWidth={major ? 1.0 : 0.6}
                      strokeDasharray={major ? undefined : '2 2'}
                    />
                    <text
                      x={x}
                      y={viewport.height - 22}
                      fill={major ? '#EDE6DA' : '#6A5F52'}
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
                      stroke={isZero ? '#4A3E33' : '#1A1410'}
                      strokeWidth={isZero ? 1.2 : 0.6}
                      strokeDasharray={isZero ? undefined : '2 2'}
                    />
                    <text
                      x={viewport.padding.left - 6}
                      y={y + 3}
                      fill={isZero ? '#C6934F' : '#6A5F52'}
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
                .filter((c) => c.visible && (!c.solo || c.solo))
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
              {hoveredPoint && (() => {
                const freqLabel =
                  hoveredPoint.freq >= 1000
                    ? `${(hoveredPoint.freq / 1000).toFixed(1)}kHz`
                    : `${Math.round(hoveredPoint.freq)}Hz`;

                const pillW = 175;
                const pillH = 18 + hoveredPoint.values.length * 14;
                const pillX = Math.min(
                  hoveredPoint.x + 10,
                  viewport.width - viewport.padding.right - pillW - 4
                );
                const pillY = Math.max(viewport.padding.top + 4, 32);

                return (
                  <g>
                    <line
                      x1={hoveredPoint.x}
                      y1={viewport.padding.top}
                      x2={hoveredPoint.x}
                      y2={viewport.height - viewport.padding.bottom}
                      stroke="#EDE6DA"
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
                      fill="#140F0C"
                      stroke="#382D24"
                      strokeWidth="1"
                      filter="drop-shadow(0 4px 14px rgba(0,0,0,0.85))"
                    />
                    <text
                      x={pillX + 9}
                      y={pillY + 13}
                      fill="#EDE6DA"
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
                onToast={showToast}
              />
            ))}
          </div>
        </main>
      </div>

      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 px-3.5 py-2 bg-[#1C1410] border border-audio-accent text-audio-text text-xs font-mono rounded-xl shadow-2xl animate-in slide-in-from-bottom-2">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default GraphLab;
