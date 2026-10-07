import React, { useState } from 'react';
import { useLabStore, labStore } from '../../store/labStore';
import { TARGET_CURVES } from '../../constants/targetCurves';
import { LabZoomRange, LabViewMode, SmoothingType } from '../../types';
import { encodeLabStateToUrl } from '../../utils/shareCodec';
interface LabToolbarProps {
  showComparisonControls?: boolean;
  workspaceNavigation?: React.ReactNode;
  onNewPreset?: () => void;
  onExportCsv?: () => void;
  onToast?: (message: string) => void;
}
export function LabToolbar({ onExportCsv, onToast, showComparisonControls = true, workspaceNavigation, onNewPreset }: LabToolbarProps) {
  const state = useLabStore();
  const [copied, setCopied] = useState(false);
  const share = async () => {
    try {
      await navigator.clipboard.writeText(encodeLabStateToUrl(state));
      setCopied(true);
      onToast?.('Share link copied');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      onToast?.('Could not copy the link. Check your clipboard permissions.');
    }
  };
  return (
    <header className="lab-toolbar">
      <div className="lab-toolbar-top">
        <div>
          <h1>Graph lab</h1>
          <p>
            Compare curves, create EQ, and save presets in one workspace.
          </p>
        </div>
        <div className="lab-toolbar-actions">
          {onNewPreset && <button className="primary-button" onClick={onNewPreset}>New EQ preset</button>}
          {showComparisonControls && <button className="secondary-button" onClick={share}>
            {copied ? 'Copied ✓' : 'Share graph'}
          </button>}
          {showComparisonControls && onExportCsv && (
            <button className="secondary-button" onClick={onExportCsv}>
              Export CSV
            </button>
          )}
          <button className="secondary-button" onClick={() => labStore.closeLab()}>
            Close ×
          </button>
        </div>
      </div>
      {workspaceNavigation}
      {showComparisonControls && <div className="lab-toolbar-controls">
        <label className="control-field">
          Reference target
          <select value={state.targetCurveId} onChange={(e) => labStore.setTargetCurveId(e.target.value)}>
            {TARGET_CURVES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.shortName}
              </option>
            ))}
            <option value="none">No target</option>
          </select>
        </label>
        <label className="control-field">
          Graph view
          <select
            value={state.viewMode || 'rawFilter'}
            onChange={(e) => labStore.setViewMode(e.target.value as LabViewMode)}
          >
            <option disabled={!state.curves.some(c => c.isFilterCurve && c.sourceTargetId)} value="reconstructed">Estimated response</option>
            <option value="rawFilter">Source / EQ correction</option>
            <option disabled={!state.curves.some(c => c.isFilterCurve && c.sourceTargetId)} value="netPostEq">After EQ (inferred)</option>
          </select>
        </label>
        <label className="control-field">
          Frequency range
          <select
            value={state.zoomRange}
            onChange={(e) => labStore.setZoomRange(e.target.value as LabZoomRange)}
          >
            <option value="full">Full · 20 Hz–20 kHz</option>
            <option value="bass">Bass · 20–250 Hz</option>
            <option value="mids">Mids · 250 Hz–4 kHz</option>
            <option value="treble">Treble · 4–20 kHz</option>
          </select>
        </label>
        <label className="control-field">
          Smoothing
          <select
            aria-label="Smoothing"
            value={state.smoothing}
            onChange={(e) => labStore.setSmoothing(e.target.value as SmoothingType)}
          >
            <option value="RAW">None (raw)</option>
            <option value="1/6 OCT">1/6 octave</option>
            <option value="1/3 OCT">1/3 octave</option>
          </select>
        </label>
        <details className="lab-advanced section-disclosure">
          <summary>Advanced</summary>
          <div className="lab-normalize">
            <label className="control-field">Fitting smoothing (source data)<select value={state.fitSmoothing || 'RAW'} onChange={e => labStore.setFitSettings(e.target.value as SmoothingType, state.fitNormalize ?? true)}><option>RAW</option><option>1/6 OCT</option><option>1/3 OCT</option></select></label>
            <label><input type="checkbox" checked={state.fitNormalize ?? true} onChange={e => labStore.setFitSettings(state.fitSmoothing || 'RAW', e.target.checked)} />Fit normalized at 1 kHz</label>
            <label className="control-field">
              Level (dB)
              <input
                type="number"
                step="0.5"
                value={state.normDb}
                onChange={(e) => labStore.setNormalize(Number(e.target.value) || 0, state.normHz)}
              />
            </label>
            <label className="control-field">
              Anchor (Hz)
              <input
                type="number"
                min="20"
                max="20000"
                value={state.normHz}
                onChange={(e) =>
                  labStore.setNormalize(
                    state.normDb,
                    Math.max(20, Math.min(20000, Number(e.target.value) || 1000)),
                  )
                }
              />
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={state.deltaMode}
                onChange={(e) => labStore.setDeltaMode(e.target.checked)}
              />
              Show difference from target
            </label>
          </div>
        </details>
      </div>}
    </header>
  );
}
export default LabToolbar;
