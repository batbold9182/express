import { useSyncExternalStore } from 'react';
import { dismissToast, getToasts, subscribeToasts } from '../lib/toast';

/** Renders the toast stack. Mount once, near the root. Sits above the mobile bottom nav. */
export function Toaster() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts);
  if (toasts.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-0 right-0 z-[60] bottom-32 md:bottom-6 flex flex-col items-center gap-2 px-4 pointer-events-none"
    >
      {toasts.map(t => (
        <button
          key={t.id}
          onClick={() => dismissToast(t.id)}
          className="pointer-events-auto max-w-sm w-full text-left rounded-xl border border-white/10 px-4 py-2.5 text-[13px] text-fg shadow-lg cursor-pointer"
          style={{ background: '#121010', borderLeft: '3px solid #E0685C' }}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
