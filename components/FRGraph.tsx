import React, { useState, useRef, useMemo } from 'react';
import { CopyIcon, CheckIcon } from './Icon';
import {
  HARMAN_IE_2019_POINTS,
  CRINACLE_IEF_2025_POINTS,
  SENNHEISER_HD600_POINTS,
  FLAT_REFERENCE_POINTS,
  CRINGRAPH_FREQ_TICKS,
  getInterpolatedTargetGain,
  CurvePoint,
} from '../constants/targetCurves';
import {
  calculateAutoRangedYBounds,
  freqToX,
  xToFreq,
  dbToY,
  yToDb,
  generateSvgPathFromPoints,
  ViewportDimensions,
} from '../utils/curveSynthesizer';

interface FRGraphProps {
  title?: string;
  gearName?: string;
  points?: { freq: number; gain: number }[];
  targetCurve?: 'IEF-2025' | 'Harman-2019' | 'HD600' | 'Flat';
  sibilanceAlert?: boolean;
  onExportWavelet?: () => void;
  className?: string;
}

export const FRGraph: React.FC<FRGraphProps> = ({
  title = 'Frequency Response & Acoustic Reference Target',
  gearName = 'Measured IEM Response',
  points,
  targetCurve: initialTarget = 'IEF-2025',
  sibilanceAlert = true,
  onExportWavelet,
  className = '',
}) => {
  const [selectedTarget, setSelectedTarget] = useState<'IEF-2025' | 'Harman-2019' | 'HD600' | 'Flat'>(initialTarget);
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    freq: number;
    measuredDb: number;
    targetDb: number;
    deltaDb: number;
  } | null>(null);
  const [copiedWavelet, setCopiedWavelet] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  // Target Curve Dataset Selection
  const activeTargetData = useMemo<{ name: string; short: string; points: CurvePoint[]; color: string; provenance: string }>(() => {
    switch (selectedTarget) {
      case 'Harman-2019':
        return {
          name: 'Harman In-Ear 2019 Target',
          short: 'Harman 2019',
          points: HARMAN_IE_2019_POINTS,
          color: '#E7B87A',
          provenance: 'SRC: squig.link • 301 pts verbatim • norm 1 kHz • Harman Research',
        };
      case 'HD600':
        return {
          name: 'Sennheiser HD600 Benchmark',
          short: 'HD600 Timbre',
          points: SENNHEISER_HD600_POINTS,
          color: '#C6934F',
          provenance: 'SRC: squig.link • IEC 711 clone • norm 1 kHz • HD600 Reference',
        };
      case 'Flat':
        return {
          name: 'Flat Studio Reference (0.0 dB)',
          short: 'Flat 0dB',
          points: FLAT_REFERENCE_POINTS,
          color: '#9C8F7D',
          provenance: 'SRC: Synthetic 0.0 dB Baseline',
        };
      case 'IEF-2025':
      default:
        return {
          name: 'Crinacle IEF Preference 2025',
          short: 'IEF 2025',
          points: CRINACLE_IEF_2025_POINTS,
          color: '#6FC9A6',
          provenance: 'SRC: squig.link • Crinacle B&K 5128 • norm 1 kHz',
        };
    }
  }, [selectedTarget]);

  // Default measured curve if no points passed
  const activePoints = useMemo<CurvePoint[]>(() => {
    if (points && points.length > 0) return points;
    return [
      { freq: 20, gain: 7.2 },
      { freq: 40, gain: 7.0 },
      { freq: 80, gain: 5.5 },
      { freq: 150, gain: 2.8 },
      { freq: 200, gain: 1.4 },
      { freq: 300, gain: 0.2 },
      { freq: 500, gain: 0.0 },
      { freq: 870, gain: 0.2 },
      { freq: 1000, gain: 1.8 },
      { freq: 2000, gain: 7.2 },
      { freq: 2800, gain: 10.1 },
      { freq: 3200, gain: 9.8 },
      { freq: 3500, gain: 8.6 },
      { freq: 5000, gain: 5.8 },
      { freq: 6500, gain: 4.2 },
      { freq: 8000, gain: 7.5 }, // Peak creating sibilance alert
      { freq: 10000, gain: 2.1 },
      { freq: 10200, gain: 0.8 },
      { freq: 15000, gain: -1.8 },
      { freq: 20000, gain: -5.5 },
    ];
  }, [points]);

  // AUTO-RANGE Y-AXIS (Un-clips Harman's -20.1dB treble cliff and accommodates any high boost)
  const { minY, maxY, yTicks } = useMemo(() => {
    return calculateAutoRangedYBounds([activePoints, activeTargetData.points], true);
  }, [activePoints, activeTargetData]);

  const viewport: ViewportDimensions = useMemo(() => ({
    width: 800,
    height: 300,
    padding: { top: 25, right: 25, bottom: 35, left: 52 },
    minY,
    maxY,
  }), [minY, maxY]);

  const graphWidth = viewport.width - viewport.padding.left - viewport.padding.right;
  const graphHeight = viewport.height - viewport.padding.top - viewport.padding.bottom;

  // Construct SVG Paths
  const measuredPath = useMemo(() => {
    return generateSvgPathFromPoints(activePoints, viewport, minY, maxY);
  }, [activePoints, viewport, minY, maxY]);

  const targetPath = useMemo(() => {
    return generateSvgPathFromPoints(activeTargetData.points, viewport, minY, maxY);
  }, [activeTargetData, viewport, minY, maxY]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = viewport.width / rect.width;
    const scaleY = viewport.height / rect.height;
    const clientX = (e.clientX - rect.left) * scaleX;
    const clientY = (e.clientY - rect.top) * scaleY;

    if (
      clientX >= viewport.padding.left &&
      clientX <= viewport.width - viewport.padding.right &&
      clientY >= viewport.padding.top &&
      clientY <= viewport.height - viewport.padding.bottom
    ) {
      const freq = xToFreq(clientX, viewport);
      const measuredDb = getInterpolatedTargetGain(freq, activePoints);
      const targetDb = getInterpolatedTargetGain(freq, activeTargetData.points);
      const deltaDb = parseFloat((measuredDb - targetDb).toFixed(1));

      // Map measured point to exact Y on the curve for magnetic hover feel
      const curveY = dbToY(measuredDb, viewport, minY, maxY);

      setHoveredPoint({
        x: clientX,
        y: curveY,
        freq,
        measuredDb: parseFloat(measuredDb.toFixed(1)),
        targetDb: parseFloat(targetDb.toFixed(1)),
        deltaDb,
      });
    } else {
      setHoveredPoint(null);
    }
  };

  const calculateWaveletString = () => {
    const fixedBands = [20, 62.5, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

    const bandGains = fixedBands.map((f) => {
      const targetGain = getInterpolatedTargetGain(f, activeTargetData.points);
      const measuredGain = getInterpolatedTargetGain(f, activePoints);
      const diff = parseFloat((targetGain - measuredGain).toFixed(1));
      const clamped = Math.max(-9.0, Math.min(9.0, diff));
      return { freq: f, gain: clamped };
    });

    const maxBoost = Math.max(...bandGains.map((b) => b.gain), 0);
    const preamp = maxBoost > 0 ? `-${(maxBoost + 0.5).toFixed(1)} dB` : '0.0 dB';
    const bandsFormatted = bandGains.map((b) => `${b.freq} ${b.gain > 0 ? `+${b.gain}` : b.gain}`).join('; ');

    return `GraphicEQ: ${bandsFormatted}\nPreamp: ${preamp}`;
  };

  const handleCopyWavelet = () => {
    const wavelet = calculateWaveletString();
    navigator.clipboard.writeText(wavelet).then(() => {
      setCopiedWavelet(true);
      setTimeout(() => setCopiedWavelet(false), 2000);
      if (onExportWavelet) onExportWavelet();
    });
  };

  // Sibilance risk zone X bounds (6kHz to 9kHz)
  const sibX1 = freqToX(6000, viewport);
  const sibX2 = freqToX(9000, viewport);

  return (
    <div className={`panel p-4 md:p-5 rounded-2xl bg-[#120D0A] border-audio-border shadow-panel select-none ${className}`}>
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b border-audio-border/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-audio-accent shadow-[0_0_8px_#C6934F]" />
            <h4 className="font-display font-bold text-sm text-audio-text tracking-wide">{title}</h4>
          </div>
          <p className="text-[10px] font-mono text-audio-muted mt-0.5">
            CRINGRAPH CALIBRATION (20HZ—20KHZ) • AUTO-RANGED Y [{minY}dB to +{maxY}dB]
          </p>
        </div>

        {/* Target Switcher & Export */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Target Curve Selector Chips */}
          <div className="flex items-center gap-1 bg-[#18130F] p-0.5 rounded-lg border border-audio-border/80">
            {(['IEF-2025', 'Harman-2019', 'HD600', 'Flat'] as const).map((tgt) => (
              <button
                key={tgt}
                type="button"
                onClick={() => setSelectedTarget(tgt)}
                className={`px-2 py-0.5 text-[9.5px] font-mono font-semibold rounded transition-all ${
                  selectedTarget === tgt
                    ? 'bg-audio-accent text-black font-bold shadow-glow-brass'
                    : 'text-audio-muted hover:text-audio-text'
                }`}
              >
                {tgt === 'Harman-2019' ? 'Harman 2019 (301pts)' : tgt === 'IEF-2025' ? 'IEF 2025' : tgt}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleCopyWavelet}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-mono border transition-all flex items-center gap-1 ${
              copiedWavelet
                ? 'bg-audio-signal text-black font-bold border-audio-signal shadow-glow-teal'
                : 'bg-audio-surface border-audio-border text-audio-muted hover:text-audio-accent hover:border-audio-accent/50'
            }`}
          >
            {copiedWavelet ? <CheckIcon /> : <CopyIcon />}
            <span>{copiedWavelet ? 'Wavelet Copied' : 'Export PEQ'}</span>
          </button>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full overflow-hidden bg-[#0A0806] rounded-xl border border-audio-border/80">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${viewport.width} ${viewport.height}`}
          className="w-full h-auto block cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredPoint(null)}
        >
          <defs>
            <linearGradient id="fr-brass-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#C6934F" />
              <stop offset="50%" stopColor="#E7B87A" />
              <stop offset="100%" stopColor="#C6934F" />
            </linearGradient>
            <filter id="curve-glow" x1="-10%" y1="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#C6934F" floodOpacity="0.45" />
            </filter>
          </defs>

          {/* SIBILANCE RISK ZONE (6kHz to 9kHz) — Personal acoustic signature */}
          {sibilanceAlert && (
            <g>
              <rect
                x={sibX1}
                y={viewport.padding.top}
                width={sibX2 - sibX1}
                height={graphHeight}
                fill="#E06A3F"
                fillOpacity="0.08"
              />
              <line
                x1={sibX1}
                y1={viewport.padding.top}
                x2={sibX1}
                y2={viewport.padding.top + graphHeight}
                stroke="#E06A3F"
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.45"
              />
              <line
                x1={sibX2}
                y1={viewport.padding.top}
                x2={sibX2}
                y2={viewport.padding.top + graphHeight}
                stroke="#E06A3F"
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.45"
              />
              <text
                x={(sibX1 + sibX2) / 2}
                y={viewport.padding.top + 13}
                fill="#E06A3F"
                fontSize="7.5"
                fontFamily="monospace"
                fontWeight="bold"
                textAnchor="middle"
                opacity="0.9"
              >
                SIBILANCE RISK (6-9kHz)
              </text>
            </g>
          )}

          {/* CrinGraph Decade Grid Lines & Axis Ticks (1/1.5/2/3/4/6/8 per decade) */}
          {CRINGRAPH_FREQ_TICKS.map(({ freq, label, major }) => {
            const x = freqToX(freq, viewport);
            return (
              <g key={freq}>
                <line
                  x1={x}
                  y1={viewport.padding.top}
                  x2={x}
                  y2={viewport.padding.top + graphHeight}
                  stroke={major ? '#382D24' : '#1A1410'}
                  strokeWidth={major ? '1.0' : '0.6'}
                  strokeDasharray={major ? undefined : '2 2'}
                />
                <text
                  x={x}
                  y={viewport.height - 14}
                  fill={major ? '#EDE6DA' : '#8A7E6E'}
                  fontSize={major ? '8.5' : '7.5'}
                  fontWeight={major ? 'bold' : 'normal'}
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {label}
                </text>
              </g>
            );
          })}

          {/* Horizontal dB Ticks (every 6 dB, auto-ranged) */}
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
                  strokeWidth={isZero ? '1.2' : '0.7'}
                  strokeDasharray={isZero ? undefined : '2 2'}
                />
                <text
                  x={viewport.padding.left - 6}
                  y={y + 3}
                  fill={isZero ? '#C6934F' : '#8A7E6E'}
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

          {/* Selected Reference Target (Dashed Curve) */}
          <path
            d={targetPath}
            fill="none"
            stroke={activeTargetData.color}
            strokeWidth="1.8"
            strokeDasharray="4 3"
            strokeLinecap="round"
            opacity="0.85"
          />

          {/* Measured Response Curve (Solid Brushed Brass) */}
          <path
            d={measuredPath}
            fill="none"
            stroke="url(#fr-brass-grad)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#curve-glow)"
          />

          {/* Dual-Curve Hover Crosshair & Dynamic Readout */}
          {hoveredPoint && (
            <g>
              {/* Vertical Crosshair Line */}
              <line
                x1={hoveredPoint.x}
                y1={viewport.padding.top}
                x2={hoveredPoint.x}
                y2={viewport.padding.top + graphHeight}
                stroke="#EDE6DA"
                strokeWidth="1"
                strokeDasharray="3 3"
                opacity="0.5"
              />
              {/* Target Point Dot */}
              <circle
                cx={hoveredPoint.x}
                cy={dbToY(hoveredPoint.targetDb, viewport, minY, maxY)}
                r="3.5"
                fill={activeTargetData.color}
                stroke="#0A0806"
                strokeWidth="1"
              />
              {/* Measured Point Dot */}
              <circle
                cx={hoveredPoint.x}
                cy={hoveredPoint.y}
                r="4.5"
                fill="#C6934F"
                stroke="#EDE6DA"
                strokeWidth="1.5"
              />

              {/* Dynamic Dual-Curve Readout Pill */}
              <rect
                x={Math.min(hoveredPoint.x + 8, viewport.width - viewport.padding.right - 145)}
                y={Math.max(hoveredPoint.y - 28, viewport.padding.top + 4)}
                width="140"
                height="24"
                rx="5"
                fill="#16110D"
                stroke="#C6934F"
                strokeWidth="1"
                filter="drop-shadow(0 4px 12px rgba(0,0,0,0.7))"
              />
              <text
                x={Math.min(hoveredPoint.x + 78, viewport.width - viewport.padding.right - 75)}
                y={Math.max(hoveredPoint.y - 12, viewport.padding.top + 20)}
                fill="#EDE6DA"
                fontSize="8.5"
                fontFamily="monospace"
                textAnchor="middle"
              >
                <tspan fontWeight="bold">
                  {hoveredPoint.freq >= 1000 ? `${(hoveredPoint.freq / 1000).toFixed(1)}k` : `${hoveredPoint.freq}`}Hz:
                </tspan>{' '}
                <tspan fill="#C6934F">{hoveredPoint.measuredDb > 0 ? `+${hoveredPoint.measuredDb}` : hoveredPoint.measuredDb}</tspan>{' '}
                <tspan fill="#8A7E6E">vs</tspan>{' '}
                <tspan fill={activeTargetData.color}>{hoveredPoint.targetDb > 0 ? `+${hoveredPoint.targetDb}` : hoveredPoint.targetDb}dB</tspan>{' '}
                <tspan fill={hoveredPoint.deltaDb > 0 ? '#E06A3F' : '#6FC9A6'}>
                  ({hoveredPoint.deltaDb > 0 ? `+${hoveredPoint.deltaDb}` : hoveredPoint.deltaDb})
                </tspan>
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Provenance Trust Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 mt-2 pt-1 text-[9px] font-mono text-audio-muted/70">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-audio-signal/80" />
          <span>{activeTargetData.provenance}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-audio-signal">
            <span className="w-2.5 h-0.5 bg-audio-signal border border-dashed" />
            {activeTargetData.short}
          </span>
          <span className="flex items-center gap-1 text-audio-accent font-semibold">
            <span className="w-2.5 h-0.5 bg-audio-accent" />
            {gearName}
          </span>
        </div>
      </div>
    </div>
  );
};

export default FRGraph;
