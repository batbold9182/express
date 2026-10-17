/**
 * Query keys — the contract between every `useQuery` and every invalidation.
 *
 * Keys are hierarchical: a prefix addresses a whole family, so invalidating `['track', id]` also
 * hits `['track', id, 'reviews']`. That is why the entity and its review list share a root.
 * Nothing here touches React or the DOM, so it can move into `@tunelog/shared` when mobile returns.
 */
export const qk = {
  // ── feeds & leaderboards ────────────────────────────────────────────────
  feedAll:        () => ['feed'] as const,
  feed:           (tab: string) => ['feed', tab] as const,
  leaderboardAll: () => ['leaderboard'] as const,
  leaderboard:    (type: string, limit: number) => ['leaderboard', type, limit] as const,

  // ── the caller's own reviews (drives every "Already reviewed" / "Reviewed" badge) ──
  myReviews: () => ['reviews', 'mine'] as const,

  // ── catalog: an entity and its review lists live under one prefix per id ──
  track:        (id: string) => ['track', id] as const,
  trackReviews: (id: string) => ['track', id, 'reviews'] as const,
  album:        (id: string) => ['album', id] as const,
  albumReviews: (id: string) => ['album', id, 'reviews'] as const,
  artist:        (id: string) => ['artist', id] as const,
  artistAlbums:  (id: string) => ['artist', id, 'albums'] as const,
  artistAlbumsGroup: (id: string, group: string) => ['artist', id, 'albums', group] as const,
  artistReviews: (id: string) => ['artist', id, 'reviews'] as const,

  // ── search ──────────────────────────────────────────────────────────────
  search:        (scope: string, q: string) => ['search', scope, q] as const,
  searchMore:    (type: string, q: string) => ['search', 'more', type, q] as const,
  userSearchAll: () => ['user-search'] as const,
  userSearch:    (q: string) => ['user-search', q] as const,

  // ── other users ─────────────────────────────────────────────────────────
  user:              (id: string) => ['user', id] as const,
  userCounts:        (id: string) => ['user', id, 'counts'] as const,
  userReviewsSample: (id: string) => ['user', id, 'reviews', 'sample'] as const,
  userReviewsList:   (id: string, type: string, q: string) => ['user', id, 'reviews', 'list', type, q] as const,

  // ── the signed-in user ──────────────────────────────────────────────────
  meAll:           () => ['me'] as const,
  meApp:           () => ['me', 'app'] as const,          // GET /users/me — the app account
  meSpotify:       () => ['me', 'spotify'] as const,      // GET /me — the Spotify profile (502 when unlinked)
  meCounts:        () => ['me', 'counts'] as const,
  meReviewsAll:    () => ['me', 'reviews'] as const,
  meReviewsSample: () => ['me', 'reviews', 'sample'] as const,
  meReviewsList:   (type: string, q: string) => ['me', 'reviews', 'list', type, q] as const,
  topArtists:      (range: string) => ['me', 'top-artists', range] as const,

  // ── notifications, now-playing, widgets ─────────────────────────────────
  notifications:  () => ['notifications'] as const,
  unreadCount:    () => ['notifications', 'unread'] as const,
  nowPlaying:     () => ['now-playing'] as const,
  suggestedUsers:     () => ['suggested-users'] as const,
  suggestedUsersList: (limit: number) => ['suggested-users', limit] as const,
  feedback:       () => ['feedback'] as const,
  sharedReview:   (id: string) => ['shared-review', id] as const,
};
