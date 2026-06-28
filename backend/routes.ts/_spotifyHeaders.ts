import { Request } from 'express';

// App-level Spotify token (Client Credentials) — used for email users who have
// no personal Spotify token. Refreshed every 50 min; Spotify tokens last 60 min.
let _appToken: string | null = null;
let _appExpiry = 0;

async function refreshAppToken() {
  try {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'client_credentials',
        client_id:     process.env.CLIENT_ID!,
        client_secret: process.env.CLIENT_SECRET!,
      }),
    });
    const data = await res.json() as { access_token: string; expires_in: number };
    _appToken  = data.access_token;
    _appExpiry = Date.now() + (data.expires_in - 60) * 1000;
  } catch (e) {
    console.error('[spotify] client-credentials refresh failed:', e);
  }
}

// Fetch once immediately, then every 50 min
void refreshAppToken();
setInterval(() => { void refreshAppToken(); }, 50 * 60 * 1000);

export function isEmailUser(req: Request): boolean {
  return ((req as any).user?.spotifyId as string | undefined)?.startsWith('email:') ?? false;
}

export function spotifyHeaders(req: Request): { Authorization: string } {
  if (isEmailUser(req) && _appToken) {
    return { Authorization: `Bearer ${_appToken}` };
  }
  return { Authorization: `Bearer ${req.headers.authorization?.split(' ')[1]}` };
}
