import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { scoreColor, MOOD_LIST, spotifyUrlFor } from '@tunelog/shared';

const MOOD_COLOR = Object.fromEntries(MOOD_LIST.map(([m, c]) => [m, c]));
const BASE = import.meta.env.VITE_API_BASE as string;

const TYPE_CFG: Record<string, { label: string; color: string }> = {
  album:  { label: 'Album',  color: '#4FA3D1' },
  artist: { label: 'Artist', color: '#E0685C' },
  track:  { label: 'Track',  color: '#978A74' },
};

type PublicReview = {
  _id: string;
  type?: 'track' | 'album' | 'artist';
  spotifyTrackId?: string;
  spotifyAlbumId?: string;
  spotifyArtistId?: string;
  trackName: string;
  artistName: string;
  albumArt?: string;
  score: number;
  text?: string;
  moods?: string[];
  userId?: { displayName?: string; avatarUrl?: string };
};

export default function SharedReview() {
  const { id } = useParams<{ id: string }>();
  const [review, setReview] = useState<PublicReview | null>(null);
  const [status, setStatus] = useState<'loading' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    fetch(`${BASE}/reviews/${id}`)
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((d: PublicReview) => { if (!cancelled) { setReview(d); } })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, [id]);

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-bg text-fg flex flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="text-2xl font-bold tracking-tight">express</div>
        <p className="text-fg3 text-sm">This review isn’t available.</p>
        <Link to="/" className="px-5 py-2.5 rounded-full text-sm font-semibold text-bg" style={{ background: '#FFFFFF' }}>Open express</Link>
      </div>
    );
  }

  if (!review) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  const cfg = TYPE_CFG[review.type ?? 'track'];
  const sc = scoreColor(review.score);
  const spotifyUrl = spotifyUrlFor(review);
  const author = review.userId?.displayName ?? 'Someone';

  return (
    <div className="min-h-screen bg-bg text-fg flex flex-col items-center px-4 py-8" style={{ background: `linear-gradient(160deg, #07060b 30%, ${cfg.color}22 100%)` }}>
      <div className="w-full max-w-md flex flex-col gap-5">
        {/* Wordmark */}
        <div className="flex items-center justify-between">
          <span className="text-xl font-extrabold tracking-tight">express</span>
          <Link to="/" className="text-[12px] font-semibold text-fg3 hover:text-fg transition-colors">Open app →</Link>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-white/8 overflow-hidden" style={{ background: 'rgba(18,16,16,0.78)' }}>
          {review.albumArt
            ? <img src={review.albumArt} alt="" className="w-full aspect-square object-cover" />
            : <div className="w-full aspect-square bg-white/6" />}

          <div className="p-5 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-[19px] font-bold leading-tight line-clamp-2">{review.trackName}</div>
                <div className="text-[14px] text-fg2 truncate">{review.artistName}</div>
                <span className="inline-block text-[10px] font-bold mt-1.5 px-2 py-0.5 rounded-full" style={{ color: cfg.color, background: `${cfg.color}25` }}>{cfg.label}</span>
              </div>
              <div className="shrink-0 flex flex-col items-center rounded-2xl px-3.5 py-2 border" style={{ background: `${sc}12`, borderColor: `${sc}35` }}>
                <span className="text-[28px] font-extrabold tabular-nums leading-none" style={{ color: sc }}>{review.score.toFixed(1)}</span>
                <span className="text-[10px] text-fg4 font-semibold mt-0.5">/10</span>
              </div>
            </div>

            {!!review.text && <p className="text-[14px] text-fg2 leading-relaxed">“{review.text}”</p>}

            {(review.moods?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {review.moods!.map(m => (
                  <span key={m} className="text-[11px] font-semibold px-2.5 py-1 rounded-full border" style={{ color: MOOD_COLOR[m], borderColor: `${MOOD_COLOR[m]}50`, background: `${MOOD_COLOR[m]}18` }}>{m}</span>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2.5 pt-1 border-t border-white/6 mt-1">
              <Avatar name={author} src={review.userId?.avatarUrl} size={30} />
              <span className="text-[13px] font-semibold text-fg2">{author}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        {spotifyUrl && (
          <a href={spotifyUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 py-3 rounded-full font-semibold text-[14px]" style={{ background: '#1DB954', color: '#04120A' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
            Listen on Spotify
          </a>
        )}

        <Link to="/" className="flex items-center justify-center py-3 rounded-full font-semibold text-[14px] text-bg" style={{ background: '#FFFFFF' }}>
          See more reviews on express
        </Link>
      </div>
    </div>
  );
}
