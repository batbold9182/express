import { Router, Request, Response } from 'express';
import { Review } from '../models/review';
import { User } from '../models/User';

const router = Router();

// GET /users/:id — get a user profile
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const user = await User.findOne({ spotifyId: req.params.id }).select('-accessToken -refreshToken');
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// GET /users/:id/reviews — get all reviews by a user
router.get('/:id/reviews', async (req: Request, res: Response) => {
  try {
    const user = await User.findOne({ spotifyId: req.params.id });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    const reviews = await Review.find({ userId: user._id }).sort({ createdAt: -1 });
    res.json(reviews);
  } catch {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

export default router;
