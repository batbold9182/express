import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { sendPasswordReset } from '../lib/mailer';
import { invalidateToken } from '../middleware/auth';

const router = Router();
const usedCodes = new Map<string, number>(); // code -> timestamp
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [code, ts] of usedCodes) if (ts < cutoff) usedCodes.delete(code);
}, 15 * 60 * 1000);

router.get('/login', (req: Request, res: Response) => {
  const redirectBase = req.query.redirect  as string | undefined;
  const linkId       = req.query.linkId    as string | undefined; // email:<uuid> spotifyId — stable, never rotates
  const linkToken    = req.query.linkToken as string | undefined; // legacy fallback (mobile)
  const statePayload = redirectBase || linkId || linkToken
    ? Buffer.from(JSON.stringify({ redirect: redirectBase, linkId, linkToken })).toString('base64')
    : undefined;
  const params = new URLSearchParams({
    client_id: process.env.CLIENT_ID!,
    response_type: 'code',
    redirect_uri: process.env.REDIRECT_URI!,
    scope: 'user-read-private user-read-email user-top-read user-read-currently-playing user-read-playback-state',
    ...(statePayload ? { state: statePayload } : {}),
  });
  res.redirect(`https://accounts.spotify.com/authorize?${params}`);
});

router.get('/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;
  const state = req.query.state as string | undefined;
  const fallbackBase = process.env.FRONTEND_BASE ?? `http://${process.env.IP_ADDRESS}:8081`;

  let successURL = `${fallbackBase}/auth/success`;
  let linkId: string | undefined;
  let linkToken: string | undefined;
  if (state) {
    const raw = Buffer.from(state, 'base64').toString('utf8');
    try {
      const parsed = JSON.parse(raw) as { redirect?: string; linkId?: string; linkToken?: string };
      if (parsed.redirect) successURL = parsed.redirect;
      linkId    = parsed.linkId    || undefined; // empty string → undefined (falsy guard)
      linkToken = parsed.linkToken || undefined;
    } catch {
      // Legacy format: plain URL string (mobile deep-link)
      successURL = raw;
    }
  }

  const loginURL = successURL.replace('auth/success', 'auth/login');

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

  // Set by the fresh-login branch only. The link branch leaves them null: that user already
  // holds a valid app session, so there is nothing to issue.
  let sessionToken: string | null = null;
  let sessionExpiresAt = 0;
  let publicSpotifyId = '';

  if (!profileRes || !profileRes.ok) {
    console.error('❌ Spotify /me failed:', profileRes?.status, await profileRes?.text());
    res.redirect(loginURL);
    return;
  } else {
    try {
      const profile = await profileRes.json() as { id: string; display_name: string; email: string; images: { url: string }[] };

      // Spotify credentials only. `spotifyId` (the public handle) and `accessToken` (the app
      // session) are deliberately absent — conflating them with these is the bug this phase fixes.
      const spotifyCredentials = {
        realSpotifyId:         profile.id,
        spotifyAccessToken:    tokens.access_token,
        spotifyTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        refreshToken:          tokens.refresh_token,
        updatedAt:             new Date(),
      };

      // realSpotifyId is sparse+unique, so any previous owner of this Spotify identity has to
      // release it before we can claim it. Their account and reviews survive — they just lose
      // the Spotify link, exactly as DELETE /users/me/spotify would leave them.
      const releasePreviousOwner = (keepId: unknown) => User.updateOne(
        { realSpotifyId: profile.id, _id: { $ne: keepId } },
        {
          $unset: { realSpotifyId: '', spotifyAccessToken: '', spotifyTokenExpiresAt: '' },
          $set:   { refreshToken: '', updatedAt: new Date() },
        },
      );

      if (linkId || linkToken) {
        // "Connect Spotify" from an active session — find by the stable spotifyId (preferred)
        // or by accessToken as legacy fallback (mobile).
        const linkedUser = linkId
          ? await User.findOne({ spotifyId: linkId })
          : await User.findOne({ accessToken: linkToken });
        if (linkedUser) {
          await releasePreviousOwner(linkedUser._id);
          await User.updateOne(
            { _id: linkedUser._id },
            { $set: { ...spotifyCredentials, avatarUrl: profile.images?.[0]?.url ?? linkedUser.avatarUrl } },
          );
          // spotifyId and accessToken untouched: the profile handle stays stable and the client
          // keeps the session it already holds.
          //
          // Evict the cached user anyway. The middleware hands out the same object for 4 minutes,
          // and spotifyHeaders() nulls `spotifyAccessToken` on it when a refresh fails. Without
          // this, someone who reconnects after a revoked token keeps hitting a cached copy that
          // says "no Spotify" — Now Playing and top artists stay dead for minutes after a
          // successful reconnect, then start working on their own.
          invalidateToken(linkedUser.accessToken as string);
          publicSpotifyId = linkedUser.spotifyId as string;
        }
      } else {
        // Fresh Spotify login (the mobile path). The client has no session yet, and the Spotify
        // token is no longer usable as one, so this branch mints an app session token.
        sessionToken     = crypto.randomBytes(40).toString('hex');
        sessionExpiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
        const session = { accessToken: sessionToken, tokenExpiresAt: new Date(sessionExpiresAt) };

        // Match on either field: realSpotifyId is authoritative, but accounts created before this
        // split — or before the backfill runs — still carry the Spotify id in spotifyId.
        const existing = await User.findOne({ email: profile.email })
          ?? await User.findOne({ $or: [{ realSpotifyId: profile.id }, { spotifyId: profile.id }] });

        if (existing) {
          await releasePreviousOwner(existing._id);
          await User.updateOne(
            { _id: existing._id },
            { $set: { ...spotifyCredentials, ...session, avatarUrl: profile.images?.[0]?.url ?? existing.avatarUrl } },
          );
          // This branch replaces accessToken, so evict the old one — otherwise it keeps
          // resolving from the 4-minute cache after being rotated away.
          invalidateToken(existing.accessToken as string);
          publicSpotifyId = existing.spotifyId as string;
        } else {
          // Brand-new account. No prior handle exists, so the Spotify id becomes the handle —
          // and from here it never changes again.
          await User.create({
            ...spotifyCredentials,
            ...session,
            spotifyId:   profile.id,
            displayName: profile.display_name,
            email:       profile.email,
            avatarUrl:   profile.images?.[0]?.url ?? '',
          });
          publicSpotifyId = profile.id;
        }
      }
    } catch (err) {
      console.error('❌ Could not save user to DB:', err);
    }
  }

  if (sessionToken) {
    res.redirect(`${successURL}?access_token=${sessionToken}&spotify_id=${publicSpotifyId}&expires_at=${sessionExpiresAt}`);
  } else {
    // Link flow. The client keeps the session it already has — re-emitting a token into a URL
    // and the browser's history is precisely the coupling this phase removes.
    res.redirect(`${successURL}?linked=1`);
  }
});

