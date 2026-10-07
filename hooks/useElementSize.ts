import { useCallback, useLayoutEffect, useState } from 'react';

/** Measure the actual plot container, including when a workspace view is switched. */
export function useElementSize() {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const ref = useCallback((node: HTMLElement | null) => setElement(node), []);
  useLayoutEffect(() => {
    if (!element) return;
    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      setSize(previous => previous.width === Math.round(width) && previous.height === Math.round(height)
        ? previous : { width: Math.round(width), height: Math.round(height) });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, [element]);
  return { ref, size };
}
