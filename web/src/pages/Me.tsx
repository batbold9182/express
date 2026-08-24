import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { ProfileReviews } from '../components/ProfileReviews';
import { api, type ApiError } from '../lib/api';
import { useAuth } from '../context/auth';

type SpotifyUser = { display_name: string; id: string; images: { url: string }[] };
type AppUser     = { displayName: string; avatarUrl: string; followerCount: number; followingCount: number };
type SpotifyArtist = { id: string; name: string; images: { url: string }[]; genres: string[] };

const GENRE_COLORS = ['#FFFFFF', '#E0685C', '#4FA3D1', '#4B4E53'];

export default function Me() {
  const { token, spotifyId, clearToken, saveToken } = useAuth();
  const nav = useNavigate();
  const isEmailOnly = spotifyId?.startsWith('email:');
  const apiBase = (import.meta.env.VITE_API_BASE as string) ?? '';

  function connectSpotify() {
    const callbackUrl = window.location.origin + '/auth/callback';
    // The backend appends its own `?access_token=…` to the redirect URL, so the
    // return path can't ride along as a query param — stash it for AuthCallback.
    sessionStorage.setItem('post_auth_redirect', '/me');
    window.location.href = `${apiBase}/auth/login?redirect=${encodeURIComponent(callbackUrl)}&linkId=${encodeURIComponent(spotifyId ?? '')}`;
  }

  async function disconnectSpotify() {
    if (!window.confirm('Log out of Spotify?\n\nYour account and reviews stay. You lose top artists, genres and Now Playing until you reconnect.')) return;
    setDisconnecting(true);
    try {
      // The server issues a fresh app session token — the current one is the Spotify token.
      const d = await api.del('/users/me/spotify') as { access_token: string; spotify_id: string };
      saveToken(d.access_token, d.spotify_id);
      setUser(null);
      setTopArtists([]);
    } catch (e) {
      window.alert((e as ApiError)?.body?.error ?? 'Could not disconnect Spotify. Please try again.');
    } finally {
      setDisconnecting(false);
    }
  }

  const [user,       setUser]       = useState<SpotifyUser | null>(null);
  const [appUser,    setAppUser]    = useState<AppUser | null>(null);
  const [topArtists, setTopArtists] = useState<SpotifyArtist[]>([]);
  const [counts,     setCounts]     = useState({ track: 0, album: 0, artist: 0 });
  const [loading,    setLoading]    = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [timeRange,  setTimeRange]  = useState<'short_term' | 'medium_term' | 'long_term'>('medium_term');

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.allSettled([
      isEmailOnly ? Promise.resolve(null) : api.get('/me'),
      api.get('/users/me'),
      api.get('/users/me/reviews/counts'),
    ]).then(([u, au, c]) => {
      if (u.status === 'fulfilled' && u.value) setUser(u.value);
      if (au.status === 'fulfilled') setAppUser(au.value);
      if (c.status === 'fulfilled') setCounts(c.value ?? { track: 0, album: 0, artist: 0 });
    }).finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    api.get(`/me/top/artists?time_range=${timeRange}`)
      .then((d: any) => setTopArtists(d?.items ?? []))
      .catch(() => setTopArtists([]));
  }, [token, timeRange]);

  const genreMap: Record<string, number> = {};
  topArtists.forEach(a => (a.genres ?? []).slice(0, 2).forEach(g => { genreMap[g] = (genreMap[g] ?? 0) + 1; }));
  const topGenres = Object.entries(genreMap).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const maxCount  = topGenres[0]?.[1] ?? 1;

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="w-8 h-8 border-2 border-violet/30 border-t-violet rounded-full animate-spin" /></div>;

  return (
    <div className="h-screen overflow-y-auto">
      <div className="sticky top-0 z-10 px-4 py-3 border-b border-white/8 flex items-center justify-between" style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(12px)' }}>
        <h1 className="text-[18px] font-bold text-fg">My Profile</h1>
        {/* Mobile-only logout — the desktop sidebar already has one */}
        <button
          onClick={() => { if (window.confirm('Log out?')) clearToken(); }}
          className="md:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-fg2 border border-white/10 active:scale-95 transition-transform cursor-pointer"
        >
          <LogoutIcon size={15} />
          Log out
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-4 pb-20 lg:grid lg:grid-cols-2 lg:gap-8 lg:items-start">
        {/* Left column — about sidebar (sticky on desktop) */}
        <div className="lg:sticky lg:top-20 self-start">
        {/* Identity */}
        <div className="flex flex-col items-center gap-3 py-8">
          <div className="p-0.5 rounded-full" style={{ background: 'linear-gradient(135deg, #FFFFFF, #E0685C)', boxShadow: '0 0 24px rgba(255,255,255,0.5)' }}>
            <Avatar name={user?.display_name ?? appUser?.displayName ?? '?'} src={user?.images?.[0]?.url ?? appUser?.avatarUrl} size={96} className="ring-2 ring-bg" />
          </div>
          <h2 className="text-[22px] font-bold text-fg">{appUser?.displayName ?? user?.display_name ?? '—'}</h2>
          {user?.id && <p className="text-[12px] text-cyan tracking-widest">@{user.id}</p>}
        </div>

        {/* Stats */}
        <div className="rounded-2xl border border-white/8 bg-white/4 p-4 flex justify-around mb-6">
          <div className="flex flex-col items-center gap-1">
            <span className="text-[22px] font-bold text-fg">{appUser?.followerCount ?? 0}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-fg3">Followers</span>
          </div>
          <div className="w-px bg-white/8" />
          <div className="flex flex-col items-center gap-1">
            <span className="text-[22px] font-bold text-fg">{appUser?.followingCount ?? 0}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-fg3">Following</span>
          </div>
          <div className="w-px bg-white/8" />
          <div className="flex flex-col items-center gap-1">
            <span className="text-[22px] font-bold text-fg">{counts.track + counts.album + counts.artist}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-fg3">Reviews</span>
          </div>
        </div>

        {/* TODO: profile editing — display name, avatar, settings */}
        <button
          disabled
          title="Coming soon"
          className="w-full mb-6 py-2.5 rounded-xl border border-white/10 text-[13px] font-semibold text-fg2 cursor-not-allowed opacity-60"
        >
          Edit profile
        </button>

        {/* Spotify-personalised sections — hidden for unlinked email users */}
        {isEmailOnly ? (
          <div className="rounded-2xl border border-white/8 bg-white/4 p-6 mb-6 flex flex-col items-center gap-3 text-center">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" className="text-white/20">
              <circle cx="12" cy="12" r="11" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M7 14.5c1.4-.9 3.2-1.4 5-1.4s3.6.5 5 1.4M6 11c1.8-1.2 4-1.9 6-1.9s4.2.7 6 1.9M8.5 17.5c1-.6 2.2-1 3.5-1s2.5.4 3.5 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <div>
              <p className="text-[14px] font-semibold text-fg">Connect your Spotify account</p>
              <p className="text-[12px] text-fg3 mt-1">Unlock top artists, genres, and the Now Playing widget</p>
            </div>
            <button
              onClick={connectSpotify}
              className="mt-1 px-5 py-2 rounded-full text-[13px] font-bold text-white cursor-pointer transition-opacity hover:opacity-80"
              style={{ background: 'linear-gradient(135deg, #FFFFFF, #E0685C)' }}
            >
              Connect Spotify
            </button>
          </div>
        ) : (
          <>
            {/* Top genres */}
            {topGenres.length > 0 && (
              <>
                <p className="text-[11px] font-bold uppercase tracking-widest text-fg3 mb-3">Top genres</p>
                <div className="rounded-2xl border border-white/8 bg-white/4 p-4 mb-6 flex flex-col gap-3">
                  {topGenres.map(([name, count], i) => (
                    <div key={name} className="flex items-center gap-3">
                      <span className="text-[12px] font-medium text-fg w-28 shrink-0 truncate">{name}</span>
                      <div className="flex-1 h-2 rounded-full bg-white/8 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(count / maxCount) * 100}%`, background: GENRE_COLORS[i] }} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Top artists */}
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-fg3">Top artists</p>
              <div className="flex gap-1.5">
                {([['short_term', '4w'], ['medium_term', '6m'], ['long_term', 'All']] as const).map(([range, label]) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className="px-2 py-1 rounded-full text-[10px] font-bold border cursor-pointer"
                    style={{
                      borderColor: timeRange === range ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.08)',
                      background:  timeRange === range ? 'rgba(255,255,255,0.15)' : 'transparent',
                      color:       timeRange === range ? '#FFFFFF' : '#978A74',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {topArtists.length > 0 && (
              <div className="flex flex-col gap-2 mb-6">
                {topArtists.map((a, i) => (
                  <button key={a.id} onClick={() => nav(`/artist/${a.id}`)} className="flex items-center gap-3 p-2.5 rounded-xl border border-white/8 bg-white/4 hover:bg-white/8 transition-colors cursor-pointer text-left">
                    <span className="text-[12px] font-bold w-6 text-center" style={{ color: i < 3 ? '#FFFFFF' : '#5C5142' }}>{i + 1}</span>
                    {a.images?.[2]?.url ? <img src={a.images[2].url} alt="" className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 rounded-full bg-white/8" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-fg truncate">{a.name}</p>
                      {a.genres?.[0] && <p className="text-[11px] text-fg3 truncate">{a.genres[0]}</p>}
                    </div>
                    <span className="text-fg4 text-sm">›</span>
                  </button>
                ))}
              </div>
            )}

            {/* Unlink Spotify — the account and its reviews are kept */}
            <button
              onClick={() => void disconnectSpotify()}
              disabled={disconnecting}
              className="w-full mb-6 py-2.5 rounded-xl border border-white/10 text-[13px] font-semibold text-fg2 flex items-center justify-center gap-2 hover:bg-white/5 hover:text-fg transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <SpotifyIcon size={14} />
              {disconnecting ? 'Logging out…' : 'Log out of Spotify'}
            </button>
          </>
        )}
        </div>

        {/* Right column — reviews */}
        <ProfileReviews endpointBase="/users/me/reviews" counts={counts} />
      </div>
    </div>
  );
}

function SpotifyIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#1DB954">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  );
}

function LogoutIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}