// Reset tokens are stored as a SHA-256 hash. The plaintext exists only in the email we send,
// so leaking a user document no longer yields a redeemable token.
const hashResetToken = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

router.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body as { email?: string };
  if (!email) { res.status(400).json({ error: 'Missing email' }); return; }

  const user = await User.findOne({ email });
  // Always return 200 — don't reveal whether the email exists
  if (!user) { res.json({ message: 'If that email exists, a reset link has been sent' }); return; }

  const resetToken = crypto.randomBytes(20).toString('hex');
  const resetExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  await User.findOneAndUpdate(
    { email },
    { resetToken: hashResetToken(resetToken), resetExpires }
  );

  // The plaintext token goes to the inbox and nowhere else.
  sendPasswordReset(email, resetToken).catch(err => console.error('Failed to send reset email:', err));
  res.json({ message: 'If that email exists, a reset link has been sent' });
});

router.post('/reset-password', async (req: Request, res: Response) => {
  const { email, resetToken, newPassword } = req.body as { email?: string; resetToken?: string; newPassword?: string };
  if (!email || !resetToken || !newPassword) {
    res.status(400).json({ error: 'email, resetToken, and newPassword are required' }); return;
  }
  if (newPassword.length < 6) {
    res.status(400).json({ error: 'New password must be at least 6 characters' }); return;
  }

  const user = await User.findOne({ email });
  if (!user || user.resetToken !== hashResetToken(resetToken) || !user.resetExpires || user.resetExpires < new Date()) {
    res.status(400).json({ error: 'Invalid or expired reset token' }); return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await User.findOneAndUpdate(
    { email },
    { $set: { passwordHash }, $unset: { resetToken: '', resetExpires: '' } }
  );

  res.json({ message: 'Password has been reset successfully' });
});

router.post('/register', async (req: Request, res: Response) => {
  const { email, displayName, password } = req.body as { email?: string; displayName?: string; password?: string };
  if (!email || !displayName || !password) {
    res.status(400).json({ error: 'email, displayName, and password are required' }); return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' }); return;
  }

  const existing = await User.findOne({ email });
  if (existing) { res.status(409).json({ error: 'Email already in use' }); return; }

  const passwordHash = await bcrypt.hash(password, 10);
  const spotifyId = `email:${crypto.randomUUID()}`;
  const accessToken = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await User.create({
    spotifyId, displayName, email,
    avatarUrl: '', accessToken, refreshToken: '',
    tokenExpiresAt: expiresAt, passwordHash,
  });

  res.json({ access_token: accessToken, spotify_id: spotifyId, expires_at: expiresAt.getTime() });
});

router.post('/email-login', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' }); return;
  }

  const user = await User.findOne({ email });
  if (!user?.passwordHash) {
    res.status(401).json({ error: 'Invalid email or password' }); return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) { res.status(401).json({ error: 'Invalid email or password' }); return; }

  // Always an app session token, for linked and unlinked accounts alike. This used to refresh
  // Spotify and return *that* token whenever the account had a refreshToken, which re-created the
  // session/Spotify coupling on every sign-in. Spotify refresh is now lazy, in spotifyHeaders().
  const accessToken = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await User.findOneAndUpdate(
    { email },
    { accessToken, tokenExpiresAt: expiresAt, updatedAt: new Date() }
  );

  res.json({ access_token: accessToken, spotify_id: user.spotifyId, expires_at: expiresAt.getTime() });
});

