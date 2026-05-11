import { Router, Request, Response } from 'express';
import { User } from '../models/User';

const router = Router();
const usedCodes = new Set<string>();

router.get('/login', (_req: Request, res: Response) => {
  const params = new URLSearchParams({
    client_id: process.env.CLIENT_ID!,
    response_type: 'code',
    redirect_uri: process.env.REDIRECT_URI!,
    scope: 'user-read-private user-read-email user-top-read user-read-currently-playing user-read-playback-state',
  });
  res.redirect(`https://accounts.spotify.com/authorize?${params}`);
});

router.get('/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;
  if (!code) { res.status(400).json({ error: 'Missing code' }); return; }
  if (usedCodes.has(code)) { res.status(400).json({ error: 'Code already used' }); return; }
  usedCodes.add(code);

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

  // Fetch Spotify user profile
  const profileRes = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  let spotifyId = '';
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

  res.redirect(`http://${process.env.IP_ADDRESS}:8081/auth/success?access_token=${tokens.access_token}&spotify_id=${spotifyId}`);
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
