import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShareButton } from './ShareButton';
import { scoreColor, MOOD_COLOR, subjectPath } from '@tunelog/shared';
import { SearchIcon } from './icons';
import { Spinner } from './Spinner';
import { ProfileReviewsSkeleton } from './Skeleton';
import { ErrorState } from './ErrorState';
import { useProfileReviews } from '../queries/users';
import { flattenUnique } from '../queries/pagination';
import { totalOf, type ReviewCounts } from '../queries/counts';

type Filter = 'all' | 'track' | 'album' | 'artist';

const CHIPS: { key: Filter; label: string }[] = [
  { key: 'all',    label: 'All'     },
  { key: 'track',  label: 'Songs'   },
  { key: 'album',  label: 'Albums'  },
  { key: 'artist', label: 'Artists' },
];

/**
 * A user's reviews — filter chips, search, infinite scroll. `userId` undefined means the signed-in
 * user. `counts` feeds the chip numbers; it is undefined when the counts request failed, in which
 * case the numbers are hidden rather than shown as a misleading 0.
 */
export function ProfileReviews({ userId, counts }: { userId?: string; counts?: ReviewCounts }) {
  const nav = useNavigate();

  const [filter,  setFilter]  = useState<Filter>('all');
  const [input,   setInput]   = useState('');   // raw search text
  const [query,   setQuery]   = useState('');   // debounced search text

  const chipCount = (k: Filter): number | null => (!counts ? null : k === 'all' ? totalOf(counts) : counts[k]);

  // Debounce the search input → query
  useEffect(() => {
    const t = setTimeout(() => setQuery(input.trim()), 300);
    return () => clearTimeout(t);
  }, [input]);

  // Filter and text are part of the query key: each combination is its own cached list, and the one
  // you were looking at stays on screen (dimmed) until the next arrives.
  const list = useProfileReviews(userId, filter, query);
  const reviews = flattenUnique(list.data?.pages, page => page.reviews);
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = list;

  // Infinite scroll: watch the nearest scrollable ancestor (the page's h-screen overflow-y-auto)
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const scroller = el.closest('.overflow-y-auto') as HTMLElement | null;
    if (!scroller) return;
    const onScroll = () => {
      if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 300 && hasNextPage && !isFetchingNextPage && !isFetchNextPageError) {
        void fetchNextPage();
      }
    };
    scroller.addEventListener('scroll', onScroll);
    return () => scroller.removeEventListener('scroll', onScroll);
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);

  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-widest text-fg3 mb-3">Reviews</p>

      {/* Search box */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/15 bg-white/6 mb-3">
        <SearchIcon size={16} stroke="#978A74" caps={false} />
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Search these reviews"
          className="flex-1 text-[14px] text-fg bg-transparent outline-none"
        />
        {input && <button onClick={() => setInput('')} className="text-fg3 cursor-pointer text-lg leading-none">✕</button>}
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
        {CHIPS.map(({ key, label }) => {
          const active = filter === key;
          const n = chipCount(key);
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className="px-3 py-1.5 rounded-full text-[12px] font-semibold border cursor-pointer whitespace-nowrap shrink-0 transition-colors"
              style={{
                borderColor: active ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.08)',
                background:  active ? 'rgba(255,255,255,0.15)' : 'transparent',
                color:       active ? '#FFFFFF' : '#978A74',
              }}
            >
              {label}{n !== null && <> <span className="tabular-nums opacity-70">{n}</span></>}
            </button>
          );
        })}
      </div>

      {/* List */}
      {list.isPending ? (
        <ProfileReviewsSkeleton />
      ) : list.isError && list.data === undefined ? (
        <ErrorState size="compact" title="Couldn't load reviews" error={list.error} onRetry={() => void list.refetch()} />
      ) : reviews.length === 0 ? (
        <p className="text-fg3 text-center text-[13px] py-8">{query ? 'No matches' : 'No reviews yet'}</p>
      ) : (
        <div className={`flex flex-col gap-3 transition-opacity ${list.isPlaceholderData ? 'opacity-60' : ''}`}>
          {reviews.map(r => {
            const goto = () => {
              const p = subjectPath(r);
              if (p) nav(p);
            };
            return (
            <div
              key={r._id}
              role="button"
              tabIndex={0}
              onClick={goto}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goto(); } }}
              className="flex gap-3 p-3 rounded-2xl border border-white/8 bg-white/4 hover:bg-white/8 transition-colors cursor-pointer text-left w-full items-start"
            >
              {r.albumArt ? <img src={r.albumArt} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" /> : <div className="w-12 h-12 rounded-lg bg-white/8 shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-fg flex-1 truncate">{r.trackName}</span>
                  <span className="text-[15px] font-bold tabular-nums shrink-0" style={{ color: scoreColor(r.score) }}>{r.score.toFixed(1)}</span>
                </div>
                <p className="text-[11px] text-fg3 truncate">{r.artistName}</p>
                {r.text && <p className="text-[12px] text-fg2 mt-1 line-clamp-2">{r.text}</p>}
                {(r.moods?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {r.moods!.map(m => <span key={m} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ color: MOOD_COLOR[m], background: `${MOOD_COLOR[m]}20` }}>{m}</span>)}
                  </div>
                )}
              </div>
              <div className="shrink-0" onClick={e => e.stopPropagation()}>
                <ShareButton review={r} iconOnly className="p-1.5 rounded-lg text-fg3 hover:text-fg cursor-pointer flex items-center" />
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Infinite-scroll sentinel + bottom indicators */}
      <div ref={sentinelRef} />
      {isFetchingNextPage && <div className="flex justify-center py-6"><Spinner size="sm" /></div>}
      {isFetchNextPageError && (
        <div className="flex justify-center py-4">
          <button onClick={() => void fetchNextPage()} className="text-[12px] text-fg3 hover:text-fg cursor-pointer">
            Couldn't load more — tap to retry
          </button>
        </div>
      )}
    </div>
  );
}
