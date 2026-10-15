import { qk } from './keys';

/**
 * Which cached data a mutation makes out of date. Kept as plain data, separate from the React hooks,
 * so the map — the riskiest part of the migration — can be unit-tested.
 *
 * `stale: true` marks a family out of date WITHOUT refetching it now, so the next time it mounts it
 * refetches, but a mutation never makes the screen you are looking at jump.
 */
export type Invalidation = { key: readonly unknown[]; stale?: boolean; /** Match this key only, not the keys under it. */ exact?: boolean };

export type ReviewRef = {
  spotifyTrackId?: string;
  spotifyAlbumId?: string;
  spotifyArtistId?: string;
  /** The review author's app id, when known — refreshes their profile page. */
  authorId?: string;
};

/**
 * A review was posted, edited or deleted. A *track* review carries all three ids, and the album and
 * artist pages aggregate from track reviews, so each id present refreshes its own page.
 */
export function afterReviewChange(r: ReviewRef): Invalidation[] {
  const list: Invalidation[] = [
    { key: qk.myReviews() },
    { key: qk.feedAll() },
    { key: qk.leaderboardAll() },
    { key: qk.meCounts() },
    { key: qk.meReviewsAll() },
  ];
  if (r.spotifyTrackId)  list.push({ key: qk.track(r.spotifyTrackId) });
  if (r.spotifyAlbumId)  list.push({ key: qk.album(r.spotifyAlbumId) });
  if (r.spotifyArtistId) list.push({ key: qk.artist(r.spotifyArtistId) });
  if (r.authorId)        list.push({ key: qk.user(r.authorId) });
  return list;
}

/**
 * A review was edited or deleted from the feed. The feed itself was already patched in place, so it
 * is only marked stale (refetching every loaded page for one edit would make the list jump); every
 * other cache is refreshed as for any review change.
 */
export function afterReviewEditOrDelete(r: ReviewRef): Invalidation[] {
  return afterReviewChange(r).map(i => (i.key[0] === 'feed' ? { ...i, stale: true } : i));
}

/** A review like, or a comment added / edited / deleted. Only the feed's embedded copy is affected. */
export function afterLikeOrComment(): Invalidation[] {
  return [{ key: qk.feedAll(), stale: true }];
}

/**
 * Followed or unfollowed someone. The Following feed changes, but not under your feet; cached
 * people-search results carry an `isFollowing` flag, so they are marked stale (re-searching the same
 * name must not show the old button) without redrawing a list you are looking at.
 */
export function afterFollowChange(userId: string): Invalidation[] {
  return [
    { key: qk.user(userId), exact: true },   // the profile record only — not its counts and review lists
    { key: qk.suggestedUsers() },
    { key: qk.meApp() },
    { key: qk.feed('following'), stale: true },
    { key: qk.userSearchAll(), stale: true },
  ];
}

/** Unlinked Spotify: everything under `me` (linked flag, top artists) plus now-playing. */
export function afterSpotifyDisconnect(): Invalidation[] {
  return [{ key: qk.meAll() }, { key: qk.nowPlaying() }];
}

/** Turns the map into the filters `queryClient.invalidateQueries` takes. */
export function toFilters(list: Invalidation[]) {
  return list.map(i => ({
    queryKey: i.key,
    exact: i.exact ?? false,
    refetchType: (i.stale ? 'none' : 'active') as 'none' | 'active',
  }));
}
