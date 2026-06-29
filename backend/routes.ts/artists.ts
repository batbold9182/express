import { Router, Request, Response } from 'express';
import { Review } from '../models/review';
import { stripNullAuthors } from '../lib/stripNullAuthors';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { spotifyHeaders, isEmailUser } from './_spotifyHeaders';
import { cacheGet, cacheSet, TTL } from './_cache';

const router = Router();

const inFlight = new Map<string, Promise<unknown>>();

// GET /artists/:id — artist metadata from Spotify
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const key = `artist:${req.params.id}`;
  const cached = cacheGet(key);
  if (cached) { res.json(cached); return; }
  try {
    const r = await fetch(`https://api.spotify.com/v1/artists/${req.params.id}`, { headers: spotifyHeaders(req) });
    if (!r.ok) { const t = await r.text(); console.error('Spotify artist error:', r.status, t); res.status(r.status === 401 || r.status === 403 ? 502 : r.status).json({ error: t }); return; }
    const data = await r.json();
    cacheSet(key, data, TTL.DAY);
    res.json(data);
  } catch (err) {
    console.error('artists/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch artist' });
  }
});

// GET /artists/:id/albums?group=album|single|compilation|appears_on
router.get('/:id/albums', requireAuth, async (req: Request, res: Response) => {
  const group  = (req.query.group  as string) || 'album';
  const limit  = Number(req.query.limit)  || 20;
  const offset = Number(req.query.offset) || 0;
  const key = `artist-albums:${req.params.id}:${group}:${limit}:${offset}`;

  const cached = cacheGet(key);
  if (cached) {
    if ((cached as any).__rl) { res.status(429).json({ error: 'Rate limited by Spotify, try again shortly' }); return; }
    res.json(cached);
    return;
  }

  if (inFlight.has(key)) {
    try {
      res.json(await inFlight.get(key)!);
    } catch (err: any) {
      res.status(err.status ?? 500).json({ error: err.message || 'Failed to fetch albums' }); // err.status already remapped
    }
    return;
  }

  const headers = spotifyHeaders(req);
  const url = `https://api.spotify.com/v1/artists/${req.params.id}/albums?include_groups=${encodeURIComponent(group)}&market=US`;
  const promise = fetch(url, { headers })
  .then(async r => {
    if (!r.ok) {
      const t = await r.text();
      const retryAfter = Number(r.headers.get('Retry-After') ?? 10);
      const mappedStatus = r.status === 401 || r.status === 403 ? 502 : r.status;
      console.error('Spotify albums error:', r.status, group, t);
      throw Object.assign(new Error(t), { status: mappedStatus, retryAfter });
    }
    return r.json() as Promise<unknown>;
  });
  inFlight.set(key, promise);

  try {
    const data = await promise;
    cacheSet(key, data, TTL.SIX_HOURS);
    res.json(data);
  } catch (err: any) {
    if (err.status === 429) cacheSet(key, { __rl: true }, (err.retryAfter ?? 10) * 1000);
    res.status(err.status ?? 500).json({ error: err.message || 'Failed to fetch albums' });
  } finally {
    inFlight.delete(key);
  }
});

// GET /artists/:id/reviews — all reviews for this artist + average score
router.get('/:id/reviews', requireAuth, async (req: AuthRequest, res: Response) => {
  const offset = parseInt(req.query.offset as string) || 0;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
  const filter: any = { spotifyArtistId: req.params.id, type: 'artist' };
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
    res.json({ reviews, avgScore, myId: req.user!._id.toString(), total: allScores.length, hasMore: offset + reviews.length < allScores.length });
  } catch {
    res.status(500).json({ error: 'Failed to fetch artist reviews' });
  }
});

export default router;
