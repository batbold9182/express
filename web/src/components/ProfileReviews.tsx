import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { scoreColor, MOOD_LIST } from '@tunelog/shared';
import type { ProfileReview } from '@tunelog/shared';

const MOOD_COLOR = Object.fromEntries(MOOD_LIST.map(([m, c]) => [m, c]));

type Filter = 'all' | 'track' | 'album' | 'artist';
type Counts = { track: number; album: number; artist: number };

const PAGE = 20;

const CHIPS: { key: Filter; label: string }[] = [
  { key: 'all',    label: 'All'     },
  { key: 'track',  label: 'Songs'   },
  { key: 'album',  label: 'Albums'  },
  { key: 'artist', label: 'Artists' },
];

export function ProfileReviews({ endpointBase, counts }: { endpointBase: string; counts: Counts }) {
  const nav = useNavigate();

  const [filter,  setFilter]  = useState<Filter>('all');
  const [input,   setInput]   = useState('');   // raw search text
  const [query,   setQuery]   = useState('');   // debounced search text
  const [reviews, setReviews] = useState<ProfileReview[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadingRef = useRef(false);
  const offsetRef  = useRef(0);

  const total = counts.track + counts.album + counts.artist;
  const chipCount = (k: Filter) => (k === 'all' ? total : counts[k]);

  // Debounce the search input → query
  useEffect(() => {
    const t = setTimeout(() => setQuery(input.trim()), 300);
    return () => clearTimeout(t);
  }, [input]);

  // (Re)load from the top whenever filter or query changes
  useEffect(() => {
    let cancelled = false;
    offsetRef.current = 0;
    loadingRef.current = true;
    setLoading(true);
    const url = `${endpointBase}?type=${filter}&q=${encodeURIComponent(query)}&offset=0&limit=${PAGE}`;
    api.get(url)
      .then((d: any) => {
        if (cancelled) return;
        const list = d.reviews ?? [];
        setReviews(list);
        offsetRef.current = list.length;
        setHasMore(d.hasMore ?? false);
      })
      .catch(() => { if (!cancelled) { setReviews([]); setHasMore(false); } })
      .finally(() => { if (!cancelled) { setLoading(false); loadingRef.current = false; } });
    return () => { cancelled = true; };
  }, [endpointBase, filter, query]);

  async function loadMore() {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    try {
      const url = `${endpointBase}?type=${filter}&q=${encodeURIComponent(query)}&offset=${offsetRef.current}&limit=${PAGE}`;
      const d = await api.get(url);
      const list = d.reviews ?? [];
      setReviews(prev => [...prev, ...list]);
      offsetRef.current += list.length;
      setHasMore(d.hasMore ?? false);
    } catch {} finally {
      loadingRef.current = false;
    }
  }

  // Infinite scroll: watch the nearest scrollable ancestor (the page's h-screen overflow-y-auto)
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const scroller = el.closest('.overflow-y-auto') as HTMLElement | null;
    if (!scroller) return;
    const onScroll = () => {
      if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 300) loadMore();
    };
    scroller.addEventListener('scroll', onScroll);
    return () => scroller.removeEventListener('scroll', onScroll);
  });

  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-widest text-fg3 mb-3">Reviews</p>

      {/* Search box */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/15 bg-white/6 mb-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#978A74" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Search these reviews"
          className="flex-1 text-[14px] text-fg bg-transparent outline-none"
        />
        {input && <button onClick={() => setInput('')} className="text-fg3 cursor-pointer text-lg leading-none">✕</button>}
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
        {CHIPS.map(({ key, label }) => {
          const active = filter === key;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className="px-3 py-1.5 rounded-full text-[12px] font-semibold border cursor-pointer whitespace-nowrap shrink-0 transition-colors"
              style={{
                borderColor: active ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.08)',
                background:  active ? 'rgba(255,255,255,0.15)' : 'transparent',
                color:       active ? '#FFFFFF' : '#978A74',
              }}
            >
              {label} <span className="tabular-nums opacity-70">{chipCount(key)}</span>
            </button>
          );
        })}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-violet/30 border-t-violet rounded-full animate-spin" /></div>
      ) : reviews.length === 0 ? (
        <p className="text-fg3 text-center text-[13px] py-8">{query ? 'No matches' : 'No reviews yet'}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {reviews.map(r => (
            <button key={r._id} onClick={() => {
              if (r.type === 'artist' && r.spotifyArtistId) nav(`/artist/${r.spotifyArtistId}`);
              else if (r.type === 'album' && r.spotifyAlbumId) nav(`/album/${r.spotifyAlbumId}`);
              else if (r.spotifyTrackId) nav(`/song/${r.spotifyTrackId}`);
            }} className="flex gap-3 p-3 rounded-2xl border border-white/8 bg-white/4 hover:bg-white/8 transition-colors cursor-pointer text-left w-full">
              {r.albumArt ? <img src={r.albumArt} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" /> : <div className="w-12 h-12 rounded-lg bg-white/8 shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-fg flex-1 truncate">{r.trackName}</span>
                  <span className="text-[15px] font-bold tabular-nums shrink-0" style={{ color: scoreColor(r.score) }}>{r.score.toFixed(1)}</span>
                </div>
                <p className="text-[11px] text-fg3 truncate">{r.artistName}</p>
                {r.text && <p className="text-[12px] text-fg2 mt-1 line-clamp-2">{r.text}</p>}
                {(r.moods?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {r.moods!.map(m => <span key={m} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ color: MOOD_COLOR[m], background: `${MOOD_COLOR[m]}20` }}>{m}</span>)}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Infinite-scroll sentinel + bottom spinner */}
      <div ref={sentinelRef} />
      {!loading && hasMore && (
        <div className="flex justify-center py-6"><div className="w-5 h-5 border-2 border-violet/30 border-t-violet rounded-full animate-spin" /></div>
      )}
    </div>
  );
}
