import React, { useLayoutEffect, useRef, useState, useId } from 'react';
import { createPortal } from 'react-dom';
import { useDismissSurface } from '../../hooks/useDismissSurface';
export function Popover({ label, triggerText, children }: { label: string; triggerText?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 8, top: 8, maxHeight: 300 });
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = () => { setOpen(false); trigger.current?.focus(); };
  useDismissSurface(open, close, 100);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = trigger.current?.getBoundingClientRect(), p = panel.current;
      if (!r || !p) return;
      const height = Math.min(p.scrollHeight, window.innerHeight - 16);
      const below = window.innerHeight - r.bottom - 8;
      setPosition({ left: Math.max(8, Math.min(r.right - p.offsetWidth, window.innerWidth - p.offsetWidth - 8)),
        top: below >= height ? r.bottom + 4 : Math.max(8, r.top - height - 4), maxHeight: window.innerHeight - 16 });
    };
    place();
    panel.current?.querySelector<HTMLElement>('button,input')?.focus();
    const outside = (e: PointerEvent) => { if (!panel.current?.contains(e.target as Node) && !trigger.current?.contains(e.target as Node)) close(); };
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    document.addEventListener('pointerdown', outside);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); document.removeEventListener('pointerdown', outside); };
  }, [open]);
  return <>
    <button ref={trigger} className="secondary-button" aria-label={label} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>{triggerText || label} ⌄</button>
    {open && createPortal(<div id={id} ref={panel} className="dropdown-menu portal-popover" style={position} role="group" aria-label={label}
      onKeyDown={e => {
        const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>('button,input') || []);
        const i = controls.indexOf(document.activeElement as HTMLElement);
        if (['ArrowDown','ArrowUp','Home','End','Tab'].includes(e.key)) {
          e.preventDefault();
          const next = e.key === 'Home' ? 0 : e.key === 'End' ? controls.length-1 : (i + (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey) ? -1 : 1) + controls.length) % controls.length;
          controls[next]?.focus();
        }
      }}>{children}</div>, document.body)}
  </>;
}
