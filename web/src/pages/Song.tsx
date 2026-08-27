import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/auth';
import { useRate } from '../context/rate';
import { msToMin } from '../lib/format';
import { Spinner, PageSpinner } from '../components/Spinner';
import { BackHeader, HeroBackdrop, AvgScore, SubjectReviewRow } from '../components/subject';

type SpotifyTrack = {
  id: string; name: string; duration_ms: number;
  artists: { id: string; name: string }[];
  album: { id: string; name: string; images: { url: string }[]; release_date: string };
  external_urls: { spotify: string };
};
type TrackReview = {
  _id: string;
  userId: { _id: string; displayName: string; avatarUrl?: string; spotifyId: string };
  score: number; text?: string; moods?: string[]; createdAt: string;
};

export default function Song() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const { setItem } = useRate();
  const nav = useNavigate();

  const [track,           setTrack]           = useState<SpotifyTrack | null>(null);
  const [reviews,         setReviews]         = useState<TrackReview[]>([]);
  const [avgScore,        setAvgScore]        = useState<number | null>(null);
  const [distribution,    setDistribution]    = useState<number[]>(Array(10).fill(0));
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [loading,         setLoading]         = useState(true);
  const [loadingMore,     setLoadingMore]     = useState(false);
  const [hasMore,         setHasMore]         = useState(false);
  const offsetRef      = useRef(0);
  const loadingMoreRef = useRef(false);

  async function load() {
    if (!token || !id) return;
    setLoading(true); offsetRef.current = 0;
    try {
      const [t, rd, mine] = await Promise.allSettled([
        api.get(`/tracks/${id}`),
        api.get(`/tracks/${id}/reviews?offset=0&limit=20`),
        api.get('/reviews/mine'),
      ]);
      if (t.status === 'fulfilled') setTrack(t.value);
      if (rd.status === 'fulfilled') {
        setReviews(rd.value.reviews ?? []);
        setAvgScore(rd.value.avgScore ?? null);
        setDistribution(rd.value.distribution ?? Array(10).fill(0));
        setHasMore(rd.value.hasMore ?? false);
        offsetRef.current = (rd.value.reviews ?? []).length;
      }
      if (mine.status === 'fulfilled') {
        setAlreadyReviewed((mine.value as any[]).some((r: any) => r.spotifyTrackId === id && (!r.type || r.type === 'track')));
      }
    } finally { setLoading(false); }
  }

  async function loadMore() {
    if (!hasMore || loadingMoreRef.current || !id) return;
    loadingMoreRef.current = true; setLoadingMore(true);
    try {
      const rd = await api.get(`/tracks/${id}/reviews?offset=${offsetRef.current}&limit=20`);
      setReviews(prev => [...prev, ...(rd.reviews ?? [])]);
      setHasMore(rd.hasMore ?? false);
      offsetRef.current += (rd.reviews ?? []).length;
    } catch {} finally { loadingMoreRef.current = false; setLoadingMore(false); }
  }

  useEffect(() => { load(); }, [id, token]);

  function onScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 400) loadMore();
  }

  function rateTrack() {
    if (!track || alreadyReviewed) return;
    setItem({
      type: 'track',
      spotifyTrackId: track.id,
      spotifyAlbumId: track.album.id,
      spotifyArtistId: track.artists[0]?.id,
      trackName: track.name,
      artistName: track.artists.map(a => a.name).join(', '),
      albumArt: track.album.images[0]?.url ?? '',
    });
  }

  if (loading) return <PageSpinner />;

  if (!track) return (
    <div className="flex flex-col items-center justify-center h-screen gap-4">
      <p className="text-fg3">Track not found.</p>
      <button onClick={() => nav(-1)} className="text-violet cursor-pointer">Go back</button>
    </div>
  );

  const albumArt  = track.album.images[0]?.url;
  const artistStr = track.artists.map(a => a.name).join(', ');
  const year      = track.album.release_date?.slice(0, 4) ?? '';
  const maxDist   = Math.max(...distribution, 1);

  return (
    <div className="h-screen overflow-y-auto" onScroll={onScroll}>
      {/* Blurred hero */}
      {albumArt && <HeroBackdrop src={albumArt} heightClass="h-80" opacity={0.35} />}

      {/* Back button */}
      <BackHeader onBack={() => nav(-1)} />

      <div className="relative max-w-2xl mx-auto px-4 pb-20">
        {/* Hero content */}
        <div className="flex flex-col items-center gap-3 pt-4 pb-8">
          {albumArt
            ? <img src={albumArt} alt="" className="w-52 h-52 rounded-2xl border border-white/10 shadow-2xl object-cover" />
            : <div className="w-52 h-52 rounded-2xl bg-white/8" />}
          <h1 className="text-[26px] font-bold text-fg text-center leading-tight">{track.name}</h1>
          <p className="text-[15px] text-fg2">{artistStr}</p>
          <p className="text-[11px] text-fg3 uppercase tracking-widest">{year} · {msToMin(track.duration_ms)}</p>
          {avgScore !== null && <AvgScore value={avgScore} count={reviews.length} />}
          <div className="flex gap-3 mt-2 flex-wrap justify-center">
            {alreadyReviewed ? (
              <span className="px-5 py-2.5 rounded-xl border border-white/10 text-fg3 text-[13px] font-semibold">Already reviewed</span>
            ) : (
              <button
                onClick={rateTrack}
                className="px-5 py-2.5 rounded-xl font-semibold text-[13px] cursor-pointer text-white"
                style={{ background: 'linear-gradient(135deg, #FFFFFF, #E0685C)' }}
              >
                Rate it
              </button>
            )}
            <a
              href={track.external_urls.spotify}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-[13px]"
              style={{ background: '#1DB954', color: '#000' }}
            >
              ▶ Play on Spotify
            </a>
          </div>
        </div>

        {/* Distribution */}
        {reviews.length > 0 && (
          <div className="rounded-2xl border border-white/8 bg-white/4 p-4 mb-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-fg3 mb-3">Score distribution</p>
            <div className="flex items-end gap-1 h-11">
              {distribution.map((v, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm"
                  style={{
                    height: `${Math.max(4, (v / maxDist) * 100)}%`,
                    background: i >= 7 ? '#4B4E53' : i >= 4 ? '#FFFFFF' : i >= 2 ? '#EDA63E' : '#FFFFFF',
                  }}
                />
              ))}
            </div>
            <div className="flex justify-between mt-1.5 text-[9px] text-fg4">
              <span>1</span><span>5</span><span>10</span>
            </div>
          </div>
        )}

        {/* Reviews */}
        <p className="text-[11px] font-bold uppercase tracking-widest text-fg3 mb-3">Reviews</p>
        {reviews.length === 0 ? (
          <p className="text-fg3 text-[13px] text-center py-8">No reviews yet — be the first!</p>
        ) : (
          <div className="flex flex-col gap-3">
            {reviews.map(r => (
              <SubjectReviewRow key={r._id} review={r} />
            ))}
            {loadingMore && <div className="flex justify-center py-4"><Spinner size="md" /></div>}
          </div>
        )}
      </div>
    </div>
  );
}

