import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { spotifyHeaders } from './_spotifyHeaders';

const router = Router();

async function spotifyGet(url: string, req: Request, res: Response) {
  try {
    const r = await fetch(url, { headers: spotifyHeaders(req) });
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

router.get('/me', requireAuth, (req, res) => spotifyGet('https://api.spotify.com/v1/me', req, res));
router.get('/me/top/artists', requireAuth, (req, res) => spotifyGet(`https://api.spotify.com/v1/me/top/artists?limit=5&time_range=${req.query.time_range ?? 'medium_term'}`, req, res));
router.get('/me/top/tracks', requireAuth, (req, res) => spotifyGet(`https://api.spotify.com/v1/me/top/tracks?limit=10&time_range=${req.query.time_range ?? 'medium_term'}`, req, res));
router.get('/me/player/currently-playing', requireAuth, async (req, res) => {
  try {
    const r = await fetch('https://api.spotify.com/v1/me/player/currently-playing', { headers: spotifyHeaders(req) });
    if (r.status === 204 || r.status === 404) { res.json(null); return; }
    const data = await r.json();
    res.json(data);
  } catch {
    res.status(500).json({ error: 'Spotify request failed' });
  }
});

router.get('/search', requireAuth, (req, res) => {
  const q = req.query.q as string;
  const type = (req.query.type as string) ?? 'track,album,artist';
  if (!q) { res.status(400).json({ error: 'Missing q' }); return; }
  const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=${type}`;
  spotifyGet(url, req, res);
});

export default router;
