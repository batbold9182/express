// The web half of linking a Spotify account (plan.md step 4; the backend half is POST /auth/spotify/link,
// the relay GET /auth/callback and POST /auth/spotify/link/complete). Pure (no imports, no `import.meta`),
// so the root Jest suite can load it.
//
// The flow: /me asks the backend to start a link and gets Spotify's authorize address, whose `state` is a
// single-use nonce; the nonce is kept in this tab's sessionStorage and the browser goes to Spotify. Spotify
// returns to the backend, which relays code, state and error to /auth/callback here. That page completes
// the link only if `state` is the nonce this tab saved — a callback someone else started (a link sent to a
// victim) is refused without calling the API. The page never reads a session token from the address.

/** Where the nonce waits while the browser is at Spotify. sessionStorage: this tab only, gone when it closes. */
export const LINK_STATE_KEY = 'spotify_link_state';

const SPOTIFY_AUTHORIZE = 'https://accounts.spotify.com/authorize';

/**
 * The nonce in the authorize address the backend returned, or null if the address is not Spotify's
 * authorize page or carries no state — then the browser is not sent anywhere.
 */
export function linkStateFrom(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  if (`${u.origin}${u.pathname}` !== SPOTIFY_AUTHORIZE) return null;
  const state = u.searchParams.get('state');
  return state ? state : null;
}

/** What /auth/callback does with the address it was opened at. */
export type LinkCallback =
  | { kind: 'complete'; code: string; state: string }
  | { kind: 'fail'; message: string };

const MESSAGES: Record<string, string> = {
  link_expired:  'That Spotify link expired. Try Connect Spotify again.',
  access_denied: 'Spotify connection cancelled.',
};

/**
 * Decides from the callback's query string and the nonce this tab saved. Only a matching state with a
 * code completes; an error, a missing piece or a state this tab did not start is a failure message.
 */
export function readLinkCallback(search: string, savedState: string | null): LinkCallback {
  const q = new URLSearchParams(search);
  const error = q.get('error');
  if (error) return { kind: 'fail', message: MESSAGES[error] ?? "Spotify couldn't connect your account. Try again." };

  const state = q.get('state');
  const code  = q.get('code');
  if (!state || !code || !savedState || state !== savedState) {
    return { kind: 'fail', message: "That Spotify link wasn't started from this tab. Try Connect Spotify again." };
  }
  return { kind: 'complete', code, state };
}
