import { Router, Response } from 'express';
import { List } from '../models/List';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /lists
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { title, items } = req.body;
    if (!title?.trim()) { res.status(400).json({ error: 'Title is required' }); return; }
    const list = await List.create({ userId: req.user!._id, title: title.trim(), items: items ?? [] });
    res.status(201).json(list);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create list', detail: err });
  }
});

// GET /lists/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const list = await List.findById(req.params.id).populate('userId', '_id displayName avatarUrl spotifyId');
    if (!list) { res.status(404).json({ error: 'List not found' }); return; }
    res.json(list);
  } catch {
    res.status(500).json({ error: 'Failed to fetch list' });
  }
});

// PUT /lists/:id — replace title and/or items
router.put('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const list = await List.findById(req.params.id);
    if (!list) { res.status(404).json({ error: 'List not found' }); return; }
    if (list.userId.toString() !== req.user!._id.toString()) {
      res.status(403).json({ error: 'Not your list' }); return;
    }
    const { title, items } = req.body;
    if (title !== undefined) list.title = title.trim();
    if (items !== undefined) list.items = items;
    list.updatedAt = new Date();
    await list.save();
    res.json(list);
  } catch {
    res.status(500).json({ error: 'Failed to update list' });
  }
});

// DELETE /lists/:id
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const list = await List.findById(req.params.id);
    if (!list) { res.status(404).json({ error: 'List not found' }); return; }
    if (list.userId.toString() !== req.user!._id.toString()) {
      res.status(403).json({ error: 'Not your list' }); return;
    }
    await list.deleteOne();
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete list' });
  }
});

export default router;
