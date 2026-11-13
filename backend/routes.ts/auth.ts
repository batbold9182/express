import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { LinkNonce, LINK_NONCE_TTL_MS } from '../models/LinkNonce';
import { sendPasswordReset } from '../lib/mailer';
import { webOrigins } from '../lib/webOrigins';
import { requireAuth, AuthRequest, invalidateToken } from '../middleware/auth';

const router = Router();

// A non-empty string, nothing else. A JSON body can carry `{"$ne": null}` or `{"$regex": "^a"}` where a string
// belongs, and these fields go straight into Mongo filters (security H4 / H4b). Wrong types get the same 400 as missing.
const isText = (v: unknown): v is string => typeof v === 'string' && v !== '';

// ---------------------------------------------------------------------------
// Connect Spotify. Spotify is a feature of an account, not a way to sign in.
//
// The rule: a link is completed by a request that carries the session of the account being linked, never by the
// bare callback. So: a signed-in start makes a single-use nonce; Spotify's redirect lands on a relay that touches
// no account; the web page then finishes the link with its session token.
// ---------------------------------------------------------------------------

const SPOTIFY_SCOPES = 'user-read-private user-top-read user-read-currently-playing user-read-playback-state';

const hashNonce = (nonce: string) => crypto.createHash('sha256').update(nonce).digest('hex');
const nonceCutoff = () => new Date(Date.now() - LINK_NONCE_TTL_MS);

// POST /auth/spotify/link — start a link for the signed-in user. Returns Spotify's authorize URL.
router.post('/spotify/link', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    // Where the browser returns afterwards is this request's Origin, so it must be one of ours, exactly.
    const allowed = webOrigins();
    if (allowed.length === 0) { res.status(503).json({ error: 'Spotify linking is not configured' }); return; }
    const origin = req.headers.origin;
    if (typeof origin !== 'string' || !allowed.includes(origin)) {
      res.status(403).json({ error: 'Origin not allowed' }); return;
    }

    const nonce = crypto.randomBytes(32).toString('base64url');
    await LinkNonce.deleteMany({ userId: req.user!._id }); // one link outstanding per user
    await LinkNonce.create({ nonceHash: hashNonce(nonce), userId: req.user!._id, origin });

    const params = new URLSearchParams({
      client_id:     process.env.CLIENT_ID!,
      response_type: 'code',
      redirect_uri:  process.env.REDIRECT_URI!,
      scope:         SPOTIFY_SCOPES,
      state:         nonce,
      show_dialog:   'true', // the person picks the Spotify account on purpose
    });
    res.json({ url: `https://accounts.spotify.com/authorize?${params}` });
  } catch {
    res.status(500).json({ error: 'Failed to start Spotify link' });
  }
});

// GET /auth/callback — where Spotify sends the browser. A relay: it reads the nonce's stored origin and passes
// code, state and error on to that page. It changes no account, exchanges nothing and logs no query string.
router.get('/callback', async (req: Request, res: Response) => {
  res.setHeader('Referrer-Policy', 'no-referrer');
  const { code, state, error } = req.query;

  try {
    const known = isText(state)
      ? await LinkNonce.findOne({ nonceHash: hashNonce(state), createdAt: { $gt: nonceCutoff() } }).select('origin')
      : null;

    // Unknown, expired or malformed state (an old link still in flight, or attacker input): a fixed target,
    // never anything the request names.
    if (!known || !webOrigins().includes(known.origin)) {
      const fallback = webOrigins()[0];
      if (!fallback) { res.status(400).json({ error: 'Link expired' }); return; }
      res.redirect(`${fallback}/auth/callback?error=link_expired`);
      return;
    }

    const params = new URLSearchParams({ state: state as string });
    if (isText(code))  params.set('code', code);
    if (isText(error)) params.set('error', error);
    res.redirect(`${known.origin}/auth/callback?${params}`);
  } catch {
    res.status(500).json({ error: 'Link failed' });
  }
});

