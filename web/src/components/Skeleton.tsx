import { SlowHint } from './Spinner';

/**
 * Placeholder shapes shown on a first load instead of a lone spinner. Each mirrors the box of the
 * thing it stands in for (padding, radius, image size), so the content lands without a jump.
 * Refetches never show these: they only replace the `isPending` state, when there is no data yet.
 */

/** One grey block. The pulse is skipped for people who asked for reduced motion. */
function Bone({ className = '' }: { className?: string }) {
  return <div className={`rounded bg-white/8 motion-safe:animate-pulse ${className}`} />;
}

/** Wraps a group of placeholders: announced once as loading, and keeps the cold-start hint. */
function Loading({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-label="Loading" aria-busy="true" className={className}>
      {children}
      <div className="col-span-full flex justify-center pt-2"><SlowHint /></div>
    </div>
  );
}

/** Stands in for a `ReviewCard` in the feed. */
function ReviewCardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/7 bg-white/5 p-4 flex flex-col gap-3" style={{ borderLeft: '3px solid rgba(255,255,255,0.12)' }}>
      <div className="flex items-center gap-2.5">
        <Bone className="w-9 h-9 rounded-full! shrink-0" />
        <div className="flex-1 flex flex-col gap-1.5">
          <Bone className="h-3 w-28" />
          <Bone className="h-2.5 w-14" />
        </div>
      </div>
      <div className="flex gap-3 items-center">
        <Bone className="w-14 h-14 rounded-xl! shrink-0" />
        <div className="flex-1 flex flex-col gap-1.5">
          <Bone className="h-3.5 w-3/5" />
          <Bone className="h-3 w-2/5" />
        </div>
        <Bone className="w-14 h-11 rounded-xl! shrink-0" />
      </div>
      <Bone className="h-3 w-4/5" />
    </div>
  );
}

export function FeedSkeleton({ count = 4 }: { count?: number }) {
  return (
    <Loading className="flex flex-col gap-3 p-4 max-w-2xl xl:mx-0 xl:max-w-none xl:mr-0">
      {Array.from({ length: count }, (_, i) => <ReviewCardSkeleton key={i} />)}
    </Loading>
  );
}

/** Stands in for a `SubjectReviewRow` (a review on a track / album / artist page). */
export function SubjectReviewsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <Loading className="flex flex-col gap-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-2xl border border-white/8 bg-white/4 p-3 flex gap-3">
          <Bone className="w-9 h-9 rounded-full! shrink-0" />
          <div className="flex-1 flex flex-col gap-2 pt-0.5">
            <Bone className="h-3 w-32" />
            <Bone className="h-3 w-4/5" />
          </div>
        </div>
      ))}
    </Loading>
  );
}

/** Stands in for a row of `ProfileReviews`. */
export function ProfileReviewsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <Loading className="flex flex-col gap-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex gap-3 p-3 rounded-2xl border border-white/8 bg-white/4 items-start">
          <Bone className="w-12 h-12 rounded-lg! shrink-0" />
          <div className="flex-1 flex flex-col gap-1.5 pt-0.5">
            <Bone className="h-3 w-1/2" />
            <Bone className="h-2.5 w-1/3" />
            <Bone className="h-2.5 w-3/4 mt-1" />
          </div>
        </div>
      ))}
    </Loading>
  );
}

/** Stands in for the artist page's discography grid (two columns of square covers). */
export function AlbumGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <Loading className="grid grid-cols-2 gap-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-2 p-2 rounded-xl border border-white/8 bg-white/4">
          <Bone className="w-full aspect-square rounded-lg!" />
          <Bone className="h-3 w-3/4" />
          <Bone className="h-2.5 w-10" />
        </div>
      ))}
    </Loading>
  );
}

/**
 * The hero of a Song, Album or Artist page while the subject loads: cover (round for an artist),
 * title, subtitle, meta line and the two buttons. The back header is drawn by the page.
 */
export function SubjectHeroSkeleton({ round = false }: { round?: boolean }) {
  return (
    <Loading className="relative max-w-2xl mx-auto px-4 pb-20">
      <div className="flex flex-col items-center gap-3 pt-4 pb-8">
        {round ? <Bone className="w-40 h-40 rounded-full!" /> : <Bone className="w-52 h-52 rounded-2xl!" />}
        <Bone className="h-6 w-56 mt-1" />
        <Bone className="h-4 w-36" />
        <Bone className="h-3 w-24" />
        <div className="flex gap-3 mt-2">
          <Bone className="h-10 w-24 rounded-xl!" />
          <Bone className="h-10 w-36 rounded-xl!" />
        </div>
      </div>
    </Loading>
  );
}
