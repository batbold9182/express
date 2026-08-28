import { Request } from 'express';
import { User } from '../models/User';

// ---------------------------------------------------------------------------
// App-level Spotify token (Client Credentials). One shared token for the whole
// server, used for metadata on behalf of users with no personal Spotify link.
// ---------------------------------------------------------------------------

let _appToken: string | null = null;
let _appExpiry = 0;
let _appRefreshing: Promise<void> | null = null;
let _appNextRetry = 0; // don't hammer the token endpoint while it is failing

const APP_RETRY_BACKOFF_MS = 30_000;

async function refreshAppToken(): Promise<void> {
  if (_appRefreshing) return _appRefreshing;          // collapse concurrent callers
  if (Date.now() < _appNextRetry) return;             // still backing off

  _appRefreshing = (async () => {
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

      // Critical: bail before touching _appToken. This used to assign
      // `data.access_token` unconditionally, so any non-200 — a single transient
      // 429 — overwrote a perfectly good token with `undefined` and broke metadata
      // for every user until the next successful refresh.
      if (!res.ok) {
        _appNextRetry = Date.now() + APP_RETRY_BACKOFF_MS;
        console.error('[spotify] client-credentials refresh failed:', res.status, await res.text());
        return;
      }

      const data = await res.json() as { access_token?: string; expires_in?: number };
      if (!data.access_token || !data.expires_in) {
        _appNextRetry = Date.now() + APP_RETRY_BACKOFF_MS;
        console.error('[spotify] client-credentials refresh returned no token:', data);
        return;
      }

      _appToken     = data.access_token;
      _appExpiry    = Date.now() + (data.expires_in - 60) * 1000;
      _appNextRetry = 0;
    } catch (e) {
      _appNextRetry = Date.now() + APP_RETRY_BACKOFF_MS;
      console.error('[spotify] client-credentials refresh failed:', e);
    } finally {
      _appRefreshing = null;
    }
  })();

  return _appRefreshing;
}

// Delay first fetch by one tick so dotenv.config() in server.ts runs first
setTimeout(() => void refreshAppToken(), 0);
setInterval(() => { void refreshAppToken(); }, 50 * 60 * 1000);

// ---------------------------------------------------------------------------
// Per-user Spotify tokens
// ---------------------------------------------------------------------------

/**
 * Does this request's user have their own Spotify token?
 *
 * Reads the token, not the `spotifyId` prefix. That decoupling is what lets `spotifyId` stay
 * stable as a public profile handle instead of rotating when Spotify is connected.
 */
export function hasPersonalSpotify(req: Request): boolean {
  return !!(req as any).user?.spotifyAccessToken;
}

// One in-flight refresh per user. A page firing several proxy calls at once would otherwise
// start a refresh per call and let the last write win, invalidating the others' tokens.
const _refreshing = new Map<string, Promise<string | null>>();

// Users whose refresh failed for a *transient* reason. Without this, a user polling
// NowPlaying every 30s generates a doomed token request every 30s, forever.
const _refreshCooldown = new Map<string, number>();
const USER_RETRY_BACKOFF_MS = 5 * 60 * 1000;

/** Exchange the stored refreshToken for a new Spotify access token and persist it. */
async function refreshUserToken(userId: string, refreshToken: string): Promise<string | null> {
  const existing = _refreshing.get(userId);
  if (existing) return existing;

  const cooldownUntil = _refreshCooldown.get(userId) ?? 0;
  if (Date.now() < cooldownUntil) return null;

  const promise = (async () => {
    try {
      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type:    'refresh_token',
          refresh_token: refreshToken,
          client_id:     process.env.CLIENT_ID!,
          client_secret: process.env.CLIENT_SECRET!,
        }),
      });
      const data = await res.json().catch(() => ({})) as {
        access_token?: string; expires_in?: number; refresh_token?: string; error?: string;
      };

      // invalid_grant means the refresh token is dead for good — the user revoked the app, or
      // was dropped from the Spotify dev allowlist. Retrying can never succeed, so unlink the
      // account instead of asking Spotify the same question on every future request.
      if (data.error === 'invalid_grant') {
        console.warn(`[spotify] refresh token revoked for user ${userId} — unlinking`);
        await User.updateOne({ _id: userId }, {
          $unset: { realSpotifyId: '', spotifyAccessToken: '', spotifyTokenExpiresAt: '' },
          $set:   { refreshToken: '', updatedAt: new Date() },
        });
        _refreshCooldown.delete(userId);
        return null;
      }

      if (!res.ok || !data.access_token || !data.expires_in) {
        // Transient: rate limit, outage, network. Back off rather than retry per request.
        _refreshCooldown.set(userId, Date.now() + USER_RETRY_BACKOFF_MS);
        console.error('[spotify] user token refresh failed:', res.status, data);
        return null;
      }

      await User.updateOne({ _id: userId }, {
        $set: {
          spotifyAccessToken:    data.access_token,
          spotifyTokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
          // Spotify occasionally rotates the refresh token; keep the old one when it doesn't.
          ...(data.refresh_token ? { refreshToken: data.refresh_token } : {}),
          updatedAt: new Date(),
        },
      });
      _refreshCooldown.delete(userId);
      return data.access_token;
    } catch (e) {
      _refreshCooldown.set(userId, Date.now() + USER_RETRY_BACKOFF_MS);
      console.error('[spotify] user token refresh failed:', e);
      return null;
    } finally {
      _refreshing.delete(userId);
    }
  })();

  _refreshing.set(userId, promise);
  return promise;
}

/**
 * Authorization header for a Spotify API call.
 *
 * Prefers the user's own token, refreshing it server-side when expired. Falls back to the
 * app-level Client Credentials token, which covers metadata for everyone without a linked
 * account. The client's own Authorization header is never forwarded — it is an app session
 * token and means nothing to Spotify.
 */
export async function spotifyHeaders(req: Request): Promise<{ Authorization: string }> {
  const user = (req as any).user;

  if (user?.spotifyAccessToken) {
    const expiresAt = user.spotifyTokenExpiresAt ? new Date(user.spotifyTokenExpiresAt).getTime() : 0;
    // 30s of slack so a token that expires mid-flight doesn't 401.
    if (expiresAt - 30_000 > Date.now()) {
      return { Authorization: `Bearer ${user.spotifyAccessToken}` };
    }
    if (user.refreshToken) {
      const fresh = await refreshUserToken(String(user._id), user.refreshToken);
      if (fresh) {
        user.spotifyAccessToken = fresh; // keep the cached req.user in step
        return { Authorization: `Bearer ${fresh}` };
      }
      // Failed. Clear the cached copy too — the auth middleware holds req.user for 4 minutes,
      // and without this every request in that window re-enters the branch above.
      user.spotifyAccessToken = undefined;
      user.refreshToken = '';
    }
    // Fall through to Client Credentials rather than sending a token we know is dead.
  }

  if (!_appToken || _appExpiry < Date.now()) await refreshAppToken();
  return { Authorization: `Bearer ${_appToken ?? ''}` };
}
