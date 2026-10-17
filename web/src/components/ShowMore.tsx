import type { ApiError } from '../lib/errors';

/**
 * The "Show more" button under a Spotify list (decision D7: a button, not infinite scroll — every page
 * costs Spotify quota, so one is fetched only when someone asks). A failed page leaves what is loaded
 * in place and turns the button into a retry; Spotify's 429 gets its own wording.
 */
export function ShowMore({ hasMore, loading, error, onMore, label = 'Show more' }: {
  hasMore: boolean;
  loading: boolean;
  error: unknown;
  onMore: () => void;
  label?: string;
}) {
  if (!hasMore) return null;
  const text = loading ? 'Loading…'
    : error ? ((error as ApiError).status === 429 ? 'Spotify is busy — try again' : "Couldn't load more — try again")
    : label;
  return (
    <div className="flex justify-center pt-3">
      <button
        onClick={onMore}
        disabled={loading}
        className="px-4 py-2 rounded-xl border border-white/10 bg-white/4 hover:bg-white/8 text-[12px] font-semibold text-fg2 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-default"
      >
        {text}
      </button>
    </div>
  );
}
