/** What the rating sheet knows about the thing being rated. */
type RateTarget = {
  type?: 'track' | 'album' | 'artist';
  spotifyTrackId?: string;
  spotifyAlbumId?: string;
  spotifyArtistId?: string;
  trackName: string;
  artistName: string;
  albumArt: string;
};

type ReviewFields = { text: string; score: number; moods: string[] };

/**
 * The body of `POST /reviews`. An artist or an album review carries only its own id; a *track* review
 * carries the track id plus the album and artist ids when known, which makes the artist name on its card
 * navigable. (Scores stay per type: the album and artist pages do not count track reviews.)
 */
export function buildReviewBody(item: RateTarget, fields: ReviewFields) {
  const base = {
    ...fields,
    shareToFeed: true,
    trackName: item.trackName,
    artistName: item.artistName,
    albumArt: item.albumArt,
  };
  if (item.type === 'artist' && item.spotifyArtistId) {
    return { ...base, type: 'artist' as const, spotifyArtistId: item.spotifyArtistId };
  }
  if (item.type === 'album' && item.spotifyAlbumId) {
    return { ...base, type: 'album' as const, spotifyAlbumId: item.spotifyAlbumId };
  }
  return {
    ...base,
    type: 'track' as const,
    ...(item.spotifyTrackId ? { spotifyTrackId: item.spotifyTrackId } : {}),
    ...(item.spotifyArtistId ? { spotifyArtistId: item.spotifyArtistId } : {}),
    ...(item.spotifyAlbumId ? { spotifyAlbumId: item.spotifyAlbumId } : {}),
  };
}

export type ReviewBody = ReturnType<typeof buildReviewBody>;
