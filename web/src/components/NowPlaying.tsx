import { useEffect, useState } from 'react';
import { useAuth } from '../context/auth';
import { useRate } from '../context/rate';
import { api } from '../lib/api';

type NowPlayingData = {
  is_playing: boolean;
  progress_ms: number;
  item: {
    id: string;
    name: string;
    duration_ms: number;
    artists: { id: string; name: string }[];
    album: {
      id: string;
      name: string;
      images: { url: string }[];
    };
  };
};

export function NowPlaying() {
  const { token } = useAuth();
  const { setItem } = useRate();
  const [data, setData] = useState<NowPlayingData | null>(null);

  useEffect(() => {
    if (!token) return;

    async function poll() {
      try {
        const res = await api.get<NowPlayingData>('/me/player/currently-playing');
        setData(res && res.is_playing ? res : null);
      } catch {
        setData(null);
      }
    }

    poll();
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, [token]);

  if (!data) return null;

  const { item, progress_ms } = data;
  const pct = Math.min(100, Math.round((progress_ms / item.duration_ms) * 100));
  const art = item.album.images[0]?.url ?? '';

  return (
    <div className="mx-1 my-2 rounded-xl border border-white/10 bg-white/5 p-3 flex flex-col gap-2 overflow-hidden">
      <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">Now Playing</span>
      <div className="flex items-center gap-2.5">
        {art && (
          <img src={art} alt={item.name} className="w-11 h-11 rounded-md shrink-0 object-cover" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate leading-tight">{item.name}</p>
          <p className="text-xs text-white/45 truncate mt-0.5">{item.artists[0]?.name}</p>
        </div>
      </div>
      <div className="h-0.5 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full bg-violet rounded-full transition-all duration-1000" style={{ width: `${pct}%` }} />
      </div>
      <button
        onClick={() =>
          setItem({
            type: 'track',
            spotifyTrackId: item.id,
            spotifyAlbumId: item.album.id,
            spotifyArtistId: item.artists[0]?.id,
            trackName: item.name,
            artistName: item.artists[0]?.name ?? '',
            albumArt: art,
          })
        }
        className="w-full text-[12px] font-semibold text-violet hover:text-white hover:bg-violet/20 py-1.5 rounded-lg border border-violet/30 transition-colors"
      >
        Rate it →
      </button>
    </div>
  );
}
