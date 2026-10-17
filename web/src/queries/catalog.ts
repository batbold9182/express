import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { asArray } from './asArray';
import { qk } from './keys';
import { nextOffset } from './pagination';
import { joinSpotifyPages, spotifyPaging, toSpotifyPage, SPOTIFY_PAGE } from './spotifyPaging';
import { isSpotifyId } from '../lib/spotifyId';

// Everything below is Spotify catalog data plus the reviews on it. The catalog part barely changes,
// so it is trusted for five minutes; the reviews use the default freshness. Posting, editing or
// deleting a review invalidates the whole `['track'|'album'|'artist', id]` family (`afterReviewChange`).
const CATALOG_STALE_MS = 5 * 60_000;
const REVIEW_PAGE = 20;

// Every hook below runs only for a well-formed Spotify id (`isSpotifyId`); encoding it as well costs nothing.
const seg = (id: string | undefined) => encodeURIComponent(id ?? '');

type Reviewer = { _id: string; displayName: string; avatarUrl?: string; spotifyId: string };
export type SubjectReview = {
  _id: string; userId: Reviewer; score: number; text?: string; moods?: string[]; createdAt?: string;
};

// ── track ──────────────────────────────────────────────────────────────────
type SpotifyTrack = {
  id: string; name: string; duration_ms: number;
  artists: { id: string; name: string }[];
  album: { id: string; name: string; images: { url: string }[]; release_date: string };
  external_urls: { spotify: string };
};
type TrackReviewsPage = { reviews: SubjectReview[]; avgScore: number | null; distribution: number[]; total: number; hasMore: boolean };

export function useTrack(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.track(id ?? ''),
    queryFn: ({ signal }) => api.get<SpotifyTrack>(`/tracks/${seg(id)}`, signal),
    enabled: enabled && isSpotifyId(id),
    staleTime: CATALOG_STALE_MS,
  });
}

/** A track's reviews, newest page last. The first page also carries the average and the score histogram. */
export function useTrackReviews(id: string | undefined, enabled = true) {
  return useInfiniteQuery({
    queryKey: qk.trackReviews(id ?? ''),
    queryFn: async ({ pageParam, signal }): Promise<TrackReviewsPage> => {
      const d = await api.get<{ reviews?: unknown; avgScore?: number | null; distribution?: unknown; total?: number; hasMore?: boolean }>(
        `/tracks/${seg(id)}/reviews?offset=${pageParam}&limit=${REVIEW_PAGE}`, signal,
      );
      const reviews = asArray<SubjectReview>(d?.reviews);
      const distribution = asArray<number>(d?.distribution);
      return {
        reviews,
        avgScore: d?.avgScore ?? null,
        distribution: distribution.length ? distribution : Array(10).fill(0),
        total: d?.total ?? reviews.length,
        hasMore: d?.hasMore ?? false,
      };
    },
    initialPageParam: 0,
    getNextPageParam: nextOffset<TrackReviewsPage>(page => page.reviews.length),
    enabled: enabled && isSpotifyId(id),
  });
}

// ── album ──────────────────────────────────────────────────────────────────
type SpotifyAlbum = {
  id: string; name: string; images: { url: string }[];
  artists: { id: string; name: string }[];
  release_date: string; total_tracks: number;
  tracks: { items: { id: string; name: string; duration_ms: number; track_number: number }[] };
  external_urls: { spotify: string };
};
/** One page of an album's or artist's reviews. `avgScore` and `total` cover all reviews, not just this page. */
type SubjectReviewsPage = { reviews: SubjectReview[]; avgScore: number | null; total: number; hasMore: boolean };

export function useAlbum(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.album(id ?? ''),
    queryFn: ({ signal }) => api.get<SpotifyAlbum>(`/albums/${seg(id)}`, signal),
    enabled: enabled && isSpotifyId(id),
    staleTime: CATALOG_STALE_MS,
  });
}

async function pageOfReviews(path: string, offset: number, signal: AbortSignal): Promise<SubjectReviewsPage> {
  const d = await api.get<{ reviews?: unknown; avgScore?: number | null; total?: number; hasMore?: boolean }>(
    `${path}?offset=${offset}&limit=${REVIEW_PAGE}`, signal,
  );
  const reviews = asArray<SubjectReview>(d?.reviews);
  return { reviews, avgScore: d?.avgScore ?? null, total: d?.total ?? reviews.length, hasMore: d?.hasMore ?? false };
}

/** An album's reviews, newest page last. */
export function useAlbumReviews(id: string | undefined, enabled = true) {
  return useInfiniteQuery({
    queryKey: qk.albumReviews(id ?? ''),
    queryFn: ({ pageParam, signal }) => pageOfReviews(`/albums/${seg(id)}/reviews`, pageParam, signal),
    initialPageParam: 0,
    getNextPageParam: nextOffset<SubjectReviewsPage>(page => page.reviews.length),
    enabled: enabled && isSpotifyId(id),
  });
}

// ── artist ─────────────────────────────────────────────────────────────────
type SpotifyArtist = { id: string; name: string; images: { url: string }[]; genres: string[]; external_urls: { spotify: string } };
export type ArtistAlbum = { id: string; name: string; images: { url: string }[]; release_date: string };

/** The release types the artist page shows as tabs, in tab order ("Appears on" last: decision D9). */
export const ALBUM_GROUPS = [
  { key: 'album',       label: 'Albums' },
  { key: 'single',      label: 'Singles & EPs' },
  { key: 'compilation', label: 'Compilations' },
  { key: 'appears_on',  label: 'Appears on' },
] as const;
export type AlbumGroup = (typeof ALBUM_GROUPS)[number]['key'];

export function useArtist(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.artist(id ?? ''),
    queryFn: ({ signal }) => api.get<SpotifyArtist>(`/artists/${seg(id)}`, signal),
    enabled: enabled && isSpotifyId(id),
    staleTime: CATALOG_STALE_MS,
  });
}

/**
 * One release type of the discography, as a paged Spotify list (`data` is `{ items, total }`). It is
 * the Spotify call that gets rate-limited (429), so it is not retried; the page shows the error in
 * the section and keeps the rest of the page. Later pages come from the tab's "Show more" button.
 */
export function useArtistAlbums(id: string | undefined, group: AlbumGroup, enabled = true) {
  return useInfiniteQuery({
    queryKey: qk.artistAlbumsGroup(id ?? '', group),
    queryFn: async ({ pageParam, signal }) => toSpotifyPage<ArtistAlbum>(
      await api.get(`/artists/${seg(id)}/albums?group=${group}&offset=${pageParam}&limit=${SPOTIFY_PAGE}`, signal),
    ),
    ...spotifyPaging,
    select: joinSpotifyPages,
    enabled: enabled && isSpotifyId(id),
    staleTime: CATALOG_STALE_MS,
    retry: false,
  });
}

/** An artist's reviews, newest page last. */
export function useArtistReviews(id: string | undefined, enabled = true) {
  return useInfiniteQuery({
    queryKey: qk.artistReviews(id ?? ''),
    queryFn: ({ pageParam, signal }) => pageOfReviews(`/artists/${seg(id)}/reviews`, pageParam, signal),
    initialPageParam: 0,
    getNextPageParam: nextOffset<SubjectReviewsPage>(page => page.reviews.length),
    enabled: enabled && isSpotifyId(id),
  });
}
