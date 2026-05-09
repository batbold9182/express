import { Router, Request, Response } from 'express';

const router = Router();

function spotifyHeaders(req: Request) {
  return { Authorization: `Bearer ${req.headers.authorization?.split(' ')[1]}` };
}

async function spotifyGet(url: string, req: Request, res: Response) {
  try {
    const r = await fetch(url, { headers: spotifyHeaders(req) });
    const data = await r.json();
    res.json(data);
  } catch {
    res.status(500).json({ error: 'Spotify request failed' });
  }
}

router.get('/me', (req, res) => spotifyGet('https://api.spotify.com/v1/me', req, res));
router.get('/me/top/artists', (req, res) => spotifyGet(`https://api.spotify.com/v1/me/top/artists?limit=5&time_range=${req.query.time_range ?? 'medium_term'}`, req, res));
router.get('/me/top/tracks', (req, res) => spotifyGet(`https://api.spotify.com/v1/me/top/tracks?limit=10&time_range=${req.query.time_range ?? 'medium_term'}`, req, res));
router.get('/search', (req, res) => spotifyGet(`https://api.spotify.com/v1/search?q=${encodeURIComponent(req.query.q as string)}&type=${req.query.type ?? 'track,album,artist'}&limit=20`, req, res));

export default router;
