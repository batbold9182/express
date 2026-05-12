import { Router, Request, Response } from 'express';
import { Review } from '../models/review';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { spotifyHeaders } from './_spotifyHeaders';

const router = Router();

// GET /artists/:id — artist metadata from Spotify
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const r = await fetch(`https://api.spotify.com/v1/artists/${req.params.id}`, { headers: spotifyHeaders(req) });
    if (!r.ok) { const t = await r.text(); console.error('Spotify artist error:', r.status, t); res.status(r.status).json({ error: t }); return; }
    res.json(await r.json());
  } catch (err) {
    console.error('artists/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch artist' });
  }
});

// GET /artists/:id/albums?group=album|single|compilation|appears_on
router.get('/:id/albums', requireAuth, async (req: Request, res: Response) => {
  try {
    const group  = (req.query.group  as string) || 'album';
    const limit  = Number(req.query.limit)  || 20;
    const offset = Number(req.query.offset) || 0;
    const r = await fetch(
      `https://api.spotify.com/v1/artists/${req.params.id}/albums?include_groups=${group}&limit=${limit}&offset=${offset}`,
      { headers: spotifyHeaders(req) }
    );
    if (!r.ok) { const t = await r.text(); console.error('Spotify albums error:', r.status, group, t); res.status(r.status).json({ error: t }); return; }
    res.json(await r.json());
  } catch (err) {
    console.error('artists/:id/albums error:', err);
    res.status(500).json({ error: 'Failed to fetch albums' });
  }
});

// GET /artists/:id/reviews — all reviews for this artist + average score
router.get('/:id/reviews', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const reviews = await Review.find({ spotifyArtistId: req.params.id, type: 'artist' })
      .sort({ createdAt: -1 })
      .populate('userId', '_id displayName avatarUrl spotifyId')
      .populate('comments.userId', '_id displayName avatarUrl');

    const scores = reviews.map(r => r.score).filter((s): s is number => s != null);
    const avgScore = scores.length > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
      : null;

    res.json({ reviews, avgScore, myId: req.user!._id.toString() });
  } catch {
    res.status(500).json({ error: 'Failed to fetch artist reviews' });
  }
});

export default router;
