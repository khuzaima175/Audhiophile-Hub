import { useEffect, useRef, useId } from 'react';
import { pushOverlay } from '../utils/overlayStack';

/**
 * Hook to register a component surface onto the centralized topmost overlay stack.
 *
 * When the surface is active, pressing Escape will close ONLY the topmost surface
 * registered in the stack, preventing multi-modal close collisions.
 */
export function useDismissSurface(active: boolean, close: () => void, _priority = 0) {
  const id = useId();
  const callback = useRef(close);
  callback.current = close;

  useEffect(() => {
    if (!active) return;
    const unregister = pushOverlay(id, () => callback.current());
    return () => {
      unregister();
    };
  }, [active, id]);
}
