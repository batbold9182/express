import { Router, Request, Response } from 'express';
import { User } from '../models/User';

const router = Router();
const usedCodes = new Map<string, number>(); // code -> timestamp
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [code, ts] of usedCodes) if (ts < cutoff) usedCodes.delete(code);
}, 15 * 60 * 1000);

router.get('/login', (req: Request, res: Response) => {
  const redirectBase = req.query.redirect as string | undefined;
  const params = new URLSearchParams({
    client_id: process.env.CLIENT_ID!,
    response_type: 'code',
    redirect_uri: process.env.REDIRECT_URI!,
    scope: 'user-read-private user-read-email user-top-read user-read-currently-playing user-read-playback-state',
    ...(redirectBase ? { state: Buffer.from(redirectBase).toString('base64') } : {}),
  });
  res.redirect(`https://accounts.spotify.com/authorize?${params}`);
});

router.get('/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;
  const state = req.query.state as string | undefined;
  const frontendBase = state
    ? Buffer.from(state, 'base64').toString('utf8')
    : process.env.FRONTEND_BASE ?? `http://${process.env.IP_ADDRESS}:8081`;

  if (!code) { res.status(400).json({ error: 'Missing code' }); return; }
  if (usedCodes.has(code)) { res.status(400).json({ error: 'Code already used' }); return; }
  usedCodes.set(code, Date.now());

  // Exchange code for tokens
  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.REDIRECT_URI!,
      client_id: process.env.CLIENT_ID!,
      client_secret: process.env.CLIENT_SECRET!,
    }),
  });

  const tokens = await tokenRes.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  if (!tokens.access_token) {
    console.error('Token exchange failed:', tokens);
    res.status(500).json({ error: 'Token exchange failed', detail: tokens });
    return;
  }

  // Fetch Spotify user profile — retry up to 3x, respecting Retry-After header
  let profileRes: globalThis.Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    profileRes = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (profileRes.status !== 429) break;
    const retryAfter = parseInt(profileRes.headers.get('Retry-After') ?? '5') * 1000;
    console.log(`Spotify rate limited. Waiting ${retryAfter}ms before retry ${attempt + 1}...`);
    await new Promise(r => setTimeout(r, retryAfter));
  }

  let spotifyId = '';
  if (!profileRes || !profileRes.ok) {
    console.error('❌ Spotify /me failed:', profileRes?.status, await profileRes?.text());
    res.redirect(`${frontendBase}/auth/login`);
    return;
  } else {
    try {
      const profile = await profileRes.json() as { id: string; display_name: string; email: string; images: { url: string }[] };
      spotifyId = profile.id;
      await User.findOneAndUpdate(
        { spotifyId: profile.id },
        {
          spotifyId:      profile.id,
          displayName:    profile.display_name,
          email:          profile.email,
          avatarUrl:      profile.images?.[0]?.url ?? '',
          accessToken:    tokens.access_token,
          refreshToken:   tokens.refresh_token,
          tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          updatedAt:      new Date(),
        },
        { upsert: true, returnDocument: 'after' }
      );
    } catch (err) {
      console.error('❌ Could not save user to DB:', err);
    }
  }

  res.redirect(`${frontendBase}/auth/success?access_token=${tokens.access_token}&spotify_id=${spotifyId}`);
});

router.post('/refresh', async (req: Request, res: Response) => {
  const { spotifyId } = req.body;
  if (!spotifyId) { res.status(400).json({ error: 'Missing spotifyId' }); return; }

  const user = await User.findOne({ spotifyId });
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: user.refreshToken,
      client_id:     process.env.CLIENT_ID!,
      client_secret: process.env.CLIENT_SECRET!,
    }),
  });

  const tokens = await tokenRes.json() as { access_token: string; expires_in: number };

  await User.findOneAndUpdate(
    { spotifyId },
    {
      accessToken:    tokens.access_token,
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      updatedAt:      new Date(),
    }
  );

  res.json({ access_token: tokens.access_token });
});

export default router;
