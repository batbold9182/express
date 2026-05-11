import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';

export interface AuthRequest extends Request {
  user?: typeof User.prototype;
}

export async function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    try {
      const r = await fetch('https://api.spotify.com/v1/me', { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const { id } = await r.json() as { id: string };
        const user = await User.findOne({ spotifyId: id });
        if (user) req.user = user;
      }
    } catch {}
  }
  next();
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) { res.status(401).json({ error: 'Missing token' }); return; }

  try {
    const profileRes = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!profileRes.ok) { res.status(401).json({ error: 'Invalid token' }); return; }

    const profile = await profileRes.json() as { id: string };
    const user = await User.findOne({ spotifyId: profile.id });
    if (!user) { res.status(401).json({ error: 'User not in DB' }); return; }

    req.user = user;
    next();
  } catch {
    res.status(500).json({ error: 'Auth check failed' });
  }
}
