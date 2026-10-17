import { useParams, useNavigate } from 'react-router-dom';
import { isNotFound } from '../lib/api';
import { isSpotifyId } from '../lib/spotifyId';
import { useAuth } from '../context/auth';
import { useRate } from '../context/rate';
import { SubjectHeroSkeleton } from '../components/Skeleton';
import { ErrorState } from '../components/ErrorState';
import { BackHeader, HeroBackdrop, AvgScore, SubjectReviewList } from '../components/subject';
import { loadMoreNearBottom } from '../lib/loadMore';
import { Discography } from '../components/Discography';
import { useArtist, useArtistReviews } from '../queries/catalog';
import { useMyReviews } from '../queries/reviews';
import { reviewedIds } from '../queries/reviewedIds';
import { flattenUnique } from '../queries/pagination';

export default function Artist() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const { setItem } = useRate();
  const nav = useNavigate();

  // The artist gates the page; the discography, reviews and "have I reviewed them" load alongside.
  const artistQ  = useArtist(id, !!token);
  const reviewsQ = useArtistReviews(id, !!token);
  const { data: mine } = useMyReviews();

  const artist          = artistQ.data;
  const firstPage       = reviewsQ.data?.pages[0];
  const reviews         = flattenUnique(reviewsQ.data?.pages, page => page.reviews);
  const avgScore        = firstPage?.avgScore ?? null;
  const ratingCount     = firstPage?.total ?? reviews.length;
  const alreadyReviewed = !!id && reviewedIds(mine ?? []).artists.has(id);

  function rateArtist() {
    if (!artist || alreadyReviewed) return;
    setItem({ type: 'artist', spotifyArtistId: artist.id, trackName: artist.name, artistName: artist.name, albumArt: artist.images[0]?.url ?? '' });
  }

  // A malformed id never queries (isSpotifyId), so it falls through to "not found" below.
  if (isSpotifyId(id) && artistQ.isPending) return (
    <div className="h-screen overflow-y-auto">
      <BackHeader onBack={() => nav(-1)} />
      <SubjectHeroSkeleton round />
    </div>
  );
  if (!artist) {
    // A request that failed is not the same as an artist that doesn't exist.
    if (artistQ.isError && !isNotFound(artistQ.error)) {
      return <ErrorState size="page" back title="Couldn't load this artist" error={artistQ.error} onRetry={() => void artistQ.refetch()} />;
    }
    return <div className="flex items-center justify-center h-screen text-fg3">Artist not found.</div>;
  }

  const img = artist.images?.[0]?.url;

  return (
    <div className="h-screen overflow-y-auto" onScroll={loadMoreNearBottom(reviewsQ)}>
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
          {avgScore !== null && <AvgScore value={avgScore} count={ratingCount} />}
          <div className="flex gap-3 mt-2 flex-wrap justify-center">
            {alreadyReviewed
              ? <span className="px-5 py-2.5 rounded-xl border border-white/10 text-fg3 text-[13px] font-semibold">Already reviewed</span>
              : <button onClick={rateArtist} className="px-5 py-2.5 rounded-xl font-semibold text-[13px] cursor-pointer text-white" style={{ background: 'linear-gradient(135deg, #FFFFFF, #E0685C)' }}>Rate artist</button>}
            {artist.external_urls?.spotify && <a href={artist.external_urls.spotify} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-[13px]" style={{ background: '#1DB954', color: '#000' }}>▶ Spotify</a>}
          </div>
        </div>

        {/* Discography: one tab per release type */}
        <Discography artistId={artist.id} enabled={!!token} />

        {/* Reviews */}
        <SubjectReviewList query={reviewsQ} reviews={reviews} />
      </div>
    </div>
  );
}
