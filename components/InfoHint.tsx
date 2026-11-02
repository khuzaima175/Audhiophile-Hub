import React, { useId, useRef, useState } from 'react';
import { useDismissSurface } from '../hooks/useDismissSurface';

/** Small ⓘ button that reveals explanatory text on demand instead of showing it inline. */
export const InfoHint: React.FC<{ label?: string; children: React.ReactNode }> = ({ label = 'More information', children }) => {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  useDismissSurface(open, () => setOpen(false), 5);
  return (
    <span className="info-hint" ref={ref} onBlur={event => { if (!ref.current?.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
      <button type="button" className="info-hint-button" aria-label={label} aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>i</button>
      {open && <span id={id} role="note" className="info-hint-popover">{children}</span>}
    </span>
  );
};

/** Click-to-open menu used to group secondary actions behind one button. */
export const MenuButton: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className = '' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismissSurface(open, () => setOpen(false), 6);
  return (
    <div className={`menu-button ${className}`} ref={ref} onBlur={event => { if (!ref.current?.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
      <button type="button" className="secondary-button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(value => !value)}>{label} ▾</button>
      {open && <div role="menu" className="menu-button-list" onClick={() => setOpen(false)}>{children}</div>}
    </div>
  );
};
