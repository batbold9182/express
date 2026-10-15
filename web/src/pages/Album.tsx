import { useParams, useNavigate } from 'react-router-dom';
import { isNotFound } from '../lib/api';
import { useAuth } from '../context/auth';
import { useRate } from '../context/rate';
import { msToMin } from '@tunelog/shared';
import { PageSpinner, Spinner } from '../components/Spinner';
import { ErrorState } from '../components/ErrorState';
import { BackHeader, HeroBackdrop, AvgScore, SubjectReviewRow } from '../components/subject';
import { useAlbum, useAlbumReviews } from '../queries/catalog';
import { useMyReviews } from '../queries/reviews';
import { reviewedIds } from '../queries/reviewedIds';

export default function Album() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const { setItem } = useRate();
  const nav = useNavigate();

  // The album gates the page; its reviews and "have I reviewed it" load alongside and never block it.
  const albumQ   = useAlbum(id, !!token);
  const reviewsQ = useAlbumReviews(id, !!token);
  const { data: mine } = useMyReviews();

  const album           = albumQ.data;
  const reviews         = reviewsQ.data?.reviews ?? [];
  const avgScore        = reviewsQ.data?.avgScore ?? null;
  const alreadyReviewed = !!id && reviewedIds(mine ?? []).albums.has(id);

  function rateAlbum() {
    if (!album || alreadyReviewed) return;
    setItem({
      type: 'album',
      spotifyAlbumId: album.id,
      spotifyArtistId: album.artists[0]?.id,
      trackName: album.name,
      artistName: album.artists.map(a => a.name).join(', '),
      albumArt: album.images[0]?.url ?? '',
    });
  }

  if (albumQ.isPending) return <PageSpinner />;
  if (!album) {
    // A request that failed is not the same as an album that doesn't exist.
    if (albumQ.isError && !isNotFound(albumQ.error)) {
      return <ErrorState size="page" back title="Couldn't load this album" error={albumQ.error} onRetry={() => void albumQ.refetch()} />;
    }
    return <div className="flex items-center justify-center h-screen text-fg3">Album not found.</div>;
  }

  const art = album.images[0]?.url;
  const artistStr = album.artists.map(a => a.name).join(', ');

  return (
    <div className="h-screen overflow-y-auto">
      {art && <HeroBackdrop src={art} heightClass="h-72" opacity={0.3} />}

      <BackHeader onBack={() => nav(-1)} />

      <div className="relative max-w-2xl mx-auto px-4 pb-20">
        {/* Hero */}
        <div className="flex flex-col items-center gap-3 pt-4 pb-8">
          {art ? <img src={art} alt="" className="w-52 h-52 rounded-2xl border border-white/10 shadow-2xl object-cover" />
               : <div className="w-52 h-52 rounded-2xl bg-white/8" />}
          <span className="text-[10px] font-bold uppercase tracking-widest text-cyan border border-cyan/30 bg-cyan/10 px-2.5 py-0.5 rounded-full">Album</span>
          <h1 className="text-[24px] font-bold text-fg text-center leading-tight">{album.name}</h1>
          <button onClick={() => nav(`/artist/${album.artists[0]?.id}`)} className="text-[15px] text-violet cursor-pointer hover:opacity-80">{artistStr} ›</button>
          <p className="text-[11px] text-fg3 uppercase tracking-widest">{album.release_date?.slice(0, 4)} · {album.total_tracks} tracks</p>
          {avgScore !== null && <AvgScore value={avgScore} count={reviews.length} />}
          <div className="flex gap-3 mt-2 flex-wrap justify-center">
            {alreadyReviewed
              ? <span className="px-5 py-2.5 rounded-xl border border-white/10 text-fg3 text-[13px] font-semibold">Already reviewed</span>
              : <button onClick={rateAlbum} className="px-5 py-2.5 rounded-xl font-semibold text-[13px] cursor-pointer text-white" style={{ background: 'linear-gradient(135deg, #FFFFFF, #E0685C)' }}>Rate it</button>}
            <a href={album.external_urls.spotify} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-[13px]" style={{ background: '#1DB954', color: '#000' }}>▶ Open on Spotify</a>
          </div>
        </div>

        {/* Track list */}
        <p className="text-[11px] font-bold uppercase tracking-widest text-fg3 mb-2">Tracks</p>
        <div className="rounded-2xl border border-white/8 bg-white/4 divide-y divide-white/6 mb-5">
          {album.tracks.items.map(t => (
            <button key={t.id} onClick={() => nav(`/song/${t.id}`)} className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-white/5 transition-colors cursor-pointer text-left">
              <span className="text-[11px] text-fg4 w-6 text-center shrink-0">{t.track_number}</span>
              <span className="flex-1 text-[13px] text-fg truncate">{t.name}</span>
              <span className="text-[11px] text-fg4 shrink-0">{msToMin(t.duration_ms)}</span>
            </button>
          ))}
        </div>

        {/* Reviews */}
        <p className="text-[11px] font-bold uppercase tracking-widest text-fg3 mb-3">Reviews</p>
        {reviewsQ.isPending
          ? <div className="flex justify-center py-8"><Spinner size="md" /></div>
          : reviewsQ.isError
          ? <ErrorState size="compact" title="Couldn't load reviews" error={reviewsQ.error} onRetry={() => void reviewsQ.refetch()} />
          : reviews.length === 0
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
