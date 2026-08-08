import React, { useState, useRef, useMemo } from 'react';
import { labStore } from '../store/labStore';
import {
  HARMAN_IE_2019_POINTS,
  CRINACLE_IEF_2025_POINTS,
  SENNHEISER_HD600_POINTS,
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
} from '../utils/curveSynthesizer';

export interface IEMCurveData {
  name: string;
  color: string;
  points: CurvePoint[];
  isReference?: boolean;
}

interface FRGraphProps {
  /** Array of IEM curves to plot (e.g. SoundPEATS H3, Kefine Delci AE) */
  curves?: IEMCurveData[];
  /** Legacy single-point array */
  points?: CurvePoint[];
  /** Gear label for measured curve */
  gearName?: string;
  title?: string;
  sibilanceAlert?: boolean;
  className?: string;
}

// Built-in standard targets
const STANDARD_TARGETS: IEMCurveData[] = [
  {
    name: 'Crinacle IEF 2025 Target',
    color: '#6FC9A6', // Phosphor teal
    points: CRINACLE_IEF_2025_POINTS,
    isReference: true,
  },
  {
    name: 'Harman In-Ear 2019',
    color: '#E7B87A', // Warm amber
    points: HARMAN_IE_2019_POINTS,
    isReference: true,
  },
  {
    name: 'HD600 Benchmark',
    color: '#C6934F', // Brushed brass
    points: SENNHEISER_HD600_POINTS,
    isReference: true,
  },
];

