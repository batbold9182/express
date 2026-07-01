import type { ReviewType } from './types';

/**
 * Platform-agnostic sharing helpers, shared by web (native share sheet) and the
 * future mobile phase (native Instagram Stories sticker API). No DOM / RN APIs here.
 */

export type ShareItem = {
  type?: ReviewType;
  spotifyTrackId?: string;
  spotifyAlbumId?: string;
  spotifyArtistId?: string;
  trackName: string;
  artistName: string;
  score: number;
};

/** Public open.spotify.com URL for a reviewed item, or null if no id is present. */
export function spotifyUrlFor(item: Pick<ShareItem, 'type' | 'spotifyTrackId' | 'spotifyAlbumId' | 'spotifyArtistId'>): string | null {
  if (item.type === 'artist' && item.spotifyArtistId) return `https://open.spotify.com/artist/${item.spotifyArtistId}`;
  if (item.type === 'album'  && item.spotifyAlbumId)  return `https://open.spotify.com/album/${item.spotifyAlbumId}`;
  if (item.spotifyTrackId) return `https://open.spotify.com/track/${item.spotifyTrackId}`;
  return null;
}

/** The express post link for a review — the URL we hand to the share sheet. */
export function postUrl(reviewId: string, base: string): string {
  return `${base.replace(/\/$/, '')}/r/${reviewId}`;
}

/** Caption text for the native share sheet / social post. */
export function buildShareCaption(item: ShareItem): string {
  return `"${item.trackName}" by ${item.artistName} — I rated it ${item.score.toFixed(1)}/10 on express`;
}

/**
 * Card render spec. `story` matches Instagram Stories / the Spotify-style share card;
 * `og` matches link-preview cards (twitter:summary_large_image). Kept here so the web
 * canvas/@vercel/og renderer and the future RN renderer stay visually consistent.
 */
export const SHARE_CARD = {
  story: { width: 1080, height: 1920 },
  og:    { width: 1200, height: 630 },
  bg:        '#000000',
  fg:        '#FFFFFF',
  fgMuted:   '#C9BCA6',
  brand:     'express',
} as const;
