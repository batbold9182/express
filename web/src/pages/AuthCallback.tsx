import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spinner } from '../components/Spinner';
import { toast } from '../lib/toast';
import { LINK_STATE_KEY, readLinkCallback } from '../lib/spotifyLink';
import { useCompleteSpotifyLink } from '../queries/users';

/**
 * Where the backend's relay sends the browser after Spotify: `?state=…&code=…`, or `?error=…`. It
 * completes a Spotify link this tab started on /me (see lib/spotifyLink.ts) and never signs anyone in:
 * there is no session in the address any more, so a link someone else built cannot log a victim in.
 */
export default function AuthCallback() {
  const nav = useNavigate();
  const complete = useCompleteSpotifyLink();
  const { mutate } = complete;
  const started = useRef(false);   // the code is single-use: StrictMode's second run must not send it again

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const result = readLinkCallback(window.location.search, sessionStorage.getItem(LINK_STATE_KEY));
    // The nonce is single-use and the code must not linger in the address bar or history.
    sessionStorage.removeItem(LINK_STATE_KEY);
    window.history.replaceState(window.history.state, '', window.location.pathname);

    if (result.kind === 'fail') {
      toast(result.message);
      nav('/me', { replace: true });
      return;
    }
    // A 400 / 502 arrives as a toast with the server's message (the mutation default); either way, back to /me.
    mutate({ code: result.code, state: result.state }, {
      onSuccess: () => toast('Spotify connected'),
      onSettled: () => nav('/me', { replace: true }),
    });
  }, [mutate, nav]);

  return (
    <div className="flex items-center justify-center h-screen flex-col gap-4">
      <Spinner />
      <p className="text-fg3 text-[14px]">Connecting Spotify…</p>
    </div>
  );
}
