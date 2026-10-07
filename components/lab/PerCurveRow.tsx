import React from 'react';
import { Popover } from '../ui/Popover';
import { LabCurve } from '../../types';
import { channelImbalance } from '../../utils/graphTools';
import { labStore } from '../../store/labStore';
interface PerCurveRowProps {
  curve: LabCurve;
  isPrimary: boolean;
  onSendAutoPeq?: (curve: LabCurve) => void;
  onManualEq?: () => void;
  onToast?: (message: string) => void;
}
export const PerCurveRow: React.FC<PerCurveRowProps> = ({ curve, isPrimary, onSendAutoPeq, onManualEq, onToast }) => {
  const download = () => {
    const csv =
      'Frequency_Hz,dB\n' +
      curve.points.map((p) => `${p.freq},${p.gain.toFixed(3)}`).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = curve.name.replace(/[^a-z0-9]/gi, '_') + '.csv';
    a.click();
    URL.revokeObjectURL(url);
    onToast?.('Curve CSV downloaded');
  };
  const source =
    {
      measured: 'Measured',
      target: 'Reference target',
      'ai-estimate': 'AI estimate',
      'eq-compensated': 'EQ correction',
      custom: 'Custom',
    }[curve.provenance] || 'Custom';
  return (
    <div className={`curve-row ${isPrimary ? 'primary' : ''} ${curve.visible ? '' : 'muted'}`}>
      <label className="curve-visibility" title={curve.visible ? 'Hide curve' : 'Show curve'}>
        <input
          type="checkbox"
          aria-label={`Show ${curve.name}`}
          checked={curve.visible}
          onChange={() => labStore.toggleVisibility(curve.id)}
        />
        <span style={{ background: curve.color }} />
      </label>
      <button
        className="curve-title"
        onClick={() => labStore.setPrimaryCurve(curve.id)}
        title="Use this curve for cursor readouts"
      >
        <strong>{curve.name}</strong>
        <small>
          {source} · {curve.provenanceDetails} · {curve.points.length} points {isPrimary && '· Selected'}
        </small>
      </button>
      <label className="curve-offset">
        Offset
        <input
          type="number"
          aria-label={`Offset for ${curve.name}`}
          min="-12"
          max="12"
          step="0.5"
          value={curve.offset}
          onChange={(e) =>
            labStore.setOffset(curve.id, Math.max(-12, Math.min(12, Number(e.target.value) || 0)))
          }
        />
        dB
      </label>
      <div className="curve-options"><Popover label={`Options for ${curve.name}`} triggerText="Options">
          <label><input type="checkbox" checked={!!curve.pinned} onChange={e => labStore.updateCurve(curve.id, { pinned: e.target.checked })} />Pin curve</label>
          <label>Curve color<input type="color" aria-label={`Color for ${curve.name}`} value={curve.color} onChange={e => labStore.updateCurve(curve.id, { color: e.target.value })} /></label>
          <label>Measurement rig<input aria-label={`Rig for ${curve.name}`} value={curve.rig || ''} placeholder="e.g. IEC 60318-4" onChange={e => labStore.updateCurve(curve.id, { rig: e.target.value })} /></label>
          {curve.channels && <><label>Channels<select aria-label={`Channels for ${curve.name}`} value={curve.channel || 'average'} onChange={e => labStore.updateCurve(curve.id, { channel: e.target.value as LabCurve['channel'] })}><option value="average">Average L/R</option><option value="left">Left</option><option value="right">Right</option><option value="both">Both</option></select></label><p>Channel difference: {channelImbalance(curve)?.toFixed(2) ?? '—'} dB RMS (100 Hz–10 kHz)</p></>}
          <button onClick={() => labStore.setBaseline(curve.id)}>Use as baseline</button>
          {!curve.isTarget && (
            <>
              <label>
                <input
                  type="checkbox"
                  checked={!!curve.isInverted}
                  onChange={() => labStore.toggleInvertCurve(curve.id)}
                />
                Invert response
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={!!curve.deltaCompensate}
                  onChange={() => labStore.toggleDeltaCompensate(curve.id)}
                />
                Difference from target
              </label>
              <label>
                <input type="checkbox" checked={curve.solo} onChange={() => labStore.toggleSolo(curve.id)} />
                Isolate this curve
              </label>
            </>
          )}
          {curve.sourceUrl && /^https?:\/\//i.test(curve.sourceUrl) && <a href={curve.sourceUrl} target="_blank" rel="noopener noreferrer">Measurement source ↗</a>}
          <button onClick={download}>Download original CSV</button>
          {!curve.isTarget && (
            <button className="danger-text" onClick={() => labStore.removeCurve(curve.id)}>
              Remove curve
            </button>
          )}
      </Popover></div>
      {curve.isTarget && onManualEq && <button className="secondary-button curve-eq" onClick={onManualEq}>Start manual EQ</button>}
      {curve.provenance === 'measured' && !curve.isFilterCurve && onSendAutoPeq && (
        <button className="secondary-button curve-eq" onClick={() => onSendAutoPeq(curve)}>
          Generate correction ↗
        </button>
      )}
    </div>
  );
};
export default PerCurveRow;
