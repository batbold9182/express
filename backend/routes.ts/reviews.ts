import { Router, Response } from 'express';
import { Review } from '../models/review';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { notify } from '../lib/notify';
import { stripNullAuthors } from '../lib/stripNullAuthors';

const router = Router();

const POPULATE = [
  { path: 'userId', select: '_id displayName avatarUrl spotifyId' },
  { path: 'comments.userId', select: '_id displayName avatarUrl' },
];

// GET /reviews/trending — most liked public reviews in the last 7 days
router.get('/trending', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const offset = parseInt(req.query.offset as string) || 0;
    const limit  = Math.min(parseInt(req.query.limit as string) || 15, 50);
    const since  = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const docs   = await Review.aggregate([
      { $match: { shareToFeed: true, createdAt: { $gte: since } } },
      { $addFields: { likeCount: { $size: '$likes' } } },
      { $sort: { likeCount: -1, createdAt: -1 } },
      { $skip: offset },
      { $limit: limit },
    ]);
    const populated = await Review.populate(docs, POPULATE);
    const items = stripNullAuthors(populated as any[]);
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
    const populated = await Review.populate(docs, POPULATE);
    const items = stripNullAuthors(populated as any[]);
    res.json({ items, myId: req.user!._id.toString(), hasMore: items.length === limit });
  } catch {
    res.status(500).json({ error: 'Failed to fetch top' });
  }
});

