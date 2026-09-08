import type { ProfileReview } from '@tunelog/shared';

/**
 * The taste snapshot shown on /me and /profile/:id — average score, four favourites, and a
 * 1–10 rating histogram — all derived from a person's reviews. No dedicated endpoint:
 * `/users/:id/reviews` and `/users/me/reviews` already return the `score` + `albumArt` these use.
 * The list endpoint caps at 50, so for a heavy reviewer this is their 50 most recent — a fair
 * read of current taste. A `/users/:id/stats` route would make it exact (backend, later).
 */
export function tasteStats(reviews: ProfileReview[]) {
  const scores = reviews.map(r => r.score).filter((s): s is number => s != null);
  const dist = Array(10).fill(0) as number[];
  scores.forEach(s => { const b = Math.round(s) - 1; if (b >= 0 && b <= 9) dist[b]++; });
  return {
    count: scores.length,
    avg: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
    favorites: [...reviews].sort((a, b) => b.score - a.score).slice(0, 4),
    dist,
    maxDist: Math.max(...dist, 1),
  };
}
