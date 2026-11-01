/**
 * Centralized overlay stack for topmost Escape key handling.
 *
 * Ensures only the topmost visible overlay receives the Escape key event,
 * preventing multiple modals, drawers, or palettes from closing simultaneously.
 *
 * Rules:
 * 1. Only the topmost registered overlay handles Escape.
 * 2. Native <select> elements retain default Escape behavior to close their dropdowns.
 * 3. Open details popovers (e.g., .session-menu[open]) close before background overlays if focused.
 * 4. Safe for React 19 StrictMode double-mounting (idempotent registration and cleanup).
 */

type DismissHandler = () => void;

interface OverlayEntry {
  id: string;
  onDismiss: DismissHandler;
}

const stack: OverlayEntry[] = [];
let isListenerInstalled = false;

function handleKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;

  // Let native <select> handle Escape for its open options dropdown
  const activeElement = document.activeElement;
  if (activeElement && activeElement.tagName.toLowerCase() === 'select') {
    return;
  }

  // Check if any open inline menu/details popover has focus
  const openDetails = [...document.querySelectorAll<HTMLDetailsElement>('.session-menu[open], .composer-more[open], .curve-options[open], .lab-advanced[open]')]
    .filter(el => !el.closest('[inert]') && el.getClientRects().length > 0);
  const focusedDetail = openDetails.find(el => el.contains(activeElement));
  if (focusedDetail) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    focusedDetail.open = false;
    focusedDetail.querySelector<HTMLElement>('summary')?.focus();
    return;
  }

  if (stack.length === 0) return;

  // Dispatch exclusively to the topmost overlay
  const top = stack[stack.length - 1];
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  top.onDismiss();
}

function ensureListener() {
  if (!isListenerInstalled && typeof window !== 'undefined') {
    window.addEventListener('keydown', handleKeyDown, true); // Capture phase
    isListenerInstalled = true;
  }
}

export function pushOverlay(id: string, onDismiss: DismissHandler): () => void {
  ensureListener();
  // Remove if already present (e.g. StrictMode remount)
  const idx = stack.findIndex(entry => entry.id === id);
  if (idx !== -1) {
    stack.splice(idx, 1);
  }
  stack.push({ id, onDismiss });

  return () => {
    popOverlay(id);
  };
}

export function popOverlay(id: string): void {
  const idx = stack.findIndex(entry => entry.id === id);
  if (idx !== -1) {
    stack.splice(idx, 1);
  }
}

export function getOverlayCount(): number {
  return stack.length;
}

export function getTopOverlayId(): string | null {
  return stack.length > 0 ? stack[stack.length - 1].id : null;
}
