import { Router, Response } from 'express';
import crypto from 'crypto';
import { Review } from '../models/review';
import { User } from '../models/User';
import { List } from '../models/List';
import { requireAuth, optionalAuth, AuthRequest, invalidateToken } from '../middleware/auth';
import { notify } from '../lib/notify';
import { stripNullAuthors } from '../lib/stripNullAuthors';

const router = Router();

// Builds the Mongo filter for a user's reviews, optionally narrowed by type and a
// case-insensitive search over the display name (trackName) and artistName.
function buildReviewFilter(userId: any, type?: string, q?: string): any {
  const filter: any = { userId };

  const typeCond =
    type === 'album' || type === 'artist'
      ? { type }
      : type === 'track'
        ? { $or: [{ type: 'track' }, { type: { $exists: false } }] }
        : null;

  const search = q?.trim();
  const searchCond = search
    ? (() => {
        const rx = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
        return { $or: [{ trackName: rx }, { artistName: rx }] };
      })()
    : null;

  // Both type (track) and search use $or, so combine via $and to avoid clobbering.
  if (typeCond && searchCond) filter.$and = [typeCond, searchCond];
  else if (typeCond) Object.assign(filter, typeCond);
  else if (searchCond) Object.assign(filter, searchCond);

  return filter;
}

// GET /users/search?q= — search users by display name
router.get('/search', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const q = (req.query.q as string)?.trim();
    if (!q) { res.json([]); return; }
    const users = await User.find({
      displayName: { $regex: q, $options: 'i' },
      ...(req.user ? { _id: { $ne: req.user._id } } : {}),
    }).select('spotifyId displayName avatarUrl _id').limit(20);
    const myFollowing = req.user?.following ?? [];
    res.json(users.map(u => ({ ...u.toObject(), isFollowing: myFollowing.some((id: any) => id.equals(u._id)) })));
  } catch {
    res.status(500).json({ error: 'Search failed' });
  }
});

// GET /users/me — own profile, always returns the authenticated user's record
router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!._id).select('-accessToken -refreshToken');
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    const followerCount = await User.countDocuments({ following: user._id });
    const followingCount = user.following?.length ?? 0;
    res.json({ ...user.toObject(), followerCount, followingCount, isFollowing: false });
  } catch {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// DELETE /users/me/spotify — unlink Spotify, keep the account and all its reviews.
// Mirrors the "strip Spotify from the previous owner" branch in auth.ts /callback.
router.delete('/me/spotify', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!._id);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    if ((user.spotifyId as string | undefined)?.startsWith('email:')) {
      res.status(400).json({ error: 'Spotify is not connected' }); return;
    }
    // Web login is email-only, so an account with no password and no Spotify has no way back in.
    if (!user.passwordHash) {
      res.status(409).json({
        error: 'Set a password first — without one you would be locked out of this account.',
      });
      return;
    }

    // The stored accessToken IS the Spotify token for linked users, so it has to be swapped for
    // an app session token — same shape /auth/register and /auth/email-login issue.
    const oldToken   = user.accessToken as string;
    const accessToken = crypto.randomBytes(40).toString('hex');
    const expiresAt   = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const spotifyId   = `email:${crypto.randomUUID()}`;

    await User.updateOne(
      { _id: user._id },
      { $set: { spotifyId, refreshToken: '', accessToken, tokenExpiresAt: expiresAt, updatedAt: new Date() } }
    );
    invalidateToken(oldToken);

    res.json({ access_token: accessToken, spotify_id: spotifyId, expires_at: expiresAt.getTime() });
  } catch {
    res.status(500).json({ error: 'Failed to disconnect Spotify' });
  }
});

// GET /users/me/reviews/counts
router.get('/me/reviews/counts', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const [artist, album, track] = await Promise.all([
      Review.countDocuments({ userId: req.user!._id, type: 'artist' }),
      Review.countDocuments({ userId: req.user!._id, type: 'album' }),
      Review.countDocuments({ userId: req.user!._id, $or: [{ type: 'track' }, { type: { $exists: false } }] }),
    ]);
    res.json({ artist, album, track });
  } catch {
    res.status(500).json({ error: 'Failed to fetch counts' });
  }
});

