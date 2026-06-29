import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { scoreColor } from '@tunelog/shared';
import type { FeedItem } from '@tunelog/shared';

export function TopScoredWidget() {
  const nav = useNavigate();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ items: FeedItem[] }>('/reviews/top?offset=0&limit=5')
      .then(d => setItems(d.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function navItem(item: FeedItem) {
    if (item.type === 'artist' && item.spotifyArtistId) nav(`/artist/${item.spotifyArtistId}`);
    else if (item.type === 'album' && item.spotifyAlbumId) nav(`/album/${item.spotifyAlbumId}`);
    else if (item.spotifyTrackId) nav(`/song/${item.spotifyTrackId}`);
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/8 p-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
        <div className="h-4 w-20 rounded bg-white/8 animate-pulse mb-4" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <div className="w-9 h-9 rounded-lg bg-white/8 animate-pulse shrink-0" />
            <div className="flex-1 h-3 rounded bg-white/8 animate-pulse" />
            <div className="w-7 h-4 rounded bg-white/8 animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="rounded-2xl border border-white/8 p-4 flex flex-col gap-0.5" style={{ background: 'rgba(255,255,255,0.03)' }}>
      <p className="text-[11px] font-bold uppercase tracking-widest text-fg3 mb-2">Top Scores</p>

      {items.map(item => {
        const color = scoreColor(item.score);
        return (
          <button
            key={item._id}
            onClick={() => navItem(item)}
            className="flex items-center gap-3 py-2 rounded-xl hover:bg-white/5 -mx-2 px-2 transition-colors cursor-pointer text-left"
          >
            {item.albumArt
              ? <img src={item.albumArt} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0 border border-white/8" />
              : <div className="w-9 h-9 rounded-lg bg-white/6 border border-white/8 shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-fg truncate">{item.trackName}</p>
              <p className="text-[11px] text-fg4 truncate">{item.artistName}</p>
            </div>
            <span className="shrink-0 text-[13px] font-bold tabular-nums" style={{ color }}>
              {item.score.toFixed(1)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
