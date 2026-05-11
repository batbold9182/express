import { Router, Request, Response } from 'express';
import { Review } from '../models/review';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

function spotifyHeaders(req: Request) {
  return { Authorization: `Bearer ${req.headers.authorization?.split(' ')[1]}` };
}

// GET /albums/:id — album metadata from Spotify
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const r = await fetch(`https://api.spotify.com/v1/albums/${req.params.id}`, { headers: spotifyHeaders(req) });
    const data = await r.json();
    res.json(data);
  } catch {
    res.status(500).json({ error: 'Failed to fetch album' });
  }
});

// GET /albums/:id/tracks — tracklist from Spotify
router.get('/:id/tracks', requireAuth, async (req: Request, res: Response) => {
  try {
    const r = await fetch(`https://api.spotify.com/v1/albums/${req.params.id}/tracks?limit=50`, { headers: spotifyHeaders(req) });
    const data = await r.json();
    res.json(data);
  } catch {
    res.status(500).json({ error: 'Failed to fetch tracks' });
  }
});

// GET /albums/:id/reviews — all reviews for this album + average score
router.get('/:id/reviews', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const reviews = await Review.find({ spotifyAlbumId: req.params.id })
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
