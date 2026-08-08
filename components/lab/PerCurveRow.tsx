import React from 'react';
import { LabCurve } from '@/types';
import { labStore } from '@/store/labStore';

interface PerCurveRowProps {
  curve: LabCurve;
  isPrimary: boolean;
  onSendAutoPeq?: (curve: LabCurve) => void;
  onToast?: (msg: string) => void;
}

export const PerCurveRow: React.FC<PerCurveRowProps> = ({
  curve,
  isPrimary,
  onSendAutoPeq,
  onToast,
}) => {
  const handleDownloadCsv = () => {
    const csvContent =
      'Frequency_Hz,dB\n' +
      curve.points.map((p) => `${p.freq},${(p.gain + curve.offset).toFixed(3)}`).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${curve.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_curve.csv`;
    a.click();
    URL.revokeObjectURL(url);
    if (onToast) onToast(`Exported ${curve.name} CSV`);
  };

  const provenanceLabel =
    curve.provenance === 'measured'
      ? `MEASURED • ${curve.pointsCount || curve.points.length} pts`
      : curve.provenance === 'target'
      ? `TARGET • ${curve.pointsCount || curve.points.length} pts`
      : `AI ESTIMATE • ${curve.pointsCount || curve.points.length} pts`;

  return (
    <div
      onDoubleClick={() => labStore.setPrimaryCurve(curve.id)}
      className={`p-2.5 rounded-xl border transition-all flex flex-wrap items-center justify-between gap-2 select-none ${
        isPrimary
          ? 'bg-[#1D1713] border-audio-accent shadow-panel ring-1 ring-audio-accent/50'
          : curve.visible
          ? 'bg-[#140F0C] border-audio-border/70 hover:border-audio-border'
          : 'bg-[#0E0B09] border-audio-border/30 opacity-40'
      }`}
      title="Double-click to set as primary crosshair tracking curve"
    >
      {/* 1. Color Badge, Name, and Provenance */}
      <div className="flex items-center gap-2.5 min-w-[200px]">
        <button
          type="button"
          onClick={() => labStore.toggleVisibility(curve.id)}
          className="w-3.5 h-3.5 rounded-full border border-black/80 flex items-center justify-center transition-transform hover:scale-110"
          style={{ backgroundColor: curve.color }}
          title={curve.visible ? 'Click to hide curve' : 'Click to show curve'}
        >
          {!curve.visible && <span className="w-1.5 h-1.5 bg-black rounded-full" />}
        </button>

        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-display font-semibold text-xs text-audio-text truncate max-w-[170px]">
              {curve.name}
            </span>
            {isPrimary && (
              <span className="text-[8px] font-mono font-bold px-1 rounded bg-audio-accent text-black">
                PRIMARY
              </span>
            )}
          </div>
          <span className="text-[9px] font-mono text-audio-muted/70 tracking-wider">
            {provenanceLabel}
          </span>
        </div>
      </div>

      {/* 2. Offset Input (±12 dB, 0.5 step) & Delta Compensate */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 bg-[#090705] px-2 py-0.5 rounded border border-audio-border/60 text-[9.5px] font-mono">
          <span className="text-audio-muted">OFFSET:</span>
          <input
            type="number"
            step="0.5"
            min="-18"
            max="18"
            value={curve.offset}
            onChange={(e) => labStore.setOffset(curve.id, parseFloat(e.target.value) || 0)}
            className="w-10 bg-transparent text-center font-bold text-audio-text focus:outline-none"
            title="Vertical dB offset (relative alignment)"
          />
          <span className="text-audio-muted">dB</span>
        </div>

        {/* Individual Invert / Reconstruct Toggle (Non-Target Curves only) */}
        {!curve.isTarget && (
          <button
            type="button"
            onClick={() => labStore.toggleInvertCurve(curve.id)}
            className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold transition-all border ${
              curve.isInverted
                ? 'bg-audio-accent text-black border-audio-accent shadow-glow-brass'
                : 'bg-audio-surface border-audio-border/60 text-audio-muted hover:text-audio-text'
            }`}
            title="Invert / Reconstruct: Flip between raw negative filter cuts and natural positive IEM response"
          >
            [+/-]
          </button>
        )}

        {/* Individual Delta Compensate (Non-Target Curves only) */}
        {!curve.isTarget && (
          <button
            type="button"
            onClick={() => labStore.toggleDeltaCompensate(curve.id)}
            className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold transition-all border ${
              curve.deltaCompensate
                ? 'bg-audio-warn text-black border-audio-warn'
                : 'bg-audio-surface border-audio-border/60 text-audio-muted hover:text-audio-text'
            }`}
            title="Curve Delta: Subtracts this specific curve from the active Target curve"
          >
            [Δ]
          </button>
        )}

        {/* Solo Button (Non-Target Curves only) */}
        {!curve.isTarget && (
          <button
            type="button"
            onClick={() => labStore.toggleSolo(curve.id)}
            className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold transition-all border ${
              curve.solo
                ? 'bg-audio-signal text-black border-audio-signal shadow-glow-teal'
                : 'bg-audio-surface border-audio-border/60 text-audio-muted hover:text-audio-text'
            }`}
            title="Solo: Isolate this curve + Target baseline"
          >
            SOLO
          </button>
        )}
      </div>

      {/* 3. Actions: Auto-PEQ, CSV Export, Remove */}
      <div className="flex items-center gap-1.5">
        {onSendAutoPeq && !curve.isTarget && (
          <button
            type="button"
            onClick={() => onSendAutoPeq(curve)}
            className="px-2 py-1 rounded bg-audio-accent/20 border border-audio-accent/50 text-audio-accent text-[9.5px] font-mono font-bold hover:bg-audio-accent hover:text-black transition-all"
            title="Synthesize Auto-PEQ correction filters directly from this curve"
          >
            → AUTO-PEQ
          </button>
        )}

        <button
          type="button"
          onClick={handleDownloadCsv}
          className="p-1 rounded bg-audio-surface border border-audio-border/60 text-audio-muted hover:text-audio-text text-[10px] font-mono"
          title="Download CSV"
        >
          ↓ CSV
        </button>

        {!curve.isTarget && (
          <button
            type="button"
            onClick={() => labStore.removeCurve(curve.id)}
            className="p-1 rounded text-audio-muted/60 hover:text-audio-warn hover:bg-audio-warn/10 text-xs font-mono transition-colors"
            title="Remove curve from Lab"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
};

export default PerCurveRow;
