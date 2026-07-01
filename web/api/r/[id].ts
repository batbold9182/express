// Node serverless function: serves the SPA shell for /r/:id with per-review Open Graph
// tags injected, so shared links unfurl with the review's card/title in chats & social.
// Humans still get the full SPA (it boots and React Router renders SharedReview.tsx).

const API_BASE = process.env.VITE_API_BASE || '';

type Review = {
  trackName: string;
  artistName: string;
  score: number;
  text?: string;
  userId?: { displayName?: string };
};

function esc(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export default async function handler(req: any, res: any): Promise<void> {
  const id = String(req.query?.id || '');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const origin = `https://${host}`;

  let review: Review | null = null;
  try {
    const r = await fetch(`${API_BASE}/reviews/${id}`);
    if (r.ok) review = (await r.json()) as Review;
  } catch { /* fall through to generic meta */ }

  const pageUrl = `${origin}/r/${id}`;
  const imageUrl = `${origin}/api/og/${id}`;

  const title = review
    ? `"${review.trackName}" by ${review.artistName} — ${review.score.toFixed(1)}/10 on express`
    : 'express — rate music, build your taste';
  const desc = review
    ? (review.text?.trim() || `${review.userId?.displayName ?? 'Someone'} rated this ${review.score.toFixed(1)}/10 on express`)
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

  let html = '';
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
