import { useParams, useNavigate } from 'react-router-dom';
import { isNotFound } from '../lib/api';
import { isSpotifyId } from '../lib/spotifyId';
import { useAuth } from '../context/auth';
import { useRate } from '../context/rate';
import { msToMin, scoreColor } from '@tunelog/shared';
import { SubjectHeroSkeleton } from '../components/Skeleton';
import { ErrorState } from '../components/ErrorState';
import { BackHeader, HeroBackdrop, AvgScore, SubjectReviewList } from '../components/subject';
import { loadMoreNearBottom } from '../lib/loadMore';
import { useTrack, useTrackReviews } from '../queries/catalog';
import { useMyReviews } from '../queries/reviews';
import { reviewedIds } from '../queries/reviewedIds';
import { flattenUnique } from '../queries/pagination';

export default function Song() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const { setItem } = useRate();
  const nav = useNavigate();

  // The track gates the page; its reviews and "have I reviewed it" load alongside and never block it.
  const trackQ   = useTrack(id, !!token);
  const reviewsQ = useTrackReviews(id, !!token);
  const { data: mine } = useMyReviews();

  const track           = trackQ.data;
  const firstPage       = reviewsQ.data?.pages[0];
  const reviews         = flattenUnique(reviewsQ.data?.pages, page => page.reviews);
  const avgScore        = firstPage?.avgScore ?? null;
  const ratingCount     = firstPage?.total ?? reviews.length;
  const distribution    = firstPage?.distribution ?? Array(10).fill(0);
  const alreadyReviewed = !!id && reviewedIds(mine ?? []).tracks.has(id);

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

  // A malformed id never queries (isSpotifyId), so it falls through to "not found" below.
  if (isSpotifyId(id) && trackQ.isPending) return (
    <div className="h-screen overflow-y-auto">
      <BackHeader onBack={() => nav(-1)} />
      <SubjectHeroSkeleton />
    </div>
  );

  if (!track) {
    // A request that failed is not the same as a track that doesn't exist.
    if (trackQ.isError && !isNotFound(trackQ.error)) {
      return <ErrorState size="page" back title="Couldn't load this track" error={trackQ.error} onRetry={() => void trackQ.refetch()} />;
    }
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-fg3">Track not found.</p>
        <button onClick={() => nav(-1)} className="text-violet cursor-pointer">Go back</button>
      </div>
    );
  }

  const albumArt  = track.album.images[0]?.url;
  const artistStr = track.artists.map(a => a.name).join(', ');
  const year      = track.album.release_date?.slice(0, 4) ?? '';
  const maxDist   = Math.max(...distribution, 1);

  return (
    <div className="h-screen overflow-y-auto" onScroll={loadMoreNearBottom(reviewsQ)}>
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
          {avgScore !== null && <AvgScore value={avgScore} count={ratingCount} />}
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
                    background: scoreColor(i + 1),
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
        <SubjectReviewList query={reviewsQ} reviews={reviews} />
      </div>
    </div>
  );
}

