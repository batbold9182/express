export type ReviewCounts = { track: number; album: number; artist: number };

export const NO_COUNTS: ReviewCounts = { track: 0, album: 0, artist: 0 };

const asCount = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);

/** `GET …/reviews/counts`, made safe: a missing or malformed field counts as 0 rather than NaN or a crash. */
export function toCounts(d: unknown): ReviewCounts {
  const o = (d ?? {}) as Record<string, unknown>;
  return { track: asCount(o.track), album: asCount(o.album), artist: asCount(o.artist) };
}

export const totalOf = (c: ReviewCounts) => c.track + c.album + c.artist;
