// A review's score as the UI shows it. The API accepts a review with no score (security.md, web
// High 1), so every place that prints one goes through here instead of calling `.toFixed` on it.
// Pure (no imports), so the root Jest suite can load it.

/** True for a score that can be shown: a finite number. */
export const hasScore = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** "8.5", or "—" for a review without a score. */
export const formatScore = (v: unknown): string => (hasScore(v) ? v.toFixed(1) : '—');

/** The colour for "no score": the muted text colour. */
export const NO_SCORE_COLOR = '#5C5142';
