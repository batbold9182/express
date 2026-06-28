import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/auth';

export default function AuthCallback() {
  const { saveToken } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token     = params.get('access_token');
    const spotifyId = params.get('spotify_id');
    if (token && spotifyId) {
      saveToken(token, spotifyId);
      nav('/', { replace: true });
    } else {
      nav('/login', { replace: true });
    }
  }, []);

  return (
    <div className="flex items-center justify-center h-screen flex-col gap-4">
      <div className="w-8 h-8 border-2 border-violet/30 border-t-violet rounded-full animate-spin" />
      <p className="text-fg3 text-[14px]">Signing you in…</p>
    </div>
  );
}
