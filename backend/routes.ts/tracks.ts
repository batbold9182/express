import { Router, Request, Response } from 'express';
import { Review } from '../models/review';
import { stripNullAuthors } from '../lib/stripNullAuthors';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { spotifyHeaders } from './_spotifyHeaders';
import { cacheGet, cacheSet, TTL } from './_cache';

const router = Router();

// GET /tracks/:id — track metadata from Spotify
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const key = `track:${req.params.id}`;
  const cached = cacheGet(key);
  if (cached) { res.json(cached); return; }
  try {
    const r = await fetch(`https://api.spotify.com/v1/tracks/${req.params.id}`, { headers: await spotifyHeaders(req) });
    if (!r.ok) { const t = await r.text(); res.status(r.status === 401 || r.status === 403 ? 502 : r.status).json({ error: t }); return; }
    const data = await r.json();
    cacheSet(key, data, TTL.DAY);
    res.json(data);
  } catch {
    res.status(500).json({ error: 'Failed to fetch track' });
  }
});

// GET /tracks/:id/reviews — paginated reviews + stats from all
router.get('/:id/reviews', requireAuth, async (req: AuthRequest, res: Response) => {
  const offset = parseInt(req.query.offset as string) || 0;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
  const filter: any = {
    spotifyTrackId: req.params.id,
    $or: [{ type: 'track' }, { type: { $exists: false } }],
  };
  try {
    const [allScores, raw] = await Promise.all([
      Review.find(filter).select('score'),
      Review.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit)
        .populate('userId', '_id displayName avatarUrl spotifyId')
        .populate('comments.userId', '_id displayName avatarUrl'),
    ]);
    const reviews = stripNullAuthors(raw);
    const scores = allScores.map(r => r.score).filter((s): s is number => s != null);
    const avgScore = scores.length > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
      : null;
    const distribution = Array(10).fill(0);
    scores.forEach(s => {
      const bucket = Math.round(s) - 1;
      if (bucket >= 0 && bucket <= 9) distribution[bucket]++;
    });
    res.json({ reviews, avgScore, distribution, myId: req.user!._id.toString(), total: allScores.length, hasMore: offset + reviews.length < allScores.length });
  } catch {
    res.status(500).json({ error: 'Failed to fetch track reviews' });
  }
});

export default router;
