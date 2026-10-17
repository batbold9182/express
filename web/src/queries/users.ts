import { keepPreviousData, useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import type { ProfileReview } from '@tunelog/shared';
import { api } from '../lib/api';
import { asArray } from './asArray';
import { invalidate } from './client';
import { toCounts } from './counts';
import { afterFollowChange, afterSpotifyDisconnect } from './invalidation';
import { qk } from './keys';
import { nextOffset } from './pagination';

// ── suggested users ────────────────────────────────────────────────────────
export type SuggestedUser = {
  _id: string;
  spotifyId: string;
  displayName: string;
  avatarUrl?: string;
  followerCount: number;
};

/**
 * `GET /users/suggested` — "Who to follow". Following someone invalidates it (`afterFollowChange`),
 * so a cached list never keeps offering someone you already follow.
 */
export function useSuggestedUsers(limit: number) {
  return useQuery({
    queryKey: qk.suggestedUsersList(limit),
    queryFn: async ({ signal }) => asArray<SuggestedUser>(await api.get(`/users/suggested?limit=${limit}`, signal)),
  });
}

// ── another user's profile ─────────────────────────────────────────────────
export type AppUser = {
  displayName: string;
  avatarUrl?: string;
  spotifyId: string;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
  createdAt?: string;
};

/** How many of someone's most recent reviews the taste widgets are computed from. */
const TASTE_SAMPLE = 50;

export function useUser(id: string | undefined) {
  return useQuery({
    queryKey: qk.user(id ?? ''),
    queryFn: ({ signal }) => api.get<AppUser>(`/users/${encodeURIComponent(id ?? '')}`, signal),
    enabled: !!id,
  });
}

export function useUserCounts(id: string | undefined) {
  return useQuery({
    queryKey: qk.userCounts(id ?? ''),
    queryFn: async ({ signal }) => toCounts(await api.get(`/users/${encodeURIComponent(id ?? '')}/reviews/counts`, signal)),
    enabled: !!id,
  });
}

export function useUserReviewsSample(id: string | undefined) {
  return useQuery({
    queryKey: qk.userReviewsSample(id ?? ''),
    queryFn: async ({ signal }) =>
      asArray<ProfileReview>((await api.get<{ reviews?: unknown }>(`/users/${encodeURIComponent(id ?? '')}/reviews?type=all&offset=0&limit=${TASTE_SAMPLE}`, signal))?.reviews),
    enabled: !!id,
  });
}

// ── the signed-in user ─────────────────────────────────────────────────────
type MeApp = {
  displayName: string; avatarUrl: string;
  followerCount: number; followingCount: number;
  spotifyLinked: boolean; createdAt?: string; email?: string;
};
type SpotifyUser = { display_name: string; id: string; images: { url: string }[] };
type TopArtist = { id: string; name: string; images: { url: string }[]; genres: string[] };

/** `GET /users/me` — the app account. Me and Settings share this one request. */
export function useMeApp() {
  return useQuery({
    queryKey: qk.meApp(),
    queryFn: ({ signal }) => api.get<MeApp>('/users/me', signal),
    staleTime: 60_000,
  });
}

/**
 * `GET /me` — the Spotify profile. It 502s for an account with no Spotify linked, which is the normal
 * case for email users, so it is not retried and its failure is not an error the page shows.
 */
export function useMeSpotify() {
  return useQuery({
    queryKey: qk.meSpotify(),
    queryFn: ({ signal }) => api.get<SpotifyUser | null>('/me', signal),
    retry: false,
    staleTime: 60_000,
  });
}

export function useMeCounts() {
  return useQuery({
    queryKey: qk.meCounts(),
    queryFn: async ({ signal }) => toCounts(await api.get('/users/me/reviews/counts', signal)),
  });
}

export function useMeReviewsSample() {
  return useQuery({
    queryKey: qk.meReviewsSample(),
    queryFn: async ({ signal }) =>
      asArray<ProfileReview>((await api.get<{ reviews?: unknown }>(`/users/me/reviews?type=all&offset=0&limit=${TASTE_SAMPLE}`, signal))?.reviews),
  });
}

/**
 * `GET /me/top/artists` for one time range. Only runs for a linked account (an unlinked one just gets an
 * empty list, so asking is pointless). The previous range's artists stay on screen, dimmed, while the
 * next range loads.
 */
export function useTopArtists(range: string, enabled: boolean) {
  return useQuery({
    queryKey: qk.topArtists(range),
    queryFn: async ({ signal }) => asArray<TopArtist>((await api.get<{ items?: unknown }>(`/me/top/artists?time_range=${range}`, signal))?.items),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
}

// ── a user's reviews, paginated (Me and Profile share the list) ────────────
type ProfileReviewsPage = { reviews: ProfileReview[]; hasMore: boolean };
const PROFILE_REVIEWS_PAGE = 20;

/**
 * Someone's reviews filtered by type and search text. `userId` undefined means the signed-in user.
 * Changing the filter or the text starts a new cached list; the old one stays visible, dimmed, until
 * the new one arrives.
 */
export function useProfileReviews(userId: string | undefined, type: string, q: string) {
  const base = userId ? `/users/${encodeURIComponent(userId)}/reviews` : '/users/me/reviews';
  return useInfiniteQuery({
    queryKey: userId ? qk.userReviewsList(userId, type, q) : qk.meReviewsList(type, q),
    queryFn: async ({ pageParam, signal }): Promise<ProfileReviewsPage> => {
      const d = await api.get<{ reviews?: unknown; hasMore?: boolean }>(
        `${base}?type=${type}&q=${encodeURIComponent(q)}&offset=${pageParam}&limit=${PROFILE_REVIEWS_PAGE}`, signal,
      );
      return { reviews: asArray<ProfileReview>(d?.reviews), hasMore: d?.hasMore ?? false };
    },
    initialPageParam: 0,
    getNextPageParam: nextOffset<ProfileReviewsPage>(page => page.reviews.length),
    placeholderData: keepPreviousData,
  });
}

// ── actions ────────────────────────────────────────────────────────────────
/**
 * Follow or unfollow. A failure shows as a toast (the default); a success refreshes everything that
 * carries follow state (`afterFollowChange`). Callers that want the button to move at once patch the
 * cached user themselves and roll back in `onError`.
 */
export function useFollow() {
  return useMutation({
    mutationFn: ({ userId, following }: { userId: string; following: boolean }) =>
      following ? api.del(`/users/${encodeURIComponent(userId)}/follow`) : api.post(`/users/${encodeURIComponent(userId)}/follow`, {}),
    onSuccess: (_result, { userId }) => { void invalidate(afterFollowChange(userId)); },
  });
}

/** Unlink Spotify, keeping the account and its reviews. The 409 lock-out message arrives as the toast. */
export function useDisconnectSpotify() {
  return useMutation({
    mutationFn: () => api.del('/users/me/spotify'),
    onSuccess: () => { void invalidate(afterSpotifyDisconnect()); },
  });
}
