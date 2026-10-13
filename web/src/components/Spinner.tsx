import { useEffect, useState } from 'react';

const BOX = { sm: 'w-5 h-5', md: 'w-6 h-6', lg: 'w-8 h-8' } as const;

// How long a load can run before we say why it's slow. A cold-starting backend takes 30-60s.
const SLOW_HINT_MS = 6000;

/** The app's loading spinner. Class order matches the markup it replaces. */
export function Spinner({ size = 'lg' }: { size?: keyof typeof BOX }) {
  return <div className={`${BOX[size]} border-2 border-violet/30 border-t-violet rounded-full animate-spin`} />;
}

/**
 * Renders nothing for the first few seconds, then explains the wait. Mount it beside a spinner:
 * it lives exactly as long as the loading state does, so the timer resets on every new load.
 */
function SlowHint() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), SLOW_HINT_MS);
    return () => clearTimeout(t);
  }, []);
  if (!slow) return null;
  return <p className="text-fg3 text-[12px] text-center max-w-xs px-6">Waking the server up — the first load can take up to a minute.</p>;
}

/** Full-height centred spinner — the first-load state on the detail pages. */
export function PageSpinner() {
  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4">
      <Spinner />
      <SlowHint />
    </div>
  );
}

/** Centred spinner for a list that is loading inside an already-rendered page. */
export function ListSpinner() {
  return (
    <div className="flex flex-col items-center gap-4 py-24">
      <Spinner />
      <SlowHint />
    </div>
  );
}
