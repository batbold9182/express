/** The few fields of one of the caller's reviews that say *what* it reviewed. */
export type ReviewIdRef = {
  type?: string;
  spotifyTrackId?: string;
  spotifyAlbumId?: string;
  spotifyArtistId?: string;
};

/**
 * Splits the caller's reviews into the sets of tracks, albums and artists they have reviewed, which
 * is what every "Reviewed" / "Already reviewed" badge needs. An artist or album review is recognised
 * by its `type`; everything else counts under its track id (older track reviews have no `type`).
 */
export function reviewedIds(reviews: ReviewIdRef[]) {
  const tracks = new Set<string>();
  const albums = new Set<string>();
  const artists = new Set<string>();
  for (const r of reviews) {
    if (r.type === 'artist' && r.spotifyArtistId) artists.add(r.spotifyArtistId);
    else if (r.type === 'album' && r.spotifyAlbumId) albums.add(r.spotifyAlbumId);
    else if (r.spotifyTrackId) tracks.add(r.spotifyTrackId);
  }
  return { tracks, albums, artists };
}
