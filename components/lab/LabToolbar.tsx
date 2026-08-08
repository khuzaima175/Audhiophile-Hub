import React, { useState } from 'react';
import { useLabStore, labStore } from '@/store/labStore';
import { TARGET_CURVES } from '@/constants/targetCurves';
import { LabZoomRange, SmoothingType } from '@/types';
import { encodeLabStateToUrl } from '@/utils/shareCodec';
import Led from '@/components/ui/Led';
import Engraved from '@/components/ui/Engraved';

interface LabToolbarProps {
  onExportCsv?: () => void;
  onToast?: (msg: string) => void;
}

export const LabToolbar: React.FC<LabToolbarProps> = ({ onExportCsv, onToast }) => {
  const labState = useLabStore();
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyShareLink = async () => {
    try {
      const shareUrl = encodeLabStateToUrl(labState);
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      if (onToast) onToast('Share link copied to clipboard!');
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (e) {
      console.error('Failed to copy share link:', e);
    }
  };

  const zoomButtons: { label: string; range: LabZoomRange }[] = [
    { label: 'FULL (20–20k)', range: 'full' },
    { label: 'BASS (20–250)', range: 'bass' },
    { label: 'MIDS (250–4k)', range: 'mids' },
    { label: 'TREBLE (4k–20k)', range: 'treble' },
  ];

  const smoothingOptions: SmoothingType[] = ['RAW', '1/6 OCT', '1/3 OCT'];

  return (
    <header className="h-14 bg-[#140F0C] border-b border-audio-border px-4 flex flex-wrap items-center justify-between gap-2.5 select-none shrink-0 shadow-panel">
      {/* 1. Left Branding & Target Selectors */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Led color="brass" pulse size="sm" />
          <Engraved size="xs" glow className="tracking-widest">
            GRAPH LAB V3
          </Engraved>
        </div>

        {/* Target Curve Selector Chips */}
        <div className="hidden sm:flex items-center gap-1 bg-[#0D0907] p-1 rounded-lg border border-audio-border/70">
          <span className="text-[9px] font-mono text-audio-muted px-1">TARGET:</span>
          {TARGET_CURVES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => labStore.setTargetCurveId(t.id)}
              className={`px-2 py-0.5 rounded text-[9.5px] font-mono font-semibold transition-all ${
                labState.targetCurveId === t.id
                  ? 'bg-audio-surface border border-audio-accent text-audio-accent shadow-glow-brass'
                  : 'text-audio-muted hover:text-audio-text'
              }`}
            >
              {t.shortName}
            </button>
          ))}
          <button
            type="button"
            onClick={() => labStore.setTargetCurveId('none')}
            className={`px-2 py-0.5 rounded text-[9.5px] font-mono transition-all ${
              labState.targetCurveId === 'none'
                ? 'bg-audio-surface border border-audio-accent text-audio-text'
                : 'text-audio-muted hover:text-audio-text'
            }`}
          >
            None
          </button>
        </div>
      </div>

      {/* 2. Middle Controls: Normalize, Zoom Range, Smoothing, DELTA Latch */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Normalization Controls */}
        <div className="flex items-center gap-1 bg-[#0D0907] px-2 py-1 rounded-lg border border-audio-border/70 text-[10px] font-mono">
          <span className="text-audio-muted">NORM:</span>
          <input
            type="number"
            step="0.5"
            value={labState.normDb}
            onChange={(e) => labStore.setNormalize(parseFloat(e.target.value) || 0, labState.normHz)}
            className="w-10 bg-transparent text-center font-bold text-audio-accent focus:outline-none"
            title="Normalize dB offset"
          />
          <span className="text-audio-muted">dB @</span>
          <input
            type="number"
            step="50"
            min="20"
            max="20000"
            value={labState.normHz}
            onChange={(e) => labStore.setNormalize(labState.normDb, parseInt(e.target.value, 10) || 1000)}
            className="w-14 bg-transparent text-center font-bold text-audio-signal focus:outline-none"
            title="Normalization Anchor Frequency"
          />
          <span className="text-audio-muted">Hz</span>
        </div>

        {/* View Mode Switch: IEM vs Target (Reconstruct) | Filter (Cuts) | Post-EQ Net */}
        <div className="flex items-center bg-[#0D0907] p-0.5 rounded-lg border border-audio-border/70">
          <button
            type="button"
            onClick={() => labStore.setViewMode('reconstructed')}
            className={`px-2 py-0.5 rounded text-[9.5px] font-mono font-semibold transition-all ${
              labState.viewMode === 'reconstructed' || !labState.viewMode
                ? 'bg-audio-accent text-black font-bold shadow-glow-brass'
                : 'text-audio-muted hover:text-audio-text'
            }`}
            title="Reconstruct natural positive IEM frequency response (Target - Filter cuts)"
          >
            IEM vs Target
          </button>
          <button
            type="button"
            onClick={() => labStore.setViewMode('rawFilter')}
            className={`px-2 py-0.5 rounded text-[9.5px] font-mono font-semibold transition-all ${
              labState.viewMode === 'rawFilter'
                ? 'bg-audio-accent text-black font-bold shadow-glow-brass'
                : 'text-audio-muted hover:text-audio-text'
            }`}
            title="View raw corrective EQ slider/filter negative attenuation cuts"
          >
            Filter Cuts
          </button>
          <button
            type="button"
            onClick={() => labStore.setViewMode('netPostEq')}
            className={`px-2 py-0.5 rounded text-[9.5px] font-mono font-semibold transition-all ${
              labState.viewMode === 'netPostEq'
                ? 'bg-audio-accent text-black font-bold shadow-glow-brass'
                : 'text-audio-muted hover:text-audio-text'
            }`}
            title="View ideal flat acoustic transfer result"
          >
            Post-EQ Net
          </button>
        </div>

        {/* Global DELTA Mode Toggle */}
        <button
          type="button"
          onClick={() => labStore.setDeltaMode(!labState.deltaMode)}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all flex items-center gap-1.5 border ${
            labState.deltaMode
              ? 'bg-[#2E1812] border-audio-warn text-audio-warn shadow-glow-brass ring-1 ring-audio-warn/50'
              : 'bg-[#0D0907] border-audio-border/70 text-audio-muted hover:text-audio-text'
          }`}
          title="DELTA Mode: Flattens active Target curve to a 0dB baseline and shows all curves as relative acoustic deviation"
        >
          <span>Δ DELTA</span>
        </button>

        {/* Zoom Range Segmented Switch */}
        <div className="hidden lg:flex items-center bg-[#0D0907] p-0.5 rounded-lg border border-audio-border/70">
          {zoomButtons.map((btn) => (
            <button
              key={btn.range}
              type="button"
              onClick={() => labStore.setZoomRange(btn.range)}
              className={`px-2 py-0.5 rounded text-[9.5px] font-mono font-semibold transition-all ${
                labState.zoomRange === btn.range
                  ? 'bg-audio-surface border border-audio-border text-audio-text font-bold'
                  : 'text-audio-muted hover:text-audio-text'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Smoothing Chips */}
        <div className="hidden md:flex items-center bg-[#0D0907] p-0.5 rounded-lg border border-audio-border/70">
          {smoothingOptions.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => labStore.setSmoothing(opt)}
              className={`px-2 py-0.5 rounded text-[9px] font-mono font-semibold transition-all ${
                labState.smoothing === opt
                  ? 'bg-[#1C1410] border border-audio-accent/50 text-audio-accent'
                  : 'text-audio-muted hover:text-audio-text'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Right Action Tools: Share Link, CSV Export, Close */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleCopyShareLink}
          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all flex items-center gap-1.5 border ${
            copiedLink
              ? 'bg-audio-signal text-black font-bold border-audio-signal shadow-glow-teal'
              : 'bg-audio-surface border-audio-border text-audio-muted hover:text-audio-text hover:border-audio-accent'
          }`}
          title="Copy lossless Base64 shareable URL"
        >
          <span>{copiedLink ? '✓ Copied Link' : '🔗 Share URL'}</span>
        </button>

        {onExportCsv && (
          <button
            type="button"
            onClick={onExportCsv}
            className="hidden sm:flex px-2.5 py-1.5 rounded-lg bg-audio-surface border border-audio-border text-xs font-mono text-audio-muted hover:text-audio-text transition-all"
            title="Download CSV frequency points"
          >
            <span>↓ CSV</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => labStore.closeLab()}
          className="px-3 py-1.5 rounded-lg bg-[#251812] border border-audio-border text-xs font-mono font-bold text-audio-text hover:bg-audio-warn hover:text-black transition-all"
          title="Close Graph Lab (ESC)"
        >
          ✕ Close
        </button>
      </div>
    </header>
  );
};

export default LabToolbar;
