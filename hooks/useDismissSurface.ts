import { useEffect, useRef } from 'react';
const surfaces: { close: () => void; priority: number }[] = [];
let installed = false;
function dispatch(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;
  const surface = [...surfaces].sort((a, b) => b.priority - a.priority).at(0);
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
    if (!active) return;
    if (!installed) { window.addEventListener('keydown', dispatch, true); installed = true; }
    const surface = { close: () => callback.current(), priority };
    surfaces.unshift(surface);
    return () => { const i = surfaces.indexOf(surface); if (i >= 0) surfaces.splice(i, 1); };
  }, [active, priority]);
}
