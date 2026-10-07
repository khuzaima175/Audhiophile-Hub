import React from 'react';
import { Popover } from '../ui/Popover';
import { LabCurve } from '../../types';
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
      <Popover label={`Options for ${curve.name}`}>
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
          <button onClick={download}>Download original CSV</button>
          {!curve.isTarget && (
            <button className="danger-text" onClick={() => labStore.removeCurve(curve.id)}>
              Remove curve
            </button>
          )}
      </Popover>
      {curve.isTarget && onManualEq && <button className="secondary-button" onClick={onManualEq}>Start manual EQ</button>}
      {curve.provenance === 'measured' && !curve.isFilterCurve && onSendAutoPeq && (
        <button className="secondary-button curve-eq" onClick={() => onSendAutoPeq(curve)}>
          Generate correction ↗
        </button>
      )}
    </div>
  );
};
export default PerCurveRow;
