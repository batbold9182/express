import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/auth';
import { Spinner } from '../components/Spinner';

export default function AuthCallback() {
  const { saveToken } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token     = params.get('access_token');
    const spotifyId = params.get('spotify_id');
    const linked    = params.get('linked');
    // Set by "Connect Spotify" on /me so linking returns you to your profile.
    const next = sessionStorage.getItem('post_auth_redirect');
    sessionStorage.removeItem('post_auth_redirect');

    if (token && spotifyId) {
      saveToken(token, spotifyId);
      nav(next ?? '/', { replace: true });
    } else if (linked) {
      // Connect-Spotify return. The session we already hold is still valid — the backend
      // stopped issuing a token here rather than round-tripping one through the URL bar.
      nav(next ?? '/me', { replace: true });
    } else {
      nav('/login', { replace: true });
    }
  }, []);

  return (
    <div className="flex items-center justify-center h-screen flex-col gap-4">
      <Spinner />
      <p className="text-fg3 text-[14px]">Signing you in…</p>
    </div>
  );
}
