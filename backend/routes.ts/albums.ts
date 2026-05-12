import { Router, Request, Response } from 'express';
import { Review } from '../models/review';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { spotifyHeaders } from './_spotifyHeaders';

const router = Router();

// GET /albums/:id — album metadata from Spotify
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const r = await fetch(`https://api.spotify.com/v1/albums/${req.params.id}`, { headers: spotifyHeaders(req) });
    if (!r.ok) { const t = await r.text(); console.error('Spotify album error:', r.status, t); res.status(r.status).json({ error: t }); return; }
    res.json(await r.json());
  } catch (err) {
    console.error('albums/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch album' });
  }
});

// GET /albums/:id/tracks — tracklist from Spotify
router.get('/:id/tracks', requireAuth, async (req: Request, res: Response) => {
  try {
    const r = await fetch(`https://api.spotify.com/v1/albums/${req.params.id}/tracks?limit=50`, { headers: spotifyHeaders(req) });
    if (!r.ok) { const t = await r.text(); console.error('Spotify tracks error:', r.status, t); res.status(r.status).json({ error: t }); return; }
    res.json(await r.json());
  } catch (err) {
    console.error('albums/:id/tracks error:', err);
    res.status(500).json({ error: 'Failed to fetch tracks' });
  }
});

// GET /albums/:id/reviews — all reviews for this album + average score
router.get('/:id/reviews', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const reviews = await Review.find({ spotifyAlbumId: req.params.id, type: 'album' })
      .sort({ createdAt: -1 })
      .populate('userId', '_id displayName avatarUrl spotifyId')
      .populate('comments.userId', '_id displayName avatarUrl');

    const scores = reviews.map(r => r.score).filter((s): s is number => s != null);
    const avgScore = scores.length > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
      : null;

    res.json({ reviews, avgScore, myId: req.user!._id.toString() });
  } catch {
    res.status(500).json({ error: 'Failed to fetch album reviews' });
  }
});

export default router;
