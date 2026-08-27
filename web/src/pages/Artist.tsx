import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/auth';
import { useRate } from '../context/rate';
import { PageSpinner } from '../components/Spinner';
import { BackHeader, HeroBackdrop, AvgScore, SubjectReviewRow } from '../components/subject';

type SpotifyArtist = { id: string; name: string; images: { url: string }[]; genres: string[]; external_urls: { spotify: string } };
type SpotifyAlbum  = { id: string; name: string; images: { url: string }[]; release_date: string };
type ArtistReview  = { _id: string; userId: { _id: string; displayName: string; avatarUrl?: string; spotifyId: string }; score: number; text?: string; moods?: string[] };

export default function Artist() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const { setItem } = useRate();
  const nav = useNavigate();

  const [artist,          setArtist]          = useState<SpotifyArtist | null>(null);
  const [albums,          setAlbums]          = useState<SpotifyAlbum[]>([]);
  const [reviews,         setReviews]         = useState<ArtistReview[]>([]);
  const [avgScore,        setAvgScore]        = useState<number | null>(null);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [loading,         setLoading]         = useState(true);

  useEffect(() => {
    if (!token || !id) return;
    setLoading(true);
    Promise.allSettled([
      api.get(`/artists/${id}`),
      api.get(`/artists/${id}/albums`),
      api.get(`/artists/${id}/reviews?offset=0&limit=20`),
      api.get('/reviews/mine'),
    ]).then(([a, alb, rd, mine]) => {
      if (a.status === 'fulfilled') setArtist(a.value);
      if (alb.status === 'fulfilled') setAlbums(alb.value?.items ?? []);
      if (rd.status === 'fulfilled') { setReviews(rd.value.reviews ?? []); setAvgScore(rd.value.avgScore ?? null); }
      if (mine.status === 'fulfilled') {
        setAlreadyReviewed((mine.value as any[]).some((r: any) => r.spotifyArtistId === id && r.type === 'artist'));
      }
    }).finally(() => setLoading(false));
  }, [id, token]);

  function rateArtist() {
    if (!artist || alreadyReviewed) return;
    setItem({ type: 'artist', spotifyArtistId: artist.id, trackName: artist.name, artistName: artist.name, albumArt: artist.images[0]?.url ?? '' });
  }

  if (loading) return <PageSpinner />;
  if (!artist) return <div className="flex items-center justify-center h-screen text-fg3">Artist not found.</div>;

  const img = artist.images?.[0]?.url;

  return (
    <div className="h-screen overflow-y-auto">
      {img && <HeroBackdrop src={img} heightClass="h-72" opacity={0.3} />}

      <BackHeader onBack={() => nav(-1)} />

      <div className="relative max-w-2xl mx-auto px-4 pb-20">
        {/* Hero */}
        <div className="flex flex-col items-center gap-3 pt-4 pb-8">
          {img ? <img src={img} alt="" className="w-40 h-40 rounded-full border-2 border-pink/40 shadow-2xl object-cover" />
               : <div className="w-40 h-40 rounded-full bg-white/8" />}
          <span className="text-[10px] font-bold uppercase tracking-widest text-pink border border-pink/30 bg-pink/10 px-2.5 py-0.5 rounded-full">Artist</span>
          <h1 className="text-[26px] font-bold text-fg text-center">{artist.name}</h1>
          {(artist.genres?.length ?? 0) > 0 && <p className="text-[12px] text-fg3">{artist.genres.slice(0, 3).join(' · ')}</p>}
          {avgScore !== null && <AvgScore value={avgScore} count={reviews.length} />}
          <div className="flex gap-3 mt-2 flex-wrap justify-center">
            {alreadyReviewed
              ? <span className="px-5 py-2.5 rounded-xl border border-white/10 text-fg3 text-[13px] font-semibold">Already reviewed</span>
              : <button onClick={rateArtist} className="px-5 py-2.5 rounded-xl font-semibold text-[13px] cursor-pointer text-white" style={{ background: 'linear-gradient(135deg, #FFFFFF, #E0685C)' }}>Rate artist</button>}
            {artist.external_urls?.spotify && <a href={artist.external_urls.spotify} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-[13px]" style={{ background: '#1DB954', color: '#000' }}>▶ Spotify</a>}
          </div>
        </div>

        {/* Albums */}
        {albums.length > 0 && (
          <>
            <p className="text-[11px] font-bold uppercase tracking-widest text-fg3 mb-3">Albums</p>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {albums.slice(0, 10).map(a => (
                <button key={a.id} onClick={() => nav(`/album/${a.id}`)} className="flex flex-col gap-2 p-2 rounded-xl border border-white/8 bg-white/4 hover:bg-white/8 transition-colors cursor-pointer text-left">
                  {a.images[0]?.url ? <img src={a.images[0].url} alt="" className="w-full aspect-square rounded-lg object-cover" /> : <div className="w-full aspect-square rounded-lg bg-white/8" />}
                  <p className="text-[12px] font-semibold text-fg truncate">{a.name}</p>
                  <p className="text-[11px] text-fg4">{a.release_date?.slice(0, 4)}</p>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Reviews */}
        <p className="text-[11px] font-bold uppercase tracking-widest text-fg3 mb-3">Reviews</p>
        {reviews.length === 0
          ? <p className="text-fg3 text-[13px] text-center py-8">No reviews yet — be the first!</p>
          : <div className="flex flex-col gap-3">
              {reviews.map(r => (
                <SubjectReviewRow key={r._id} review={r} />
              ))}
            </div>}
      </div>
    </div>
  );
}
