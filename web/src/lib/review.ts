import { MOOD_LIST } from '@tunelog/shared';

/** Mood name -> accent colour. Derived from MOOD_LIST, which is the source of truth. */
export const MOOD_COLOR: Record<string, string> = Object.fromEntries(MOOD_LIST.map(([m, c]) => [m, c]));

/** Review type -> pill label + colour. Cyan = album, coral = artist, tan = track. */
export const TYPE_CFG: Record<string, { label: string; color: string }> = {
  album:  { label: 'Album',  color: '#4FA3D1' },
  artist: { label: 'Artist', color: '#E0685C' },
  track:  { label: 'Track',  color: '#978A74' },
};

type SubjectRef = {
  type?: string;
  spotifyTrackId?: string;
  spotifyAlbumId?: string;
  spotifyArtistId?: string;
};

/**
 * The in-app route for whatever a review points at.
 *
 * Returns null when the id the type needs is missing, so callers stay put rather
 * than navigating somewhere wrong — `const p = subjectPath(x); if (p) nav(p);`
 */
export function subjectPath(item: SubjectRef): string | null {
  if (item.type === 'artist' && item.spotifyArtistId) return `/artist/${item.spotifyArtistId}`;
  if (item.type === 'album'  && item.spotifyAlbumId)  return `/album/${item.spotifyAlbumId}`;
  if (item.spotifyTrackId) return `/song/${item.spotifyTrackId}`;
  return null;
}
