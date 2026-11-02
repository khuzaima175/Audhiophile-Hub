import React, { useState, useEffect, useRef } from 'react';
import { GearItem } from '../types';
import { useDismissSurface } from '../hooks/useDismissSurface';
import Engraved from './ui/Engraved';

export interface SavePresetDialogValues {
  name: string;
  gearId: string | null;
  hardware: string;
  copy: boolean;
}

interface SavePresetDialogProps {
  isOpen: boolean;
  initialMode: 'save' | 'copy';
  canOverwriteExisting: boolean;
  initialName: string;
  initialGearId: string | null;
  initialHardware: string;
  gear: GearItem[];
  onClose: () => void;
  onSubmit: (values: SavePresetDialogValues) => void;
}

export const SavePresetDialog: React.FC<SavePresetDialogProps> = ({
  isOpen,
  initialMode,
  canOverwriteExisting,
  initialName,
  initialGearId,
  initialHardware,
  gear,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState(initialName);
  const [gearId, setGearId] = useState<string | null>(initialGearId);
  const [hardware, setHardware] = useState(initialHardware);
  const [validationError, setValidationError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useDismissSurface(isOpen, onClose, 60);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setGearId(initialGearId);
      setHardware(initialHardware);
      setValidationError(null);
      const timer = setTimeout(() => {
        nameInputRef.current?.focus();
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialName, initialGearId, initialHardware]);

  if (!isOpen) return null;

  const submitWithCopyFlag = (copy: boolean) => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setValidationError('Preset name is required.');
      nameInputRef.current?.focus();
      return;
    }
    setValidationError(null);
    onSubmit({
      name: trimmedName,
      gearId: gearId || null,
      hardware: hardware.trim(),
      copy,
    });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitWithCopyFlag(initialMode === 'copy');
  };

  const inputClass =
    'w-full bg-audio-surface border border-audio-border rounded-xl px-3.5 py-2 text-audio-text focus:outline-none focus:border-audio-accent/70 text-xs font-sans';
  const labelClass =
    'block text-[10px] font-bold text-audio-accent uppercase tracking-widest font-mono mb-1';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={initialMode === 'copy' ? 'Save EQ preset as copy' : 'Save EQ preset'}
        className="save-preset-dialog panel w-full max-w-md rounded-2xl border border-audio-accent/70 bg-audio-surface p-4 md:p-5 shadow-2xl space-y-4"
      >
        <div className="flex items-center justify-between gap-2">
          <Engraved size="xs" glow>
            {initialMode === 'copy'
              ? 'Save EQ preset as copy'
              : canOverwriteExisting
                ? 'Save EQ preset'
                : 'Save new EQ preset'}
          </Engraved>
          <span className="text-[10px] font-mono text-audio-muted">Browser library only</span>
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-3.5" noValidate>
          <div>
            <label className={labelClass} htmlFor="save-preset-name">
              Preset name *
            </label>
            <input
              ref={nameInputRef}
              id="save-preset-name"
              aria-label="Preset name"
              type="text"
              required
              autoFocus
              placeholder="e.g. Simgot EW300 Holographic Chill"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (validationError && e.target.value.trim()) setValidationError(null);
              }}
              className={inputClass}
            />
            {validationError && (
              <p role="alert" className="text-[11px] font-mono text-audio-warn mt-1">
                {validationError}
              </p>
            )}
          </div>

          <div>
            <label className={labelClass} htmlFor="save-preset-gear">
              Assigned gear
            </label>
            <select
              id="save-preset-gear"
              aria-label="Assigned gear"
              value={gearId || ''}
              onChange={(e) => {
                const selected = gear.find((g) => g.id === e.target.value);
                setGearId(selected?.id || null);
                if (selected) setHardware(selected.name);
              }}
              className={inputClass}
            >
              <option value="">Unlinked / custom hardware</option>
              {gear.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="save-preset-hardware">
              Hardware name
            </label>
            <input
              id="save-preset-hardware"
              aria-label="Hardware name"
              type="text"
              placeholder="e.g. Simgot EW300, CCA Phoenix..."
              value={hardware}
              onChange={(e) => setHardware(e.target.value)}
              className={inputClass}
            />
          </div>

          <p className="text-[11px] text-audio-muted leading-relaxed">
            Saves to your browser EQ library without modifying Windows Equalizer APO. Use{' '}
            <strong>Apply to Windows</strong> in the editor when you want to update system audio.
          </p>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-audio-border/60">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-mono text-audio-muted hover:text-audio-text"
            >
              Cancel
            </button>
            {canOverwriteExisting && initialMode === 'save' && (
              <button
                type="button"
                disabled={!name.trim()}
                onClick={() => submitWithCopyFlag(true)}
                className="secondary-button text-xs disabled:opacity-40"
              >
                Save as copy
              </button>
            )}
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-1.5 rounded-lg bg-audio-accent text-black font-mono font-bold text-xs hover:bg-audio-accent-bright shadow-glow-brass disabled:opacity-40"
            >
              {initialMode === 'copy' ? 'Save copy' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SavePresetDialog;
