import { useEffect, useRef } from 'react';
const surfaces: { close: () => void; priority: number }[] = [];
let installed = false;
function dispatch(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;
  const surface = [...surfaces].sort((a, b) => b.priority - a.priority).at(0);
  if (!surface || surface.priority <= 10) {
    const disclosures = [...document.querySelectorAll<HTMLDetailsElement>('.session-menu[open], .composer-more[open], .lab-advanced[open]')]
      .filter(element => !element.closest('[inert]') && element.getClientRects().length > 0);
    const disclosure = disclosures.find(element => element.contains(document.activeElement)) ?? disclosures.at(-1);
    if (disclosure) {
      event.preventDefault();
      event.stopImmediatePropagation();
      disclosure.open = false;
      disclosure.querySelector<HTMLElement>('summary')?.focus();
      return;
    }
  }
  if (surface) {
    event.preventDefault();
    event.stopImmediatePropagation();
    surface.close();
  }
}
export function useDismissSurface(active: boolean, close: () => void, priority = 0) {
  const callback = useRef(close);
  callback.current = close;
  useEffect(() => {
    if (!installed) { window.addEventListener('keydown', dispatch, true); installed = true; }
    if (!active) return;
    const surface = { close: () => callback.current(), priority };
    surfaces.unshift(surface);
    return () => { const i = surfaces.indexOf(surface); if (i >= 0) surfaces.splice(i, 1); };
  }, [active, priority]);
}
