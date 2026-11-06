// Checks shared by the two share-link functions, `r.ts` (the page) and `og.ts` (its preview image).
// The leading underscore keeps Vercel from serving this file as a function of its own.
//
// Both functions run on Vercel's servers with input from the address bar and from a review anyone
// can post, so neither trusts it (security.md, L3):
//  - the review id goes into an API path, so it must be a MongoDB ObjectId (24 hex characters) —
//    anything else (`../users/me`, `id/../..`, `id?x=1`) never reaches the API;
//  - the API accepts a review with no score, so a score is printed only when it is a finite number;
//  - `og.ts` has Vercel's server fetch the cover, so it only fetches from Spotify's image host.

/** A MongoDB ObjectId, the only shape a review id has. */
export const isReviewId = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{24}$/i.test(v);

/** True for a score that can be printed. */
export const hasScore = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const COVER_HOST = 'i.scdn.co';

/** The cover address if it is an `https://i.scdn.co/...` image, otherwise null (draw the placeholder). */
export function safeCover(v: unknown): string | null {
  if (typeof v !== 'string' || v === '') return null;
  let url: URL;
  try { url = new URL(v); } catch { return null; }   // relative or protocol-relative: not ours
  const ok = url.protocol === 'https:' && url.hostname === COVER_HOST && url.port === '' && url.username === '' && url.password === '';
  return ok ? url.href : null;
}
