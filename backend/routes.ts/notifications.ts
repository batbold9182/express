import { Router, Response } from 'express';
import { Notification } from '../models/Notifications';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /notifications?offset=&limit=
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const offset = parseInt(req.query.offset as string) || 0;
    const limit  = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ recipientId: req.user!._id })
        .sort({ updatedAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate('actors', 'displayName avatarUrl spotifyId')
        .populate('entityId', 'spotifyTrackId spotifyAlbumId spotifyArtistId type')
        .lean(),
      Notification.countDocuments({ recipientId: req.user!._id, read: false }),
    ]);
    res.json({ notifications, unreadCount, hasMore: notifications.length === limit });
  } catch {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// GET /notifications/unread-count — lightweight badge query
router.get('/unread-count', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const count = await Notification.countDocuments({ recipientId: req.user!._id, read: false });
    res.json({ count });
  } catch {
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// POST /notifications/read-all
router.post('/read-all', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await Notification.updateMany(
      { recipientId: req.user!._id, read: false },
      { $set: { read: true } }
    );
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to mark all read' });
  }
});

// POST /notifications/:id/read
router.post('/:id/read', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, recipientId: req.user!._id },
      { $set: { read: true } }
    );
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to mark read' });
  }
});

export default router;
