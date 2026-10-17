import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { spotifyHeaders, hasPersonalSpotify, spotifyPage } from './_spotifyHeaders';

const router = Router();

const TIME_RANGES  = new Set(['short_term', 'medium_term', 'long_term']);
const SEARCH_TYPES = new Set(['track', 'album', 'artist']);

// Missing means the default. Anything else must be one of Spotify's three values; an array, '' or 'x&limit=50' gets a 400.
function timeRange(req: Request): string | null {
  const v = req.query.time_range;
  if (v === undefined) return 'medium_term';
  return typeof v === 'string' && TIME_RANGES.has(v) ? v : null;
}

async function spotifyGet(url: string, req: Request, res: Response) {
  try {
    const r = await fetch(url, { headers: await spotifyHeaders(req) });
    if (!r.ok) {
      const t = await r.text();
      console.error('Spotify error:', r.status, url, t);
      // Remap Spotify 401/403 to 502 — these mean the Spotify token is invalid,
      // not that our app auth failed. Proxying 401 would log the user out.
      const status = (r.status === 401 || r.status === 403) ? 502 : r.status;
      res.status(status).json({ error: t });
      return;
    }
    res.json(await r.json());
  } catch (e) {
    console.error('Spotify fetch error:', e);
    res.status(500).json({ error: 'Spotify request failed' });
  }
}

router.get('/me', requireAuth, (req, res) => {
  if (!hasPersonalSpotify(req)) { res.status(502).json({ error: 'Spotify not linked' }); return; }
  spotifyGet('https://api.spotify.com/v1/me', req, res);
});
router.get('/me/top/artists', requireAuth, (req, res) => {
  const range = timeRange(req);
  if (!range) { res.status(400).json({ error: 'Invalid time_range' }); return; }
  if (!hasPersonalSpotify(req)) { res.json({ items: [] }); return; }
  spotifyGet(`https://api.spotify.com/v1/me/top/artists?limit=5&time_range=${range}`, req, res);
});
router.get('/me/top/tracks', requireAuth, (req, res) => {
  const range = timeRange(req);
  if (!range) { res.status(400).json({ error: 'Invalid time_range' }); return; }
  if (!hasPersonalSpotify(req)) { res.json({ items: [] }); return; }
  spotifyGet(`https://api.spotify.com/v1/me/top/tracks?limit=10&time_range=${range}`, req, res);
});
router.get('/me/player/currently-playing', requireAuth, async (req, res) => {
  if (!hasPersonalSpotify(req)) { res.json(null); return; }
  try {
    const r = await fetch('https://api.spotify.com/v1/me/player/currently-playing', { headers: await spotifyHeaders(req) });
    if (r.status === 204 || r.status === 404) { res.json(null); return; }
    const data = await r.json();
    res.json(data);
  } catch {
    res.status(500).json({ error: 'Spotify request failed' });
  }
});

router.get('/search', requireAuth, (req, res) => {
  const q = req.query.q as string;
  const type = req.query.type === undefined ? 'track,album,artist' : req.query.type;
  if (!q) { res.status(400).json({ error: 'Missing q' }); return; }
  if (typeof type !== 'string' || !type.split(',').every(t => SEARCH_TYPES.has(t))) { res.status(400).json({ error: 'Invalid type' }); return; }
  const { limit, offset } = spotifyPage(req);
  const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=${type}&limit=${limit}&offset=${offset}`;
  spotifyGet(url, req, res);
});

export default router;
