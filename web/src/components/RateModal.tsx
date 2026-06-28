import { useState, useEffect } from 'react';
import { useRate } from '../context/rate';
import { useAuth } from '../context/auth';
import { api } from '../lib/api';
import { scoreColor, MOOD_LIST, MAX_REVIEW_LENGTH, MAX_MOODS } from '@tunelog/shared';

export function RateModal() {
  const { item, setItem } = useRate();
  const { token } = useAuth();

  const [text,   setText]   = useState('');
  const [score,  setScore]  = useState(7.0);
  const [moods,  setMoods]  = useState<string[]>([]);
  const [busy,   setBusy]   = useState(false);
  const [done,   setDone]   = useState(false);

  useEffect(() => {
    if (item) { setText(''); setScore(7.0); setMoods([]); setDone(false); }
  }, [item]);

  if (!item) return null;

  function toggleMood(m: string) {
    setMoods(prev => prev.includes(m) ? prev.filter(x => x !== m) : prev.length < MAX_MOODS ? [...prev, m] : prev);
  }

  async function submit() {
    if (busy || !token) return;
    setBusy(true);
    try {
      const body: Record<string, any> = { text, score, moods, shareToFeed: true };
      if (item!.type === 'artist' && item!.spotifyArtistId) {
        body.spotifyArtistId = item!.spotifyArtistId;
        body.type = 'artist';
        body.trackName  = item!.trackName;
        body.artistName = item!.artistName;
        body.albumArt   = item!.albumArt;
      } else if (item!.type === 'album' && item!.spotifyAlbumId) {
        body.spotifyAlbumId = item!.spotifyAlbumId;
        body.type = 'album';
        body.trackName  = item!.trackName;
        body.artistName = item!.artistName;
        body.albumArt   = item!.albumArt;
      } else {
        body.spotifyTrackId = item!.spotifyTrackId;
        body.type = 'track';
        body.trackName  = item!.trackName;
        body.artistName = item!.artistName;
        body.albumArt   = item!.albumArt;
        if (item!.spotifyArtistId) body.spotifyArtistId = item!.spotifyArtistId;
        if (item!.spotifyAlbumId)  body.spotifyAlbumId  = item!.spotifyAlbumId;
      }
      await api.post('/reviews', body);
      setDone(true);
      setTimeout(() => setItem(null), 1200);
    } catch {} finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={e => { if (e.target === e.currentTarget) setItem(null); }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setItem(null)} />
      <div
        className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-6 flex flex-col gap-5 border border-white/10"
        style={{ background: '#110D1F', zIndex: 1 }}
      >
        {done ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="text-4xl">✓</div>
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

            <button
              onClick={submit}
              disabled={busy}
              className="w-full py-3 rounded-xl font-semibold text-[14px] transition-opacity disabled:opacity-50 cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #B14EFF, #FF3FA4)', color: '#fff' }}
            >
              {busy ? 'Posting…' : 'Post review'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