// GET /reviews/leaderboard?type=most-rated|top-scored|track|album|artist&limit=100
router.get('/leaderboard', requireAuth, async (req: AuthRequest, res: Response) => {
  const type  = (req.query.type as string) || 'most-rated';
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 100);
  try {
    let pipeline: any[];

    if (type === 'most-rated' || type === 'top-scored') {
      pipeline = [
        {
          $group: {
            _id: {
              spotifyId: {
                $cond: [
                  { $eq: ['$type', 'artist'] }, '$spotifyArtistId',
                  { $cond: [{ $eq: ['$type', 'album'] }, '$spotifyAlbumId', { $ifNull: ['$spotifyTrackId', ''] }] },
                ],
              },
              type: { $ifNull: ['$type', 'track'] },
            },
            avgScore:    { $avg: '$score' },
            reviewCount: { $sum: 1 },
            trackName:   { $first: '$trackName' },
            artistName:  { $first: '$artistName' },
            albumArt:    { $first: '$albumArt' },
            spotifyTrackId:  { $first: '$spotifyTrackId' },
            spotifyAlbumId:  { $first: '$spotifyAlbumId' },
            spotifyArtistId: { $first: '$spotifyArtistId' },
          },
        },
        { $sort: type === 'top-scored' ? { avgScore: -1, reviewCount: -1 } : { reviewCount: -1, avgScore: -1 } },
        { $limit: limit },
        { $project: { _id: 0, type: '$_id.type', avgScore: { $round: ['$avgScore', 1] }, reviewCount: 1, trackName: 1, artistName: 1, albumArt: 1, spotifyTrackId: 1, spotifyAlbumId: 1, spotifyArtistId: 1 } },
      ];
    } else {
      const idField   = type === 'artist' ? 'spotifyArtistId' : type === 'album' ? 'spotifyAlbumId' : 'spotifyTrackId';
      const typeMatch = type === 'track'
        ? { $or: [{ type: 'track' }, { type: { $exists: false } }] }
        : { type };
      pipeline = [
        { $match: typeMatch },
        {
          $group: {
            _id: `$${idField}`,
            avgScore:    { $avg: '$score' },
            reviewCount: { $sum: 1 },
            trackName:   { $first: '$trackName' },
            artistName:  { $first: '$artistName' },
            albumArt:    { $first: '$albumArt' },
            spotifyTrackId:  { $first: '$spotifyTrackId' },
            spotifyAlbumId:  { $first: '$spotifyAlbumId' },
            spotifyArtistId: { $first: '$spotifyArtistId' },
          },
        },
        { $sort: { avgScore: -1, reviewCount: -1 } },
        { $limit: limit },
        { $project: { _id: 0, type: type === 'track' ? 'track' : type, avgScore: { $round: ['$avgScore', 1] }, reviewCount: 1, trackName: 1, artistName: 1, albumArt: 1, spotifyTrackId: 1, spotifyAlbumId: 1, spotifyArtistId: 1 } },
      ];
    }

    const items = await Review.aggregate(pipeline);
    res.json({ items });
  } catch (err) {
    console.error('[leaderboard] error:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// GET /reviews/mine — lightweight list of current user's reviewed IDs
router.get('/mine', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const reviews = await Review.find({ userId: req.user!._id })
      .select('spotifyTrackId spotifyAlbumId spotifyArtistId type')
      .lean();
    res.json(reviews);
  } catch {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { type, spotifyTrackId, spotifyAlbumId, spotifyArtistId } = req.body;
    let existing = null;
    let errorMsg = '';
    if (type === 'artist') {
      existing = await Review.findOne({ userId: req.user!._id, spotifyArtistId, type: 'artist' });
      errorMsg = 'You already reviewed this artist';
    } else if (type === 'album') {
      existing = await Review.findOne({ userId: req.user!._id, spotifyAlbumId, type: 'album' });
      errorMsg = 'You already reviewed this album';
    } else {
      existing = await Review.findOne({ userId: req.user!._id, spotifyTrackId });
      errorMsg = 'You already reviewed this track';
    }
    if (existing) { res.status(409).json({ error: errorMsg }); return; }
    const { trackName, artistName, albumArt, score, text, moods, shareToFeed } = req.body;
    const review = await Review.create({
      userId: req.user!._id,
      type, spotifyTrackId, spotifyAlbumId, spotifyArtistId,
      trackName, artistName, albumArt, score, text, moods, shareToFeed,
    });
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
    const { text, parentId } = req.body;
    if (!text?.trim()) { res.status(400).json({ error: 'Missing text' }); return; }

    if (parentId) {
      const exists = await Review.findOne({ _id: req.params.id, 'comments._id': parentId });
      if (!exists) { res.status(404).json({ error: 'Parent comment not found' }); return; }
    }

    const newComment: any = { userId: req.user!._id, text: text.trim() };
    if (parentId) newComment.parentId = parentId;

    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { $push: { comments: newComment } },
      { returnDocument: 'after' }
    ).populate('comments.userId', 'displayName avatarUrl spotifyId');
    if (!review) { res.status(404).json({ error: 'Review not found' }); return; }
    const snapshot = { trackName: review.trackName, albumArt: review.albumArt ?? undefined, spotifyTrackId: review.spotifyTrackId ?? undefined, spotifyAlbumId: review.spotifyAlbumId ?? undefined, spotifyArtistId: review.spotifyArtistId ?? undefined, type: review.type };
    // notify review owner of the comment
    notify({ type: 'comment', recipientId: review.userId as any, actorId: req.user!._id, entityId: review._id as any, entitySnapshot: snapshot }).catch(console.error);
    // if it's a reply, also notify the parent comment author
    if (parentId) {
      const parent = review.comments.find(c => c._id.toString() === parentId);
      if (parent) {
        const parentAuthorId = ((parent.userId as any)._id ?? parent.userId) as any;
        if (!parentAuthorId.equals(review.userId) && !parentAuthorId.equals(req.user!._id)) {
          notify({ type: 'reply', recipientId: parentAuthorId, actorId: req.user!._id, entityId: review._id as any, entitySnapshot: snapshot }).catch(console.error);
        }
      }
    }
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
    notify({
      type: 'like',
      recipientId: review.userId as any,
      actorId: req.user!._id,
      entityId: review._id as any,
      entitySnapshot: { trackName: review.trackName, albumArt: review.albumArt ?? undefined, spotifyTrackId: review.spotifyTrackId ?? undefined, spotifyAlbumId: review.spotifyAlbumId ?? undefined, spotifyArtistId: review.spotifyArtistId ?? undefined, type: review.type },
    }).catch(console.error);
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
