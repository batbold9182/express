import { useNavigate } from 'react-router-dom';
import { describeError } from '../lib/api';

// 'page'    — fills the viewport (a detail page whose main request failed)
// 'section' — a tall block inside an already-rendered page (a feed, a leaderboard)
// 'compact' — a short block inside a card or a rail
const SPACING = { page: 'h-screen justify-center', section: 'py-24', compact: 'py-6' } as const;

type Props = {
  error?: unknown;
  title?: string;
  onRetry?: () => void;
  /** Adds a "Go back" button — for detail pages, which have no header to navigate from. */
  back?: boolean;
  size?: keyof typeof SPACING;
};

/**
 * What a failed load looks like. Deliberately not the empty state: "nothing here" and "we couldn't
 * find out" are different statements. Coral rather than `text-red`, which is currently white.
 */
export function ErrorState({ error, title = "Couldn't load this", onRetry, back = false, size = 'section' }: Props) {
  const nav = useNavigate();
  const btn = 'px-5 py-2 rounded-xl border border-white/10 bg-white/6 text-fg2 text-[13px] font-semibold cursor-pointer';
  return (
    <div role="alert" className={`flex flex-col items-center text-center gap-3 px-8 ${SPACING[size]}`}>
      <p className="font-semibold" style={{ color: '#E0685C' }}>{title}</p>
      <p className="text-fg3 text-[13px]">{describeError(error)}</p>
      {(onRetry || back) && (
        <div className="flex gap-2 mt-1">
          {onRetry && <button onClick={onRetry} className={btn}>Try again</button>}
          {back && <button onClick={() => nav(-1)} className={btn}>Go back</button>}
        </div>
      )}
    </div>
  );
}
