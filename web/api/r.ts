// Node serverless function: serves the SPA shell for /r/:id with per-review Open Graph
// tags injected, so shared links unfurl with the review's card/title in chats & social.
// Humans still get the full SPA (it boots and React Router renders SharedReview.tsx).
//
// Reached via a vercel.json rewrite: /r/:id -> /api/r?id=:id  (flat file + query param,
// so it doesn't depend on `[id]` dynamic-segment function routing).

import { hasScore, isReviewId } from './_share';

const API_BASE = process.env.VITE_API_BASE || '';

// The parts of Vercel's Node request and response this function uses.
type Req = { query?: Record<string, unknown>; headers: Record<string, string | string[] | undefined> };
type Res = { setHeader(name: string, value: string): void; status(code: number): { send(body: string): void } };

type Review = {
  trackName: string;
  artistName: string;
  score?: number | null;
  text?: string;
  userId?: { displayName?: string };
};

function esc(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export default async function handler(req: Req, res: Res): Promise<void> {
  // Anything that is not a review id is treated like a review that does not exist: the generic page.
  const raw = req.query?.id;
  const id = isReviewId(raw) ? raw : null;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const origin = `https://${host}`;

  let review: Review | null = null;
  if (id) {
    try {
      const r = await fetch(`${API_BASE}/reviews/${id}`);
      if (r.ok) review = (await r.json()) as Review;
    } catch { /* fall through to generic meta */ }
  }

  const pageUrl = id ? `${origin}/r/${id}` : origin;
  const imageUrl = id ? `${origin}/api/og/${id}` : `${origin}/api/og`;   // no id: the plain "express" card

  // A review without a score is described without one ("Song" by Artist on express).
  const score = review && hasScore(review.score) ? `${review.score.toFixed(1)}/10` : null;
  const who = review?.userId?.displayName ?? 'Someone';
  const title = review
    ? `"${review.trackName}" by ${review.artistName}${score ? ` — ${score}` : ''} on express`
    : 'express — rate music, build your taste';
  const desc = review
    ? (review.text?.trim() || (score ? `${who} rated this ${score} on express` : `${who} reviewed this on express`))
    : 'Rate tracks, albums and artists. Share your taste.';

  const meta = `
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(desc)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="express" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(desc)}" />
    <meta property="og:url" content="${esc(pageUrl)}" />
    <meta property="og:image" content="${esc(imageUrl)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(desc)}" />
    <meta name="twitter:image" content="${esc(imageUrl)}" />
  `;

  let html: string;
  try {
    // /index.html resolves to the static asset (filesystem is checked before rewrites),
    // so this does not recurse back into this function.
    html = await (await fetch(`${origin}/index.html`)).text();
  } catch {
    html = '<!doctype html><html><head></head><body><div id="root"></div></body></html>';
  }

  // Drop the placeholder <title> then inject our meta into <head>.
  html = html.replace(/<title>.*?<\/title>/i, '');
  html = html.includes('</head>')
    ? html.replace('</head>', `${meta}</head>`)
    : `<head>${meta}</head>${html}`;

  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.setHeader('cache-control', 'public, max-age=300, s-maxage=300');
  res.status(200).send(html);
}
