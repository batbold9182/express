/**
 * A tiny toast store with no dependencies. It lives outside React on purpose: the QueryClient's
 * global mutation error handler has to be able to raise a toast from anywhere, with no component in
 * scope. `<Toaster />` subscribes to it.
 */
type Toast = { id: number; message: string };

const VISIBLE_MS = 4000;

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

export function dismissToast(id: number) {
  if (!toasts.some(t => t.id === id)) return;
  toasts = toasts.filter(t => t.id !== id);
  emit();
}

/** Shows a message for a few seconds. An identical message already on screen is not stacked. */
export function toast(message: string) {
  if (toasts.some(t => t.message === message)) return;
  const id = nextId++;
  toasts = [...toasts, { id, message }];
  emit();
  setTimeout(() => dismissToast(id), VISIBLE_MS);
}

// useSyncExternalStore contract: subscribe + a snapshot that is referentially stable between changes.
export function subscribeToasts(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export const getToasts = () => toasts;
