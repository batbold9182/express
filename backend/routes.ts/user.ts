import { Router, Response } from 'express';
import { Review } from '../models/review';
import { User } from '../models/User';
import { List } from '../models/List';
import { requireAuth, optionalAuth, AuthRequest } from '../middleware/auth';

const router = Router();

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
  try {
    const user = await User.findOne({ spotifyId: req.params.id });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    const type = req.query.type as string | undefined;
    const filter: any = { userId: user._id };
    if (type === 'album' || type === 'artist') filter.type = type;
    else if (type === 'track') filter.$or = [{ type: 'track' }, { type: { $exists: false } }];
    const reviews = await Review.find(filter)
      .sort({ createdAt: -1 })
      .populate('userId', '_id displayName avatarUrl spotifyId')
      .populate('comments.userId', '_id displayName avatarUrl');
    res.json(reviews);
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
  try {
    const me = await User.findById(req.user!._id);
    const following = me?.following ?? [];
    const reviews = await Review.find({
      userId: { $in: [...following, req.user!._id] },
      shareToFeed: true,
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('userId', '_id displayName avatarUrl spotifyId')
      .populate('comments.userId', '_id displayName avatarUrl');
    res.json({ items: reviews, myId: req.user!._id.toString() });
  } catch {
    res.status(500).json({ error: 'Failed to fetch feed' });
  }
});

export default router;
