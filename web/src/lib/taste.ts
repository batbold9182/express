import type { ProfileReview } from '@tunelog/shared';
import { hasScore } from './score';

/**
 * The taste snapshot shown on /me and /profile/:id — average score, four favourites, and a
 * 1–10 rating histogram — all derived from a person's reviews. No dedicated endpoint:
 * `/users/:id/reviews` and `/users/me/reviews` already return the `score` + `albumArt` these use.
 * The list endpoint caps at 50, so for a heavy reviewer this is their 50 most recent — a fair
 * read of current taste. A `/users/:id/stats` route would make it exact (backend, later).
 */
export function tasteStats(reviews: ProfileReview[]) {
  const scored = reviews.filter(r => hasScore(r.score));   // a review without a score counts for nothing here
  const scores = scored.map(r => r.score);
  const dist = Array(10).fill(0) as number[];
  // Ten bars for 1-10. A score runs 0-10, so anything under 1.5 (a 0 included) goes in the first
  // bar — every review the average counts also shows in the histogram.
  scores.forEach(s => { dist[Math.min(9, Math.max(0, Math.round(s) - 1))]++; });
  return {
    count: scores.length,
    avg: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
    favorites: [...scored].sort((a, b) => b.score - a.score).slice(0, 4),
    dist,
    maxDist: Math.max(...dist, 1),
  };
}
