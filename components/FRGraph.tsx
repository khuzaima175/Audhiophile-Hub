import React, { useState, useRef, useMemo } from 'react';
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

// ─── Real reference curve definitions ───────────────────────────────────────
const REFERENCE_CURVES = [
  {
    id: 'ief-2025' as const,
    name: 'Crinacle IEF Preference 2025',
    short: 'IEF 2025',
    points: CRINACLE_IEF_2025_POINTS,
    color: '#6FC9A6',         // Phosphor teal
    strokeWidth: 2.6,
    strokeDash: undefined,
    glowColor: '#6FC9A6',
    provenance: 'squig.link • B&K 5128 • norm 1 kHz • Crinacle',
  },
  {
    id: 'harman-2019' as const,
    name: 'Harman In-Ear 2019',
    short: 'Harman 2019',
    points: HARMAN_IE_2019_POINTS,
    color: '#E7B87A',         // Warm amber
    strokeWidth: 2.0,
    strokeDash: '6 3',
    glowColor: '#E7B87A',
    provenance: 'squig.link • 301 pts verbatim • norm 1 kHz • Harman Research',
  },
  {
    id: 'hd600' as const,
    name: 'Sennheiser HD600 Benchmark',
    short: 'HD600 Timbre',
    points: SENNHEISER_HD600_POINTS,
    color: '#C6934F',         // Brushed brass
    strokeWidth: 1.6,
    strokeDash: '3 4',
    glowColor: '#C6934F',
    provenance: 'squig.link • IEC 711 clone • norm 1 kHz • HD600 Reference',
  },
] as const;

type CurveId = typeof REFERENCE_CURVES[number]['id'];

interface FRGraphProps {
  /** Optional: real measured points. When absent shows reference-only overlay. */
  points?: CurvePoint[];
  /** Gear label for measured curve (only used when points are provided) */
  gearName?: string;
  title?: string;
  sibilanceAlert?: boolean;
  className?: string;
}

