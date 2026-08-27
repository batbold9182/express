import { useNavigate } from 'react-router-dom';
import { Avatar } from './Avatar';
import { Score } from './Score';
import { MOOD_COLOR } from '@tunelog/shared';

/**
 * The pieces Song, Album and Artist render identically.
 *
 * Deliberately NOT a page shell — the three pages differ in hero shape, mid-section
 * and, crucially, in paging: Song paginates and draws a score histogram while Album
 * and Artist fetch a single page. None of these components know anything about
 * fetching, so that asymmetry is preserved by construction.
 */

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

export type SubjectReview = {
  _id: string;
  userId: { _id: string; displayName: string; avatarUrl?: string; spotifyId: string };
  score: number;
  text?: string;
  moods?: string[];
};

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
