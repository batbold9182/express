/** Anything that points at a reviewable subject — a review, a feed item, a notification. */
export type SubjectRef = {
  type?: string;
  spotifyTrackId?: string;
  spotifyAlbumId?: string;
  spotifyArtistId?: string;
};

/**
 * The in-app route for whatever a review points at. Web and mobile use identical path shapes
 * (`/song/:id`, `/album/:id`, `/artist/:id`), so one implementation serves both.
 *
 * Returns null when no id is usable, so callers stay put rather than navigating somewhere wrong:
 * `const p = subjectPath(x); if (p) go(p);`
 */
export function subjectPath(item: SubjectRef): string | null {
  if (item.type === 'artist' && item.spotifyArtistId) return `/artist/${item.spotifyArtistId}`;
  if (item.type === 'album'  && item.spotifyAlbumId)  return `/album/${item.spotifyAlbumId}`;
  if (item.spotifyTrackId) return `/song/${item.spotifyTrackId}`;
  // A track review that never stored its track id can still resolve to the album it came from.
  if (item.spotifyAlbumId) return `/album/${item.spotifyAlbumId}`;
  return null;
}
