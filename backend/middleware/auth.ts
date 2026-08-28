import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';

export interface AuthRequest extends Request {
  user?: typeof User.prototype;
}

type CacheEntry = { user: typeof User.prototype; expiresAt: number };
const tokenCache = new Map<string, CacheEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of tokenCache) if (v.expiresAt < now) tokenCache.delete(k);
}, 10 * 60 * 1000);

// Drop a token from the cache immediately — call after rotating a user's accessToken,
// otherwise the old one keeps resolving for up to the 4-min TTL.
export function invalidateToken(token: string) {
  tokenCache.delete(token);
}

async function resolveUser(token: string): Promise<typeof User.prototype | null> {
  const cached = tokenCache.get(token);
  if (cached && cached.expiresAt > Date.now()) return cached.user;

  // The DB is the sole source of truth for session tokens. There used to be a fallback here that
  // called Spotify's /v1/me on a miss and re-synced the doc — meaningless now that a session token
  // is never a Spotify token, and it made login latency depend on Spotify being up.
  const user = await User.findOne({ accessToken: token });
  if (!user) return null;
  tokenCache.set(token, { user, expiresAt: Date.now() + 4 * 60 * 1000 });
  return user;
}

export async function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    try {
      const user = await resolveUser(token);
      if (user) req.user = user;
    } catch {}
  }
  next();
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) { res.status(401).json({ error: 'Missing token' }); return; }

  try {
    const user = await resolveUser(token);
    if (!user) { res.status(401).json({ error: 'Invalid token' }); return; }
    req.user = user;
    next();
  } catch {
    res.status(500).json({ error: 'Auth check failed' });
  }
}
