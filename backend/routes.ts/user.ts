import { Router, Response } from 'express';
import { Review } from '../models/review';
import { User } from '../models/User';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /users/:id — get a user profile
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ spotifyId: req.params.id }).select('-accessToken -refreshToken');
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// GET /users/:id/reviews — get all reviews by a user
router.get('/:id/reviews', async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ spotifyId: req.params.id });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    const reviews = await Review.find({ userId: user._id }).sort({ createdAt: -1 });
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
