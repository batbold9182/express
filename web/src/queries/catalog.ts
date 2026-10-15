import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { asArray } from './asArray';
import { qk } from './keys';
import { nextOffset } from './pagination';

// Everything below is Spotify catalog data plus the reviews on it. The catalog part barely changes,
// so it is trusted for five minutes; the reviews use the default freshness. Posting, editing or
// deleting a review invalidates the whole `['track'|'album'|'artist', id]` family (`afterReviewChange`).
const CATALOG_STALE_MS = 5 * 60_000;
const REVIEW_PAGE = 20;

type Reviewer = { _id: string; displayName: string; avatarUrl?: string; spotifyId: string };
export type SubjectReview = {
  _id: string; userId: Reviewer; score: number; text?: string; moods?: string[]; createdAt?: string;
};

// ── track ──────────────────────────────────────────────────────────────────
export type SpotifyTrack = {
  id: string; name: string; duration_ms: number;
  artists: { id: string; name: string }[];
  album: { id: string; name: string; images: { url: string }[]; release_date: string };
  external_urls: { spotify: string };
};
export type TrackReviewsPage = { reviews: SubjectReview[]; avgScore: number | null; distribution: number[]; hasMore: boolean };

export function useTrack(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.track(id ?? ''),
    queryFn: ({ signal }) => api.get<SpotifyTrack>(`/tracks/${id}`, signal),
    enabled: enabled && !!id,
    staleTime: CATALOG_STALE_MS,
  });
}

/** A track's reviews, newest page last. The first page also carries the average and the score histogram. */
export function useTrackReviews(id: string | undefined, enabled = true) {
  return useInfiniteQuery({
    queryKey: qk.trackReviews(id ?? ''),
    queryFn: async ({ pageParam, signal }): Promise<TrackReviewsPage> => {
      const d = await api.get<{ reviews?: unknown; avgScore?: number | null; distribution?: unknown; hasMore?: boolean }>(
        `/tracks/${id}/reviews?offset=${pageParam}&limit=${REVIEW_PAGE}`, signal,
      );
      const distribution = asArray<number>(d?.distribution);
      return {
        reviews: asArray<SubjectReview>(d?.reviews),
        avgScore: d?.avgScore ?? null,
        distribution: distribution.length ? distribution : Array(10).fill(0),
        hasMore: d?.hasMore ?? false,
      };
    },
    initialPageParam: 0,
    getNextPageParam: nextOffset<TrackReviewsPage>(page => page.reviews.length),
    enabled: enabled && !!id,
  });
}

// ── album ──────────────────────────────────────────────────────────────────
export type SpotifyAlbum = {
  id: string; name: string; images: { url: string }[];
  artists: { id: string; name: string }[];
  release_date: string; total_tracks: number;
  tracks: { items: { id: string; name: string; duration_ms: number; track_number: number }[] };
  external_urls: { spotify: string };
};
export type SubjectReviewsFirstPage = { reviews: SubjectReview[]; avgScore: number | null };

export function useAlbum(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.album(id ?? ''),
    queryFn: ({ signal }) => api.get<SpotifyAlbum>(`/albums/${id}`, signal),
    enabled: enabled && !!id,
    staleTime: CATALOG_STALE_MS,
  });
}

async function firstPageOfReviews(path: string, signal: AbortSignal): Promise<SubjectReviewsFirstPage> {
  const d = await api.get<{ reviews?: unknown; avgScore?: number | null }>(`${path}?offset=0&limit=${REVIEW_PAGE}`, signal);
  return { reviews: asArray<SubjectReview>(d?.reviews), avgScore: d?.avgScore ?? null };
}

/** An album's first page of reviews (the page has never paged past it). */
export function useAlbumReviews(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.albumReviews(id ?? ''),
    queryFn: ({ signal }) => firstPageOfReviews(`/albums/${id}/reviews`, signal),
    enabled: enabled && !!id,
  });
}

// ── artist ─────────────────────────────────────────────────────────────────
export type SpotifyArtist = { id: string; name: string; images: { url: string }[]; genres: string[]; external_urls: { spotify: string } };
export type ArtistAlbum = { id: string; name: string; images: { url: string }[]; release_date: string };

export function useArtist(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.artist(id ?? ''),
    queryFn: ({ signal }) => api.get<SpotifyArtist>(`/artists/${id}`, signal),
    enabled: enabled && !!id,
    staleTime: CATALOG_STALE_MS,
  });
}

/**
 * The discography. It is the one Spotify call that gets rate-limited (429), so a failure just hides
 * the section instead of erroring the page, and it is not retried.
 */
export function useArtistAlbums(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.artistAlbums(id ?? ''),
    queryFn: async ({ signal }) => asArray<ArtistAlbum>((await api.get<{ items?: unknown }>(`/artists/${id}/albums`, signal))?.items),
    enabled: enabled && !!id,
    staleTime: CATALOG_STALE_MS,
    retry: false,
  });
}

export function useArtistReviews(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.artistReviews(id ?? ''),
    queryFn: ({ signal }) => firstPageOfReviews(`/artists/${id}/reviews`, signal),
    enabled: enabled && !!id,
  });
}
