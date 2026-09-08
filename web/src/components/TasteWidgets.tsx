import { useNavigate } from 'react-router-dom';
import { scoreColor, subjectPath } from '@tunelog/shared';
import type { ProfileReview } from '@tunelog/shared';

/** Favourites grid + rating histogram — the taste snapshot on /me and /profile/:id. Fed by
 *  `tasteStats()` in lib/taste.ts (kept there so this file only exports components). */

const LABEL = 'text-[11px] font-bold uppercase tracking-widest text-fg3 mb-3';

/** One follower/following/reviews count — used in the identity header on /me and /profile/:id. */
export function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[18px] font-bold text-fg tabular-nums leading-none">{value}</span>
      <span className="text-[10px] font-bold uppercase tracking-widest text-fg3">{label}</span>
    </div>
  );
}

export function Favorites({ items }: { items: ProfileReview[] }) {
  const nav = useNavigate();
  if (items.length === 0) return null;
  return (
    <div>
      <p className={LABEL}>Favorites</p>
      <div className="rounded-2xl border border-white/8 bg-white/4 p-3">
        <div className="grid grid-cols-4 gap-2">
          {items.map(r => {
            const p = subjectPath(r);
            const dark = r.score >= 5 && r.score < 8.5;
            return (
              <button
                key={r._id}
                onClick={() => { if (p) nav(p); }}
                title={`${r.trackName} · ${r.score.toFixed(1)}`}
                className="relative aspect-square rounded-lg overflow-hidden bg-white/6 cursor-pointer"
              >
                {r.albumArt && <img src={r.albumArt} alt="" className="w-full h-full object-cover" />}
                <span
                  className="absolute bottom-1 right-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md tabular-nums"
                  style={{ background: scoreColor(r.score), color: dark ? '#0A0A0A' : '#FFFFFF' }}
                >
                  {r.score.toFixed(1)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function RatingHistogram({ dist, maxDist, label = 'How you rate' }: { dist: number[]; maxDist: number; label?: string }) {
  return (
    <div>
      <p className={LABEL}>{label}</p>
      <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
        <div className="flex items-end gap-1 h-14">
          {dist.map((v, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm"
              style={{ height: `${Math.max(6, (v / maxDist) * 100)}%`, background: scoreColor(i + 1) }}
            />
          ))}
        </div>
        <div className="flex justify-between mt-1.5 text-[9px] text-fg4">
          <span>1</span><span>5</span><span>10</span>
        </div>
      </div>
    </div>
  );
}
