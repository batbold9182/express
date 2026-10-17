import { useNavigate } from 'react-router-dom';
import type { UseInfiniteQueryResult } from '@tanstack/react-query';
import { Avatar } from './Avatar';
import { Score } from './Score';
import { Spinner } from './Spinner';
import { SubjectReviewsSkeleton } from './Skeleton';
import { ErrorState } from './ErrorState';
import { MOOD_COLOR } from '@tunelog/shared';
import type { SubjectReview } from '../queries/catalog';

/**
 * The pieces Song, Album and Artist render identically.
 *
 * Deliberately NOT a page shell — the three pages differ in hero shape and mid-section
 * (Song draws a score histogram, Album a track list, Artist a discography). All three
 * page their reviews the same way, so the list lives here (its scroll trigger is
 * `loadMoreNearBottom` in lib/loadMore.ts); the query itself stays in the page.
 */

/** The parts of a reviews infinite query that the list reads. */
type ReviewPagesQuery = Pick<
  UseInfiniteQueryResult,
  'isPending' | 'isError' | 'error' | 'data' | 'refetch' | 'isFetchingNextPage' | 'isFetchNextPageError' | 'fetchNextPage'
>;

/** The "Reviews" section: loading, error, empty, then the rows and the next-page spinner or retry. */
export function SubjectReviewList({ query: q, reviews }: { query: ReviewPagesQuery; reviews: SubjectReview[] }) {
  return (
    <>
      <p className="text-[11px] font-bold uppercase tracking-widest text-fg3 mb-3">Reviews</p>
      {q.isPending ? (
        <SubjectReviewsSkeleton />
      ) : q.isError && q.data === undefined ? (
        <ErrorState size="compact" title="Couldn't load reviews" error={q.error} onRetry={() => void q.refetch()} />
      ) : reviews.length === 0 ? (
        <p className="text-fg3 text-[13px] text-center py-8">No reviews yet — be the first!</p>
      ) : (
        <div className="flex flex-col gap-3">
          {reviews.map(r => (
            <SubjectReviewRow key={r._id} review={r} />
          ))}
          {q.isFetchingNextPage && <div className="flex justify-center py-4"><Spinner size="md" /></div>}
          {q.isFetchNextPageError && (
            <div className="flex justify-center py-4">
              <button onClick={() => void q.fetchNextPage()} className="text-[12px] text-fg3 hover:text-fg cursor-pointer">
                Couldn't load more — tap to retry
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/** Sticky translucent bar holding the back button. */
export function BackHeader({ onBack, bg = 'rgba(0,0,0,0.7)' }: { onBack: () => void; bg?: string }) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 px-4 pt-4 pb-2" style={{ background: bg, backdropFilter: 'blur(12px)' }}>
      <button onClick={onBack} className="p-2 rounded-full bg-white/8 border border-white/10 cursor-pointer text-fg hover:text-violet">
        ← Back
      </button>
    </div>
  );
}

/**
 * Blurred cover art bleeding behind the hero.
 *
 * All three props are required on purpose: Song runs taller and stronger (h-80 /
 * 0.35) than Album and Artist (h-72 / 0.3), and a single `tall` flag would tie the
 * height to the opacity — a coupling that isn't real.
 */
export function HeroBackdrop({ src, heightClass, opacity }: { src: string; heightClass: string; opacity: number }) {
  return (
    <div className={`absolute inset-x-0 top-0 ${heightClass} overflow-hidden pointer-events-none`} style={{ opacity }}>
      <img src={src} alt="" className="w-full h-full object-cover blur-2xl scale-110" />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent, #000000)' }} />
    </div>
  );
}

/** Community average score plus the rating count. */
export function AvgScore({ value, count }: { value: number; count: number }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <Score value={value} size="lg" />
      <p className="text-[12px] text-fg3">{count} {count === 1 ? 'rating' : 'ratings'}</p>
    </div>
  );
}

/** One review in the list on a track / album / artist page. */
export function SubjectReviewRow({ review: r }: { review: SubjectReview }) {
  const nav = useNavigate();
  return (
    <div className="rounded-2xl border border-white/8 bg-white/4 p-3 flex gap-3">
      <button onClick={() => nav(`/profile/${r.userId.spotifyId}`)} className="cursor-pointer shrink-0">
        <Avatar name={r.userId.displayName || '?'} src={r.userId.avatarUrl} size={36} />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <button onClick={() => nav(`/profile/${r.userId.spotifyId}`)} className="text-[13px] font-semibold text-fg cursor-pointer hover:text-violet">{r.userId.displayName}</button>
          <Score value={r.score} size="sm" />
        </div>
        {r.text && <p className="text-[13px] text-fg2 leading-[1.5]">{r.text}</p>}
        {(r.moods?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {r.moods!.map(m => (
              <span key={m} className="text-[10px] font-semibold px-2 py-0.5 rounded-full border" style={{ color: MOOD_COLOR[m], borderColor: `${MOOD_COLOR[m]}50`, background: `${MOOD_COLOR[m]}18` }}>{m}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
