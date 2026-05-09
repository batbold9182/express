import { Router, Request, Response } from 'express';
import { Review } from '../models/review';

const router = Router();

// POST /reviews — create a review
router.post('/', async (req: Request, res: Response) => {
  try {
    const review = await Review.create(req.body);
    res.status(201).json(review);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create review', detail: err });
  }
});

// GET /reviews/:id — get a single review
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) { res.status(404).json({ error: 'Review not found' }); return; }
    res.json(review);
  } catch {
    res.status(500).json({ error: 'Failed to fetch review' });
  }
});

// DELETE /reviews/:id — delete a review
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await Review.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

export default router;