export const FRGraph: React.FC<FRGraphProps> = ({
  curves: inputCurves,
  points,
  gearName = 'Measured Response',
  title,
  sibilanceAlert = false,
  className = '',
}) => {
  // Determine active curves
  const activeCurves = useMemo<IEMCurveData[]>(() => {
    if (inputCurves && inputCurves.length > 0) {
      // Add IEF 2025 as the reference baseline if not already present
      const hasReference = inputCurves.some((c) => c.isReference || c.name.toLowerCase().includes('ief'));
      if (!hasReference) {
        return [
          ...inputCurves,
          {
            name: 'Crinacle IEF 2025 (Reference Target)',
            color: '#6FC9A6',
            points: CRINACLE_IEF_2025_POINTS,
            isReference: true,
          },
        ];
      }
      return inputCurves;
    }

    if (points && points.length > 0) {
      return [
        {
          name: gearName,
          color: '#EDE6DA',
          points,
        },
        STANDARD_TARGETS[0], // Crinacle IEF 2025
      ];
    }

    // Default reference targets
    return STANDARD_TARGETS;
  }, [inputCurves, points, gearName]);

  // Track visibility of each curve by index
  const [visibleIndices, setVisibleIndices] = useState<Set<number>>(
    new Set(activeCurves.map((_, i) => i))
  );

  // Primary curve index for crosshair tracking
  const [primaryIndex, setPrimaryIndex] = useState<number>(0);

  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    freq: number;
    values: { name: string; db: number; color: string; isRef?: boolean }[];
  } | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);

  const toggleCurve = (index: number) => {
    setVisibleIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index) && next.size === 1) return prev; // Keep at least one
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  // Collect active points for auto-ranging
  const allActivePoints = useMemo<CurvePoint[][]>(() => {
    return activeCurves
      .filter((_, i) => visibleIndices.has(i))
      .map((c) => c.points);
  }, [activeCurves, visibleIndices]);

  const { minY, maxY, yTicks } = useMemo(() => {
    return calculateAutoRangedYBounds(allActivePoints, true);
  }, [allActivePoints]);

  const viewport: ViewportDimensions = useMemo(() => ({
    width: 820,
    height: 310,
    padding: { top: 28, right: 28, bottom: 38, left: 54 },
    minY,
    maxY,
  }), [minY, maxY]);

  // Generate SVG paths
  const renderedPaths = useMemo(() => {
    return activeCurves.map((c) => ({
      ...c,
      path: generateSvgPathFromPoints(c.points, viewport, minY, maxY),
    }));
  }, [activeCurves, viewport, minY, maxY]);

  // Sibilance risk zone
  const sibX1 = freqToX(6000, viewport);
  const sibX2 = freqToX(9000, viewport);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = viewport.width / rect.width;
    const clientX = (e.clientX - rect.left) * scaleX;

    if (
      clientX >= viewport.padding.left &&
      clientX <= viewport.width - viewport.padding.right
    ) {
      const freq = xToFreq(clientX, viewport);
      const values = activeCurves
        .map((c, i) => ({
          name: c.name,
          db: parseFloat(getInterpolatedTargetGain(freq, c.points).toFixed(1)),
          color: c.color,
          isRef: c.isReference,
          index: i,
        }))
        .filter((v) => visibleIndices.has(v.index));

      setHoveredPoint({ x: clientX, freq, values });
    } else {
      setHoveredPoint(null);
    }
  };

  const primaryCurve = activeCurves[primaryIndex] || activeCurves[0];
  const displayTitle = title || (
    inputCurves && inputCurves.length > 0
      ? `Acoustic Response Comparison: ${inputCurves.filter(c => !c.isReference).map(c => c.name).join(' vs ')}`
      : 'Acoustic Reference Target Overlay'
  );

  return (
    <div className={`panel p-4 md:p-5 rounded-2xl bg-[#120D0A] border border-audio-border shadow-panel select-none ${className}`}>

      {/* ── Header Bar ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b border-audio-border/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-audio-accent shadow-[0_0_8px_#C6934F]" />
            <h4 className="font-display font-bold text-sm text-audio-text tracking-wide">{displayTitle}</h4>
          </div>
          <p className="text-[10px] font-mono text-audio-muted mt-0.5">
            CRINGRAPH CALIBRATION (20Hz–20kHz) • AUTO-RANGED [{minY}dB to +{maxY}dB] • NORM 1kHz (0dB)
          </p>
        </div>

        {/* Dynamic Curve Toggle Badges & Open in Lab */}
        <div className="flex flex-wrap items-center gap-1.5">
          {activeCurves.map((c, i) => {
            const isVisible = visibleIndices.has(i);
            const isPrimary = primaryIndex === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => toggleCurve(i)}
                onDoubleClick={() => setPrimaryIndex(i)}
                title={`Click to toggle • Double-click to set as primary crosshair\n${c.name}`}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10.5px] font-mono font-semibold border transition-all ${
                  isVisible
                    ? isPrimary
                      ? 'border-2 shadow-panel ring-1'
                      : 'border-opacity-60'
                    : 'opacity-30 border-audio-border bg-audio-surface text-audio-muted'
                }`}
                style={
                  isVisible
                    ? {
                        borderColor: c.color,
                        backgroundColor: `${c.color}15`,
                        color: c.color,
                      }
                    : {}
                }
              >
                <span
                  className="w-3.5 h-0.5 rounded-full inline-block"
                  style={{
                    backgroundColor: c.color,
                    borderBottom: c.isReference ? `1.5px dashed ${c.color}` : undefined,
                    opacity: isVisible ? 1 : 0.3,
                  }}
                />
                <span className="font-bold">{c.name.split(' (')[0]}</span>
                {c.isReference && (
                  <span className="text-[8px] uppercase tracking-wider opacity-70 px-1 rounded bg-black/40">
                    Ref
                  </span>
                )}
                {isPrimary && isVisible && (
                  <span className="text-[9px] opacity-90">●</span>
                )}
              </button>
            );
          })}

          {/* Open in Lab Button */}
          <button
            type="button"
            onClick={() => {
              const labCurves = activeCurves.map((c, idx) => ({
                id: `chat-curve-${idx}-${Date.now()}`,
                name: c.name,
                color: c.color,
                points: c.points,
                provenance: (c.isReference ? 'target' : 'ai-estimate') as any,
                provenanceDetails: c.isReference ? 'Acoustic Target Reference' : 'AI Estimate • 40 pts',
                pointsCount: c.points.length,
                offset: 0,
                visible: visibleIndices.has(idx),
                solo: false,
                isReference: c.isReference,
                isTarget: c.isReference,
              }));
              labStore.openLab(labCurves);
            }}
            className="px-2.5 py-1 rounded-lg bg-audio-accent text-black font-mono font-bold text-[10.5px] hover:bg-audio-accent-bright shadow-glow-brass transition-all flex items-center gap-1"
            title="Open these curves in the full-screen measurement Graph Lab"
          >
            <span>⤢ Open in Lab</span>
          </button>
        </div>
      </div>

      {/* ── SVG Canvas ─────────────────────────────────────────────────── */}
      <div className="relative w-full overflow-hidden bg-[#0A0806] rounded-xl border border-audio-border/80">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${viewport.width} ${viewport.height}`}
          className="w-full h-auto block cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredPoint(null)}
        >
          {/* Sibilance risk zone (6kHz to 9kHz) */}
          {sibilanceAlert && (
            <g>
              <rect
                x={sibX1}
                y={viewport.padding.top}
                width={sibX2 - sibX1}
                height={viewport.height - viewport.padding.top - viewport.padding.bottom}
                fill="#E06A3F"
                fillOpacity="0.08"
              />
              <line
                x1={sibX1}
                y1={viewport.padding.top}
                x2={sibX1}
                y2={viewport.height - viewport.padding.bottom}
                stroke="#E06A3F"
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.4"
              />
              <line
                x1={sibX2}
                y1={viewport.padding.top}
                x2={sibX2}
                y2={viewport.height - viewport.padding.bottom}
                stroke="#E06A3F"
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.4"
              />
              <text
                x={(sibX1 + sibX2) / 2}
                y={viewport.padding.top + 14}
                fill="#E06A3F"
                fontSize="7.5"
                fontFamily="monospace"
                fontWeight="bold"
                textAnchor="middle"
                opacity="0.9"
              >
                SIBILANCE RISK (6–9kHz)
              </text>
            </g>
          )}

          {/* Frequency decade grid */}
          {CRINGRAPH_FREQ_TICKS.map(({ freq, label, major }) => {
            const x = freqToX(freq, viewport);
            return (
              <g key={freq}>
                <line
                  x1={x}
                  y1={viewport.padding.top}
                  x2={x}
                  y2={viewport.height - viewport.padding.bottom}
                  stroke={major ? '#2E2620' : '#1A1410'}
                  strokeWidth={major ? 1.0 : 0.6}
                  strokeDasharray={major ? undefined : '2 2'}
                />
                <text
                  x={x}
                  y={viewport.height - 15}
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

          {/* Horizontal dB grid */}
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
                  stroke={isZero ? '#4A3E33' : '#1E1813'}
                  strokeWidth={isZero ? 1.2 : 0.7}
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

          {/* Render Reference Targets (dashed) first in background */}
          {renderedPaths
            .map((c, i) => ({ ...c, originalIndex: i }))
            .filter((c) => c.isReference && visibleIndices.has(c.originalIndex))
            .map((c) => (
              <path
                key={c.originalIndex}
                d={c.path}
                fill="none"
                stroke={c.color}
                strokeWidth="1.8"
                strokeDasharray="4 3"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.85"
              />
            ))}

          {/* Render Actual IEM Curves (solid vibrant) on top */}
          {renderedPaths
            .map((c, i) => ({ ...c, originalIndex: i }))
            .filter((c) => !c.isReference && visibleIndices.has(c.originalIndex))
            .map((c) => {
              const isPrimary = primaryIndex === c.originalIndex;
              return (
                <path
                  key={c.originalIndex}
                  d={c.path}
                  fill="none"
                  stroke={c.color}
                  strokeWidth={isPrimary ? 3.0 : 2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={isPrimary ? 1.0 : 0.85}
                />
              );
            })}

          {/* Multi-Curve Hover Crosshair */}
          {hoveredPoint && (() => {
            const freqLabel =
              hoveredPoint.freq >= 1000
                ? `${(hoveredPoint.freq / 1000).toFixed(1)}kHz`
                : `${Math.round(hoveredPoint.freq)}Hz`;

            const pillW = 165;
            const pillH = 16 + hoveredPoint.values.length * 14;
            const pillX = Math.min(
              hoveredPoint.x + 10,
              viewport.width - viewport.padding.right - pillW - 4
            );
            const pillY = Math.max(viewport.padding.top + 4, 32);

            return (
              <g>
                {/* Vertical tracking line */}
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

                {/* Dot for each curve */}
                {hoveredPoint.values.map((v, i) => (
                  <circle
                    key={i}
                    cx={hoveredPoint.x}
                    cy={dbToY(v.db, viewport, minY, maxY)}
                    r={v.isRef ? 3.2 : 4.5}
                    fill={v.color}
                    stroke="#0A0806"
                    strokeWidth="1.2"
                  />
                ))}

                {/* Tooltip Card */}
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
                    fontWeight="600"
                  >
                    <tspan>{v.name.split(' (')[0].slice(0, 16)}:</tspan>{' '}
                    <tspan fontWeight="bold">
                      {v.db > 0 ? `+${v.db}` : v.db} dB
                    </tspan>
                  </text>
                ))}
              </g>
            );
          })()}
        </svg>
      </div>

      {/* ── Footer Legend ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 mt-2.5 pt-2 text-[10px] font-mono text-audio-muted">
        <span className="text-audio-muted/60">
          Normalized at 1kHz • Toggle badges above to show/hide curves
        </span>
        <div className="flex flex-wrap items-center gap-3">
          {activeCurves
            .filter((_, i) => visibleIndices.has(i))
            .map((c, i) => (
              <span key={i} className="flex items-center gap-1.5 font-semibold" style={{ color: c.color }}>
                <span
                  className="w-3.5 h-0.5 inline-block rounded-full"
                  style={{
                    backgroundColor: c.color,
                    borderBottom: c.isReference ? `1.5px dashed ${c.color}` : undefined,
                  }}
                />
                <span>{c.name.split(' (')[0]}</span>
              </span>
            ))}
        </div>
      </div>
    </div>
  );
};

export default FRGraph;
