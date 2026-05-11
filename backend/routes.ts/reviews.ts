import { Router, Response } from 'express';
import { Review } from '../models/review';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

const POPULATE = [
  { path: 'userId', select: '_id displayName avatarUrl spotifyId' },
  { path: 'comments.userId', select: '_id displayName avatarUrl' },
];

// GET /reviews/trending — most liked public reviews in the last 7 days
router.get('/trending', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const offset = parseInt(req.query.offset as string) || 0;
    const limit  = 15;
    const since  = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const docs   = await Review.aggregate([
      { $match: { shareToFeed: true, createdAt: { $gte: since } } },
      { $addFields: { likeCount: { $size: '$likes' } } },
      { $sort: { likeCount: -1, createdAt: -1 } },
      { $skip: offset },
      { $limit: limit },
    ]);
    const items = await Review.populate(docs, POPULATE);
    res.json({ items, myId: req.user!._id.toString(), hasMore: items.length === limit });
  } catch {
    res.status(500).json({ error: 'Failed to fetch trending' });
  }
});

// GET /reviews/top — highest scored public reviews
router.get('/top', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const offset = parseInt(req.query.offset as string) || 0;
    const limit  = 15;
    const docs   = await Review.aggregate([
      { $match: { shareToFeed: true, score: { $gte: 7 } } },
      { $sort: { score: -1, createdAt: -1 } },
      { $skip: offset },
      { $limit: limit },
    ]);
    const items = await Review.populate(docs, POPULATE);
    res.json({ items, myId: req.user!._id.toString(), hasMore: items.length === limit });
  } catch {
    res.status(500).json({ error: 'Failed to fetch top' });
  }
});

// GET /reviews/mine — lightweight list of current user's reviewed IDs
router.get('/mine', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const reviews = await Review.find({ userId: req.user!._id })
      .select('spotifyTrackId spotifyAlbumId type')
      .lean();
    res.json(reviews);
  } catch {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { type, spotifyTrackId, spotifyAlbumId } = req.body;
    const isAlbum = type === 'album';
    const existing = isAlbum
      ? await Review.findOne({ userId: req.user!._id, spotifyAlbumId, type: 'album' })
      : await Review.findOne({ userId: req.user!._id, spotifyTrackId });
    if (existing) {
      res.status(409).json({ error: isAlbum ? 'You already reviewed this album' : 'You already reviewed this track' });
      return;
    }
    const review = await Review.create({ ...req.body, userId: req.user!._id });
    res.status(201).json(review);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create review', detail: err });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) { res.status(404).json({ error: 'Review not found' }); return; }
    res.json(review);
  } catch {
    res.status(500).json({ error: 'Failed to fetch review' });
  }
});

router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) { res.status(404).json({ error: 'Review not found' }); return; }
    if (review.userId?.toString() !== req.user!._id.toString()) {
      res.status(403).json({ error: 'Not your review' }); return;
    }
    await review.deleteOne();
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

router.put('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) { res.status(404).json({ error: 'Review not found' }); return; }
    if (review.userId?.toString() !== req.user!._id.toString()) {
      res.status(403).json({ error: 'Not your review' }); return;
    }
    const { score, text, moods } = req.body;
    if (score !== undefined) review.score = score;
    if (text  !== undefined) review.text  = text;
    if (moods !== undefined) review.moods = moods;
    await review.save();
    res.json(review);
  } catch {
    res.status(500).json({ error: 'Failed to edit review' });
  }
});

router.put('/:id/comments/:commentId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) { res.status(400).json({ error: 'Missing text' }); return; }
    const review = await Review.findOne({ _id: req.params.id, 'comments._id': req.params.commentId });
    if (!review) { res.status(404).json({ error: 'Not found' }); return; }
    const comment = review.comments.find(c => c._id.toString() === req.params.commentId);
    if (!comment) { res.status(404).json({ error: 'Comment not found' }); return; }
    if (comment.userId.toString() !== req.user!._id.toString()) {
      res.status(403).json({ error: 'Not your comment' }); return;
    }
    comment.text = text.trim();
    await review.save();
    res.json(review.comments);
  } catch {
    res.status(500).json({ error: 'Failed to edit comment' });
  }
});

router.delete('/:id/comments/:commentId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const review = await Review.findOne({ _id: req.params.id, 'comments._id': req.params.commentId });
    if (!review) { res.status(404).json({ error: 'Not found' }); return; }
    const comment = review.comments.find(c => c._id.toString() === req.params.commentId);
    if (!comment) { res.status(404).json({ error: 'Comment not found' }); return; }
    if (comment.userId.toString() !== req.user!._id.toString()) {
      res.status(403).json({ error: 'Not your comment' }); return;
    }
    review.comments = review.comments.filter(c => c._id.toString() !== req.params.commentId) as typeof review.comments;
    await review.save();
    res.json(review.comments);
  } catch {
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

router.post('/:id/comments', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) { res.status(400).json({ error: 'Missing text' }); return; }
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { $push: { comments: { userId: req.user!._id, text: text.trim() } } },
      { returnDocument: 'after' }
    ).populate('comments.userId', 'displayName avatarUrl');
    if (!review) { res.status(404).json({ error: 'Review not found' }); return; }
    res.json(review.comments);
  } catch {
    res.status(500).json({ error: 'Failed to comment' });
  }
});

router.post('/:id/comments/:commentId/like', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const review = await Review.findOneAndUpdate(
      { _id: req.params.id, 'comments._id': req.params.commentId },
      { $addToSet: { 'comments.$.likes': req.user!._id } },
      { returnDocument: 'after' }
    );
    if (!review) { res.status(404).json({ error: 'Not found' }); return; }
    const comment = review.comments.find(c => c._id.toString() === req.params.commentId);
    res.json({ likes: comment?.likes?.length ?? 0 });
  } catch {
    res.status(500).json({ error: 'Failed to like comment' });
  }
});

router.delete('/:id/comments/:commentId/like', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const review = await Review.findOneAndUpdate(
      { _id: req.params.id, 'comments._id': req.params.commentId },
      { $pull: { 'comments.$.likes': req.user!._id } },
      { returnDocument: 'after' }
    );
    if (!review) { res.status(404).json({ error: 'Not found' }); return; }
    const comment = review.comments.find(c => c._id.toString() === req.params.commentId);
    res.json({ likes: comment?.likes?.length ?? 0 });
  } catch {
    res.status(500).json({ error: 'Failed to unlike comment' });
  }
});

router.post('/:id/like', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { likes: req.user!._id } },
      { returnDocument: 'after' }
    );
    if (!review) { res.status(404).json({ error: 'Review not found' }); return; }
    res.json({ likes: review.likes?.length ?? 0 });
  } catch {
    res.status(500).json({ error: 'Failed to like' });
  }
});

router.delete('/:id/like', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { $pull: { likes: req.user!._id } },
      { returnDocument: 'after' }
    );
    if (!review) { res.status(404).json({ error: 'Review not found' }); return; }
    res.json({ likes: review.likes?.length ?? 0 });
  } catch {
    res.status(500).json({ error: 'Failed to unlike' });
  }
});

export default router;
