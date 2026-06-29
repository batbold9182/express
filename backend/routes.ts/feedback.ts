import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { Feedback } from '../models/Feedback';

const router = Router();

router.post('/', requireAuth, async (req: AuthRequest, res) => {
  const { type, text } = req.body as { type?: string; text?: string };
  if (!type || !['bug', 'feature', 'other'].includes(type)) {
    res.status(400).json({ error: 'type must be bug, feature, or other' }); return;
  }
  if (!text?.trim()) { res.status(400).json({ error: 'text is required' }); return; }
  if (text.length > 1000) { res.status(400).json({ error: 'text too long' }); return; }

  await Feedback.create({
    userId:      req.user!._id,
    displayName: req.user!.displayName,
    email:       req.user!.email,
    type: type as 'bug' | 'feature' | 'other',
    text: text.trim(),
  });

  res.status(201).json({ message: 'Thanks for the feedback!' });
});

router.get('/', requireAuth, async (req: AuthRequest, res) => {
  if (req.user!.email !== process.env.ADMIN_EMAIL) {
    res.status(403).json({ error: 'Forbidden' }); return;
  }
  const items = await Feedback.find().sort({ createdAt: -1 }).limit(200).lean();
  res.json(items);
});

export default router;