// POST /auth/spotify/link/complete { code, state } — the authenticated half. The nonce must be unexpired, unused
// and the caller's own; only then is the code exchanged. Every refusal is the same 400, so it is no oracle.
router.post('/spotify/link/complete', requireAuth, async (req: AuthRequest, res: Response) => {
  const { code, state } = (req.body ?? {}) as { code?: unknown; state?: unknown };
  if (!isText(code) || !isText(state)) { res.status(400).json({ error: 'Invalid or expired link' }); return; }

  try {
    // Atomic: a delete that matches, so two requests racing for one nonce cannot both win. With userId in the
    // filter another user can neither use nor burn it.
    const nonce = await LinkNonce.findOneAndDelete({
      nonceHash: hashNonce(state),
      userId:    req.user!._id,
      createdAt: { $gt: nonceCutoff() },
    });
    if (!nonce) { res.status(400).json({ error: 'Invalid or expired link' }); return; }

    // The same redirect_uri the authorize request used (the backend callback, not the web page).
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'authorization_code',
        code,
        redirect_uri:  process.env.REDIRECT_URI!,
        client_id:     process.env.CLIENT_ID!,
        client_secret: process.env.CLIENT_SECRET!,
      }),
    });
    const tokens = await tokenRes.json().catch(() => ({})) as {
      access_token?: string; refresh_token?: string; expires_in?: number; error?: string;
    };
    if (!tokenRes.ok || !tokens.access_token) {
      // Spotify's body can name the client or the grant: log the code of the error, hand nothing on.
      console.error('[spotify] link: token exchange failed:', tokenRes.status, tokens.error);
      res.status(502).json({ error: 'Spotify did not accept the link, try again' }); return;
    }

    // Spotify rate-limits /me often: up to 3 tries, waiting what it asks but never more than 2s a time.
    let profileRes: globalThis.Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      profileRes = await fetch('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (profileRes.status !== 429) break;
      const retryAfter = Math.min(Number(profileRes.headers.get('Retry-After')) || 1, 2) * 1000;
      await new Promise(r => setTimeout(r, retryAfter));
    }
    if (!profileRes || !profileRes.ok) {
      console.error('[spotify] link: /me failed:', profileRes?.status);
      res.status(502).json({ error: 'Spotify did not accept the link, try again' }); return;
    }
    const profile = await profileRes.json() as { id?: string; images?: { url: string }[] };
    if (!isText(profile.id)) { res.status(502).json({ error: 'Spotify did not accept the link, try again' }); return; }

    // realSpotifyId is sparse+unique, so any previous owner of this Spotify identity has to release it before
    // we can claim it. Their account and reviews survive — they just lose the Spotify link, exactly as
    // DELETE /users/me/spotify would leave them. Read their session first, to evict their cached copy after.
    const me = req.user!;
    const previous = await User.findOne({ realSpotifyId: profile.id, _id: { $ne: me._id } }).select('accessToken');
    if (previous) {
      await User.updateOne(
        { _id: previous._id },
        {
          $unset: { realSpotifyId: '', spotifyAccessToken: '', spotifyTokenExpiresAt: '' },
          $set:   { refreshToken: '', updatedAt: new Date() },
        },
      );
      invalidateToken(previous.accessToken as string);
    }

    // Spotify credentials only. `spotifyId` (the public handle) and `accessToken` (the app session) are
    // untouched: the handle stays stable and the browser keeps the session it already holds.
    await User.updateOne(
      { _id: me._id },
      {
        $set: {
          realSpotifyId:         profile.id,
          spotifyAccessToken:    tokens.access_token,
          spotifyTokenExpiresAt: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000),
          refreshToken:          tokens.refresh_token ?? '',
          avatarUrl:             profile.images?.[0]?.url ?? me.avatarUrl,
          updatedAt:             new Date(),
        },
      },
    );
    // The middleware hands out the same user object for 4 minutes, and spotifyHeaders() nulls its Spotify token
    // when a refresh fails. Evict it, or a reconnect looks like "no Spotify" for minutes.
    invalidateToken(me.accessToken as string);

    res.json({ linked: true });
  } catch (err) {
    console.error('[spotify] link: could not save:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Failed to link Spotify' });
  }
});

// Reset tokens are stored as a SHA-256 hash. The plaintext exists only in the email we send,
// so leaking a user document no longer yields a redeemable token.
const hashResetToken = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

// One person, one spelling (D16): `Alice@X` and ` alice@x ` are the same account. Dots and +tags are NOT folded: at other
// providers those are different people. Returns '' for anything that is not a usable email, so callers answer 400.
export const normalizeEmail = (v: unknown): string => (isText(v) ? v.trim().toLowerCase() : '');

router.post('/forgot-password', async (req: Request, res: Response) => {
  const email = normalizeEmail(req.body?.email);
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
  const { resetToken, newPassword } = req.body as { resetToken?: unknown; newPassword?: unknown };
  const email = normalizeEmail(req.body?.email);
  if (!email || !isText(resetToken) || !isText(newPassword)) {
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
  const { displayName, password } = req.body as { displayName?: unknown; password?: unknown };
  const email = normalizeEmail(req.body?.email);
  if (!email || !isText(displayName) || !isText(password)) {
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
  const { password } = req.body as { password?: unknown };
  const email = normalizeEmail(req.body?.email);
  if (!email || !isText(password)) {
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