export const FRGraph: React.FC<FRGraphProps> = ({
  points,
  gearName = 'Measured Response',
  title = 'Acoustic Reference Target Overlay',
  sibilanceAlert = false,
  className = '',
}) => {
  const hasMeasured = points && points.length > 0;

  // Which reference curves are visible
  const [visible, setVisible] = useState<Set<CurveId>>(
    new Set(['ief-2025', 'harman-2019', 'hd600'])
  );

  // Which curve the crosshair tracks (primary)
  const [primaryCurve, setPrimaryCurve] = useState<CurveId>('ief-2025');

  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    freq: number;
    values: { id: CurveId; db: number; color: string }[];
  } | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);

  const toggleCurve = (id: CurveId) => {
    setVisible((prev) => {
      const next = new Set(prev);
      // Always keep at least one visible
      if (next.has(id) && next.size === 1) return prev;
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Collect all active points for Y-axis auto-ranging
  const allActivePoints = useMemo<CurvePoint[][]>(() => {
    const sets: CurvePoint[][] = REFERENCE_CURVES
      .filter((c) => visible.has(c.id))
      .map((c) => c.points);
    if (hasMeasured && points) sets.push(points);
    return sets;
  }, [visible, hasMeasured, points]);

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

  // Pre-generate SVG paths for each reference curve
  const curvePaths = useMemo(() => {
    return REFERENCE_CURVES.map((c) => ({
      id: c.id,
      path: generateSvgPathFromPoints(c.points, viewport, minY, maxY),
    }));
  }, [viewport, minY, maxY]);

  // Measured path (only when real points provided)
  const measuredPath = useMemo(() => {
    if (!hasMeasured || !points) return null;
    return generateSvgPathFromPoints(points, viewport, minY, maxY);
  }, [hasMeasured, points, viewport, minY, maxY]);

  // Sibilance zone
  const sibX1 = freqToX(6000, viewport);
  const sibX2 = freqToX(9000, viewport);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = viewport.width / rect.width;
    const clientX = (e.clientX - rect.left) * scaleX;
    const clientY = (e.clientY - rect.top) * (viewport.height / rect.height);

    if (
      clientX >= viewport.padding.left &&
      clientX <= viewport.width - viewport.padding.right &&
      clientY >= viewport.padding.top &&
      clientY <= viewport.height - viewport.padding.bottom
    ) {
      const freq = xToFreq(clientX, viewport);
      const values = REFERENCE_CURVES
        .filter((c) => visible.has(c.id))
        .map((c) => ({
          id: c.id,
          db: parseFloat(getInterpolatedTargetGain(freq, c.points).toFixed(1)),
          color: c.color,
        }));
      setHoveredPoint({ x: clientX, freq, values });
    } else {
      setHoveredPoint(null);
    }
  };

  // Primary curve data for crosshair Y-position
  const primaryCurveData = REFERENCE_CURVES.find((c) => c.id === primaryCurve)!;

  return (
    <div className={`panel p-4 md:p-5 rounded-2xl bg-[#120D0A] border border-audio-border shadow-panel select-none ${className}`}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b border-audio-border/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-audio-signal shadow-glow-teal" />
            <h4 className="font-display font-bold text-sm text-audio-text tracking-wide">{title}</h4>
          </div>
          <p className="text-[10px] font-mono text-audio-muted mt-0.5">
            CRINGRAPH CALIBRATION (20Hz–20kHz) • AUTO-RANGED [{minY}dB to +{maxY}dB] • REAL REFERENCE DATA
          </p>
        </div>

        {/* Curve toggle chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {REFERENCE_CURVES.map((c) => {
            const isOn = visible.has(c.id);
            const isPrimary = primaryCurve === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCurve(c.id)}
                onDoubleClick={() => setPrimaryCurve(c.id)}
                title={`Click to toggle • Double-click to set as crosshair primary\n${c.provenance}`}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold border transition-all ${
                  isOn
                    ? isPrimary
                      ? 'border-2 shadow-panel'
                      : 'border-opacity-60'
                    : 'opacity-30 border-audio-border bg-audio-surface text-audio-muted'
                }`}
                style={isOn ? {
                  borderColor: c.color,
                  backgroundColor: `${c.color}18`,
                  color: c.color,
                } : {}}
              >
                <span
                  className="w-3 h-0.5 rounded-full inline-block"
                  style={{ backgroundColor: c.color, opacity: isOn ? 1 : 0.3 }}
                />
                {c.short}
                {isPrimary && isOn && (
                  <span className="text-[8px] opacity-70">●</span>
                )}
              </button>
            );
          })}
          {hasMeasured && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold border"
              style={{ borderColor: '#EDE6DA', backgroundColor: '#EDE6DA18', color: '#EDE6DA' }}
            >
              <span className="w-3 h-0.5 rounded-full inline-block bg-[#EDE6DA]" />
              {gearName}
            </div>
          )}
        </div>
      </div>

      {/* ── SVG Canvas ───────────────────────────────────────────────────── */}
      <div className="relative w-full overflow-hidden bg-[#0A0806] rounded-xl border border-audio-border/80">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${viewport.width} ${viewport.height}`}
          className="w-full h-auto block cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredPoint(null)}
        >
          <defs>
            {REFERENCE_CURVES.map((c) => (
              <filter key={c.id} id={`glow-${c.id}`} x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor={c.glowColor} floodOpacity="0.5" />
              </filter>
            ))}
          </defs>

          {/* Sibilance risk zone */}
          {sibilanceAlert && (
            <g>
              <rect
                x={sibX1} y={viewport.padding.top}
                width={sibX2 - sibX1}
                height={viewport.height - viewport.padding.top - viewport.padding.bottom}
                fill="#E06A3F" fillOpacity="0.07"
              />
              <text
                x={(sibX1 + sibX2) / 2} y={viewport.padding.top + 14}
                fill="#E06A3F" fontSize="7.5" fontFamily="monospace"
                fontWeight="bold" textAnchor="middle" opacity="0.9"
              >
                SIBILANCE RISK (6–9kHz)
              </text>
            </g>
          )}

          {/* Frequency grid */}
          {CRINGRAPH_FREQ_TICKS.map(({ freq, label, major }) => {
            const x = freqToX(freq, viewport);
            return (
              <g key={freq}>
                <line
                  x1={x} y1={viewport.padding.top}
                  x2={x} y2={viewport.height - viewport.padding.bottom}
                  stroke={major ? '#2E2620' : '#1A1410'}
                  strokeWidth={major ? 1.0 : 0.6}
                  strokeDasharray={major ? undefined : '2 2'}
                />
                <text
                  x={x} y={viewport.height - 15}
                  fill={major ? '#EDE6DA' : '#6A5F52'}
                  fontSize={major ? 8.5 : 7.5}
                  fontWeight={major ? 'bold' : 'normal'}
                  fontFamily="monospace" textAnchor="middle"
                >
                  {label}
                </text>
              </g>
            );
          })}

          {/* dB grid */}
          {yTicks.map((db) => {
            const y = dbToY(db, viewport, minY, maxY);
            const isZero = db === 0;
            return (
              <g key={db}>
                <line
                  x1={viewport.padding.left} y1={y}
                  x2={viewport.width - viewport.padding.right} y2={y}
                  stroke={isZero ? '#4A3E33' : '#1E1813'}
                  strokeWidth={isZero ? 1.2 : 0.7}
                  strokeDasharray={isZero ? undefined : '2 2'}
                />
                <text
                  x={viewport.padding.left - 6} y={y + 3}
                  fill={isZero ? '#C6934F' : '#6A5F52'}
                  fontSize="8" fontFamily="monospace"
                  textAnchor="end" fontWeight={isZero ? 'bold' : 'normal'}
                >
                  {db > 0 ? `+${db}` : db}
                </text>
              </g>
            );
          })}

          {/* Reference curves (bottom-up z-order: HD600, Harman, IEF) */}
          {[...REFERENCE_CURVES].reverse().map((c) => {
            if (!visible.has(c.id)) return null;
            const pathData = curvePaths.find((p) => p.id === c.id)?.path;
            if (!pathData) return null;
            const isPrimary = primaryCurve === c.id;
            return (
              <path
                key={c.id}
                d={pathData}
                fill="none"
                stroke={c.color}
                strokeWidth={isPrimary ? c.strokeWidth + 0.5 : c.strokeWidth}
                strokeDasharray={c.strokeDash}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={isPrimary ? 1 : 0.75}
                filter={isPrimary ? `url(#glow-${c.id})` : undefined}
              />
            );
          })}

          {/* Measured curve (cream solid, on top of everything) */}
          {hasMeasured && measuredPath && (
            <path
              d={measuredPath}
              fill="none"
              stroke="#EDE6DA"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.95"
            />
          )}

          {/* Crosshair */}
          {hoveredPoint && (() => {
            const primaryVal = hoveredPoint.values.find((v) => v.id === primaryCurve);
            if (!primaryVal) return null;
            const yPos = dbToY(primaryVal.db, viewport, minY, maxY);
            const freqLabel = hoveredPoint.freq >= 1000
              ? `${(hoveredPoint.freq / 1000).toFixed(1)}kHz`
              : `${Math.round(hoveredPoint.freq)}Hz`;

            // Tooltip content lines
            const lines = hoveredPoint.values.map((v) => {
              const curve = REFERENCE_CURVES.find((c) => c.id === v.id)!;
              return `${curve.short}: ${v.db > 0 ? '+' : ''}${v.db}dB`;
            });

            const pillW = 148;
            const pillH = 14 + lines.length * 13;
            const pillX = Math.min(hoveredPoint.x + 10, viewport.width - viewport.padding.right - pillW - 4);
            const pillY = Math.max(yPos - pillH / 2, viewport.padding.top + 4);

            return (
              <g>
                <line
                  x1={hoveredPoint.x} y1={viewport.padding.top}
                  x2={hoveredPoint.x} y2={viewport.height - viewport.padding.bottom}
                  stroke="#EDE6DA" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.4"
                />

                {/* Dot for each visible curve */}
                {hoveredPoint.values.map((v) => (
                  <circle
                    key={v.id}
                    cx={hoveredPoint.x}
                    cy={dbToY(v.db, viewport, minY, maxY)}
                    r={v.id === primaryCurve ? 4.5 : 3}
                    fill={v.color}
                    stroke="#0A0806"
                    strokeWidth="1.2"
                    opacity={v.id === primaryCurve ? 1 : 0.8}
                  />
                ))}

                {/* Tooltip pill */}
                <rect
                  x={pillX} y={pillY}
                  width={pillW} height={pillH}
                  rx="5"
                  fill="#16110D"
                  stroke={primaryCurveData.color}
                  strokeWidth="1"
                  filter="drop-shadow(0 4px 12px rgba(0,0,0,0.8))"
                />
                <text
                  x={pillX + 8} y={pillY + 11}
                  fill="#EDE6DA" fontSize="8" fontFamily="monospace" fontWeight="bold"
                >
                  {freqLabel}
                </text>
                {lines.map((line, i) => {
                  const v = hoveredPoint.values[i];
                  const curve = REFERENCE_CURVES.find((c) => c.id === v.id)!;
                  return (
                    <text
                      key={i}
                      x={pillX + 8}
                      y={pillY + 11 + (i + 1) * 13}
                      fill={curve.color}
                      fontSize="8"
                      fontFamily="monospace"
                    >
                      {line}
                    </text>
                  );
                })}
              </g>
            );
          })()}
        </svg>
      </div>

      {/* ── Footer legend ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 mt-2 pt-1.5 text-[9px] font-mono text-audio-muted/70">
        <span className="text-audio-muted/50">
          Real reference data • Click chip to toggle • Double-click to set crosshair primary
        </span>
        <div className="flex flex-wrap items-center gap-3">
          {REFERENCE_CURVES.filter((c) => visible.has(c.id)).map((c) => (
            <span key={c.id} className="flex items-center gap-1" style={{ color: c.color }}>
              <span
                className="w-4 h-0.5 inline-block rounded-full"
                style={{
                  backgroundColor: c.color,
                  borderBottom: c.strokeDash ? `1px dashed ${c.color}` : undefined,
                }}
              />
              {c.short}
            </span>
          ))}
          {hasMeasured && (
            <span className="flex items-center gap-1 text-[#EDE6DA]">
              <span className="w-4 h-0.5 inline-block rounded-full bg-[#EDE6DA]" />
              {gearName}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default FRGraph;