router.post('/refresh', async (req: Request, res: Response) => {
  // Identify the caller by the token they already hold, never by the spotifyId in the body.
  // spotifyId is public — it ships in most API responses — so trusting it let anyone mint a
  // fresh session for any account. The presented token may be expired; it only has to still be
  // the one on record, which is what proves possession.
  const currentToken = req.headers.authorization?.split(' ')[1];
  if (!currentToken) { res.status(401).json({ error: 'Missing token' }); return; }

  const user = await User.findOne({ accessToken: currentToken });
  if (!user) { res.status(401).json({ error: 'Invalid token' }); return; }
  // One path for everyone: a fresh app session token. The Spotify branch that used to live here
  // returned a Spotify token as the session, which is the coupling this phase removes — Spotify
  // credentials are now refreshed lazily and server-side in spotifyHeaders().
  const accessToken = crypto.randomBytes(40).toString('hex');
  const expiresIn = 30 * 24 * 60 * 60;

  await User.updateOne(
    { _id: user._id },
    { $set: { accessToken, tokenExpiresAt: new Date(Date.now() + expiresIn * 1000), updatedAt: new Date() } },
  );

  invalidateToken(currentToken); // else the replaced token keeps resolving from the 4-min cache
  res.json({ access_token: accessToken, expires_in: expiresIn });
});

export default router;