// GET /users/me/reviews
router.get('/me/reviews', requireAuth, async (req: AuthRequest, res: Response) => {
  const offset = parseInt(req.query.offset as string) || 0;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
  try {
    const filter = buildReviewFilter(req.user!._id, req.query.type as string, req.query.q as string);
    const [total, raw] = await Promise.all([
      Review.countDocuments(filter),
      Review.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit)
        .populate('userId', '_id displayName avatarUrl spotifyId')
        .populate('comments.userId', '_id displayName avatarUrl'),
    ]);
    const reviews = stripNullAuthors(raw);
    res.json({ reviews, total, hasMore: offset + reviews.length < total });
  } catch {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// GET /users/suggested?limit=5 — users to follow, ranked by follower count
router.get('/suggested', requireAuth, async (req: AuthRequest, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 5, 20);
  try {
    // Re-fetch following from DB — req.user is cached for 4 min and may be stale after unfollow
    const fresh = await User.findById(req.user!._id).select('following');
    const excluded = [...(fresh?.following ?? []), req.user!._id];
    const suggested = await User.aggregate([
      { $match: { _id: { $nin: excluded } } },
      {
        $lookup: {
          from: 'users',
          let: { uid: '$_id' },
          pipeline: [
            { $match: { $expr: { $in: ['$$uid', '$following'] } } },
            { $count: 'n' },
          ],
          as: 'followerDocs',
        },
      },
      { $addFields: { followerCount: { $ifNull: [{ $arrayElemAt: ['$followerDocs.n', 0] }, 0] } } },
      { $sort: { followerCount: -1 } },
      { $limit: limit },
      { $project: { spotifyId: 1, displayName: 1, avatarUrl: 1, followerCount: 1 } },
    ]);
    res.json(suggested);
  } catch (err) {
    console.error('[suggested] error:', err);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

// GET /users/:id — get a user profile
router.get('/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ spotifyId: req.params.id }).select('-accessToken -refreshToken');
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    const followerCount = await User.countDocuments({ following: user._id });
    const followingCount = user.following?.length ?? 0;
    const isFollowing = req.user
      ? (req.user.following ?? []).some((id: any) => id.equals(user._id))
      : false;
    res.json({ ...user.toObject(), followerCount, followingCount, isFollowing });
  } catch {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// GET /users/:id/followers
router.get('/:id/followers', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ spotifyId: req.params.id });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    const followers = await User.find({ following: user._id }).select('spotifyId displayName avatarUrl _id');
    const myFollowing = req.user?.following ?? [];
    res.json(followers.map(f => ({ ...f.toObject(), isFollowing: myFollowing.some((id: any) => id.equals(f._id)) })));
  } catch {
    res.status(500).json({ error: 'Failed to fetch followers' });
  }
});

// GET /users/:id/following
router.get('/:id/following', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ spotifyId: req.params.id }).populate('following', 'spotifyId displayName avatarUrl _id');
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    const myFollowing = req.user?.following ?? [];
    res.json((user.following as any[]).map(f => ({ ...f.toObject(), isFollowing: myFollowing.some((id: any) => id.equals(f._id)) })));
  } catch {
    res.status(500).json({ error: 'Failed to fetch following' });
  }
});

// GET /users/:id/reviews/counts — count per type (must be before /:id/reviews)
router.get('/:id/reviews/counts', async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ spotifyId: req.params.id });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    const [artist, album, track] = await Promise.all([
      Review.countDocuments({ userId: user._id, type: 'artist' }),
      Review.countDocuments({ userId: user._id, type: 'album' }),
      Review.countDocuments({ userId: user._id, $or: [{ type: 'track' }, { type: { $exists: false } }] }),
    ]);
    res.json({ artist, album, track });
  } catch {
    res.status(500).json({ error: 'Failed to fetch counts' });
  }
});

// GET /users/:id/reviews — get reviews by a user, optionally filtered by ?type=track|album|artist
router.get('/:id/reviews', async (req: AuthRequest, res: Response) => {
  const offset = parseInt(req.query.offset as string) || 0;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
  try {
    const user = await User.findOne({ spotifyId: req.params.id });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    const filter = buildReviewFilter(user._id, req.query.type as string, req.query.q as string);
    const [total, raw] = await Promise.all([
      Review.countDocuments(filter),
      Review.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit)
        .populate('userId', '_id displayName avatarUrl spotifyId')
        .populate('comments.userId', '_id displayName avatarUrl'),
    ]);
    const reviews = stripNullAuthors(raw);
    res.json({ reviews, total, hasMore: offset + reviews.length < total });
  } catch {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// POST /users/:id/follow
router.post('/:id/follow', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const target = await User.findOne({ spotifyId: req.params.id });
    if (!target) { res.status(404).json({ error: 'User not found' }); return; }
    if (target._id.equals(req.user!._id)) { res.status(400).json({ error: 'Cannot follow yourself' }); return; }
    await User.findByIdAndUpdate(req.user!._id, { $addToSet: { following: target._id } });
    notify({ type: 'follow', recipientId: target._id as any, actorId: req.user!._id }).catch(console.error);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to follow' });
  }
});

// DELETE /users/:id/follow
router.delete('/:id/follow', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const target = await User.findOne({ spotifyId: req.params.id });
    if (!target) { res.status(404).json({ error: 'User not found' }); return; }
    await User.findByIdAndUpdate(req.user!._id, { $pull: { following: target._id } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to unfollow' });
  }
});

// GET /users/:id/lists
router.get('/:id/lists', async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ spotifyId: req.params.id });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    const lists = await List.find({ userId: user._id }).sort({ updatedAt: -1 });
    res.json(lists);
  } catch {
    res.status(500).json({ error: 'Failed to fetch lists' });
  }
});

// GET /feed — reviews from followed users
router.get('/feed/me', requireAuth, async (req: AuthRequest, res: Response) => {
  const offset = parseInt(req.query.offset as string) || 0;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
  try {
    const me = await User.findById(req.user!._id);
    const following = me?.following ?? [];
    const filter = { userId: { $in: [...following, req.user!._id] }, shareToFeed: true };
    const [total, raw] = await Promise.all([
      Review.countDocuments(filter),
      Review.find(filter)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate('userId', '_id displayName avatarUrl spotifyId')
        .populate('comments.userId', '_id displayName avatarUrl'),
    ]);
    const reviews = stripNullAuthors(raw);
    res.json({ items: reviews, myId: req.user!._id.toString(), hasMore: offset + reviews.length < total });
  } catch {
    res.status(500).json({ error: 'Failed to fetch feed' });
  }
});

export default router;
