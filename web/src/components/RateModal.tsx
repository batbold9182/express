import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRate, type RateItem } from '../context/rate';
import { useAuth } from '../context/auth';
import { api } from '../lib/api';
import { invalidate, mutationMessage } from '../queries/client';
import { afterReviewChange } from '../queries/invalidation';
import { buildReviewBody, type ReviewBody } from '../queries/reviewBody';
import { scoreColor, MOOD_LIST, MAX_REVIEW_LENGTH, MAX_MOODS } from '@tunelog/shared';
import { CheckIcon } from './icons';

/**
 * The sheet itself is keyed by what is being rated, so opening it for a different item starts with
 * a fresh form — no effect that resets the fields when `item` changes.
 */
export function RateModal() {
  const { item } = useRate();
  if (!item) return null;
  return <RateSheet key={`${item.type ?? 'track'}:${item.spotifyTrackId ?? item.spotifyAlbumId ?? item.spotifyArtistId}`} item={item} />;
}

function RateSheet({ item }: { item: RateItem }) {
  const { setItem } = useRate();
  const { token } = useAuth();

  const [text,   setText]   = useState('');
  const [score,  setScore]  = useState(7.0);
  const [moods,  setMoods]  = useState<string[]>([]);
  const [done,   setDone]   = useState(false);

  // The sheet shows the failure itself (`meta.inline`) — notably the server's 409 "You already
  // reviewed this track" — so there is no toast on top of it.
  const mutation = useMutation({
    mutationFn: (body: ReviewBody) => api.post('/reviews', body),
    meta: { inline: true },
    onSuccess: (_result, body) => {
      // Everything cached that this review changes: the "Reviewed" badges, the leaderboards, the
      // item's own page, the feed.
      void invalidate(afterReviewChange(body));
      setDone(true);
    },
  });
  const busy = mutation.isPending;

  // Close shortly after "Review posted!". Cleared if the sheet goes away first, so it can never close
  // a sheet that was opened for something else in the meantime.
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setItem(null), 1200);
    return () => clearTimeout(t);
  }, [done, setItem]);

  function toggleMood(m: string) {
    setMoods(prev => prev.includes(m) ? prev.filter(x => x !== m) : prev.length < MAX_MOODS ? [...prev, m] : prev);
  }

  function submit() {
    if (busy || !token) return;
    mutation.mutate(buildReviewBody(item, { text, score, moods }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={e => { if (e.target === e.currentTarget) setItem(null); }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setItem(null)} />
      <div
        className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-6 flex flex-col gap-5 border border-white/10"
        style={{ background: '#0E0E0E', zIndex: 1 }}
      >
        {done ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <span className="w-12 h-12 rounded-full flex items-center justify-center bg-white/8 text-fg"><CheckIcon size={24} /></span>
            <p className="text-fg font-semibold text-lg">Review posted!</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-3">
              {item.albumArt
                ? <img src={item.albumArt} alt="" className="w-12 h-12 rounded-lg object-cover" />
                : <div className="w-12 h-12 rounded-lg bg-white/8" />}
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold text-fg truncate">{item.trackName}</p>
                <p className="text-[12px] text-fg3 truncate">{item.artistName}</p>
              </div>
              <button onClick={() => setItem(null)} className="text-fg3 hover:text-fg cursor-pointer text-xl leading-none">✕</button>
            </div>

            {/* Score */}
            <div>
              <div className="flex justify-between text-[12px] mb-1.5">
                <span className="text-fg3 font-medium">Score</span>
                <span className="font-bold text-[15px]" style={{ color: scoreColor(score) }}>{score.toFixed(1)}</span>
              </div>
              <input
                type="range" min={0} max={10} step={0.1}
                value={score} onChange={e => setScore(+e.target.value)}
                className="w-full accent-violet"
              />
            </div>

            {/* Text */}
            <div>
              <textarea
                value={text}
                onChange={e => setText(e.target.value.slice(0, MAX_REVIEW_LENGTH))}
                placeholder="Write a review… (optional)"
                rows={3}
                className="w-full text-[13px] text-fg bg-white/5 border border-white/10 rounded-xl p-3 resize-none outline-none focus:border-violet transition-colors placeholder:text-fg4"
              />
              <div className="text-[11px] text-fg4 text-right mt-1">{text.length}/{MAX_REVIEW_LENGTH}</div>
            </div>

            {/* Moods */}
            <div>
              <div className="text-[12px] text-fg3 mb-2 flex justify-between">
                <span>Mood</span><span>{moods.length}/{MAX_MOODS}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {MOOD_LIST.map(([m, mc]) => (
                  <button
                    key={m}
                    onClick={() => toggleMood(m)}
                    className="px-2.5 py-1 rounded-full text-[11px] font-semibold border cursor-pointer transition-all"
                    style={{
                      color: mc,
                      borderColor: moods.includes(m) ? mc : `${mc}40`,
                      background: moods.includes(m) ? `${mc}22` : 'transparent',
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {mutation.isError && (
              <p role="alert" className="text-[12px] text-center" style={{ color: '#E0685C' }}>{mutationMessage(mutation.error)}</p>
            )}

            <button
              onClick={submit}
              disabled={busy}
              className="w-full py-3 rounded-xl font-semibold text-[14px] transition-opacity disabled:opacity-50 cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #FFFFFF, #E0685C)', color: '#fff' }}
            >
              {busy ? 'Posting…' : 'Post review'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
