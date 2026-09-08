import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

// Both the desktop sidebar card and the mobile bar render from this. It polls twice today (one
// per mounted consumer); Phase G collapses it to a single `useQuery(['now-playing'])` with
// `refetchInterval`, which dedupes for free. Only ever mounted inside <Layout>, so a token is
// always present.
function useNowPlaying(): NowPlayingData | null {
  const [data, setData] = useState<NowPlayingData | null>(null);

  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const res = await api.get<NowPlayingData>('/me/player/currently-playing');
        if (alive) setData(res && res.is_playing ? res : null);
      } catch {
        if (alive) setData(null);
      }
    }
    poll();
    const id = setInterval(poll, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  return data;
}

function rateItem(item: NowPlayingData['item'], art: string) {
  return {
    type: 'track' as const,
    spotifyTrackId: item.id,
    spotifyAlbumId: item.album.id,
    spotifyArtistId: item.artists[0]?.id,
    trackName: item.name,
    artistName: item.artists[0]?.name ?? '',
    albumArt: art,
  };
}

/** Desktop sidebar card. */
export function NowPlaying() {
  const { setItem } = useRate();
  const data = useNowPlaying();

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
        onClick={() => setItem(rateItem(item, art))}
        className="w-full text-[12px] font-semibold text-violet hover:text-white hover:bg-violet/20 py-1.5 rounded-lg border border-violet/30 transition-colors"
      >
        Rate it →
      </button>
    </div>
  );
}

/**
 * Mobile mini-player — pinned above the bottom nav (Spotify-style), but the control slot is our
 * Rate action rather than playback (we only hold read scope, and rating is the point). Tap the
 * track to open its page; tap Rate to open the rating sheet.
 */
export function NowPlayingBar() {
  const nav = useNavigate();
  const { setItem } = useRate();
  const data = useNowPlaying();

  if (!data) return null;

  const { item, progress_ms } = data;
  const pct = Math.min(100, Math.round((progress_ms / item.duration_ms) * 100));
  const art = item.album.images[0]?.url ?? '';

  return (
    <div className="relative overflow-hidden border-t border-white/10" style={{ background: '#0A0A0A' }}>
      {/* album-art wash */}
      {art && (
        <>
          <img
            src={art}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover blur-2xl scale-125 opacity-40 pointer-events-none"
          />
          <div className="absolute inset-0 bg-black/45 pointer-events-none" />
        </>
      )}

      {/* progress */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/15">
        <div className="h-full bg-white transition-all duration-1000" style={{ width: `${pct}%` }} />
      </div>

      <div className="relative flex items-center gap-3 px-3 py-2">
        <button
          onClick={() => nav(`/song/${item.id}`)}
          className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer text-left"
        >
          {art
            ? <img src={art} alt="" className="w-9 h-9 rounded-md object-cover shrink-0" />
            : <div className="w-9 h-9 rounded-md bg-white/10 shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-white truncate leading-tight">{item.name}</p>
            <p className="text-[11px] text-white/55 truncate">{item.artists[0]?.name}</p>
          </div>
        </button>
        <button
          onClick={() => setItem(rateItem(item, art))}
          aria-label={`Rate ${item.name}`}
          className="shrink-0 text-[12px] font-bold px-3.5 py-1.5 rounded-full text-white cursor-pointer active:scale-95 transition-transform"
          style={{ background: 'linear-gradient(135deg, #FFFFFF, #E0685C)' }}
        >
          Rate
        </button>
      </div>
    </div>
  );
}
