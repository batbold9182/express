import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { ProfileReviews } from '../components/ProfileReviews';
import { api, API_BASE, type ApiError } from '../lib/api';
import { SpotifyIcon, SettingsIcon } from '../components/icons';
import { Favorites, RatingHistogram, Stat } from '../components/TasteWidgets';
import { tasteStats } from '../lib/taste';
import type { ProfileReview } from '@tunelog/shared';
import { useAuth } from '../context/auth';
import { PageSpinner } from '../components/Spinner';

type SpotifyUser   = { display_name: string; id: string; images: { url: string }[] };
type AppUser       = { displayName: string; avatarUrl: string; followerCount: number; followingCount: number; spotifyLinked: boolean; createdAt?: string };
type SpotifyArtist = { id: string; name: string; images: { url: string }[]; genres: string[] };

// Genre-bar accents — one per rank. The 4th used to be a near-invisible slate; amber reads.
const GENRE_COLORS = ['#FFFFFF', '#E0685C', '#4FA3D1', '#EDA63E'];

// Stats (avg, favorites, histogram) are computed client-side from the caller's reviews. The list
// endpoint caps at 50, so for a heavy reviewer these reflect the 50 most recent — a fair read of
// current taste. A dedicated /users/me/stats endpoint would make them exact (backend, later).
const STATS_SAMPLE = 50;

export default function Me() {
  const { token, spotifyId } = useAuth();
  const nav = useNavigate();
  const apiBase = API_BASE ?? '';

  const [user,       setUser]       = useState<SpotifyUser | null>(null);
  const [appUser,    setAppUser]    = useState<AppUser | null>(null);
  const [topArtists, setTopArtists] = useState<SpotifyArtist[]>([]);
  const [myReviews,  setMyReviews]  = useState<ProfileReview[]>([]);
  const [counts,     setCounts]     = useState({ track: 0, album: 0, artist: 0 });
  const [loading,    setLoading]    = useState(true);
  const [artistRange, setArtistRange] = useState<string | null>(null); // time_range the current topArtists belong to
  const [disconnecting, setDisconnecting] = useState(false);
  const [timeRange,  setTimeRange]  = useState<'short_term' | 'medium_term' | 'long_term'>('medium_term');

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
      // The session survives now — accessToken is an app token, so there is no token to re-save.
      await api.del('/users/me/spotify');
      setAppUser(a => a ? { ...a, spotifyLinked: false } : a);
      setUser(null);
      setTopArtists([]);
    } catch (e) {
      window.alert((e as ApiError)?.body?.error ?? 'Could not disconnect Spotify. Please try again.');
    } finally {
      setDisconnecting(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.allSettled([
      // Fired unconditionally: whether Spotify is linked comes from /users/me in this same
      // batch, so gating on it would mean serialising the two. Unlinked accounts get a 502,
      // which allSettled already absorbs — same as the top-artists call below.
      api.get('/me'),
      api.get('/users/me'),
      api.get('/users/me/reviews/counts'),
      api.get(`/users/me/reviews?type=all&offset=0&limit=${STATS_SAMPLE}`),
    ]).then(([u, au, c, mr]) => {
      if (u.status === 'fulfilled' && u.value) setUser(u.value);
      if (au.status === 'fulfilled') setAppUser(au.value);
      if (c.status === 'fulfilled') setCounts(c.value ?? { track: 0, album: 0, artist: 0 });
      if (mr.status === 'fulfilled') setMyReviews(mr.value?.reviews ?? []);
    }).finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    api.get(`/me/top/artists?time_range=${timeRange}`)
      .then((d: { items?: SpotifyArtist[] }) => setTopArtists(d?.items ?? []))
      .catch(() => setTopArtists([]))
      .finally(() => setArtistRange(timeRange));
  }, [token, timeRange]);

  // Derived, not a synchronous setState-in-effect: the list is "loading" whenever the fetched
  // range hasn't caught up to the selected one (initial load, or just after a toggle).
  const artistsLoading = !!appUser?.spotifyLinked && artistRange !== timeRange;

  const genreMap: Record<string, number> = {};
  topArtists.forEach(a => (a.genres ?? []).slice(0, 2).forEach(g => { genreMap[g] = (genreMap[g] ?? 0) + 1; }));
  const topGenres = Object.entries(genreMap).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const maxCount  = topGenres[0]?.[1] ?? 1;

  const totalReviews = counts.track + counts.album + counts.artist;
  const t            = tasteStats(myReviews);
  const tasteGenres  = appUser?.spotifyLinked ? topGenres.slice(0, 2).map(([n]) => n).join(', ') : '';

  const joined = appUser?.createdAt
    ? new Date(appUser.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  if (loading) return <PageSpinner />;

  const displayName = appUser?.displayName ?? user?.display_name ?? '—';

  return (
    <div className="h-screen overflow-y-auto">
      {/* Mobile only — desktop reaches settings from the sidebar */}
      <div className="md:hidden sticky top-0 z-20 px-4 py-3 border-b border-white/8 flex items-center justify-between" style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(12px)' }}>
        <h1 className="text-[18px] font-bold text-fg">Profile</h1>
        <Link to="/settings" aria-label="Settings" className="p-1.5 -m-1.5 text-fg3 hover:text-fg transition-colors">
          <SettingsIcon size={18} />
        </Link>
      </div>

      <div className="max-w-6xl mx-auto px-4 pt-6 pb-20 flex flex-col gap-6 lg:grid lg:grid-cols-[1fr_320px] lg:gap-8 lg:items-start">

        {/* Identity — main column, top. Horizontal card on desktop, centred stack on mobile. */}
        <div className="lg:col-start-1 lg:row-start-1 flex flex-col items-center text-center gap-3 pb-2 lg:flex-row lg:items-center lg:text-left lg:gap-6 lg:pb-0 lg:px-6 lg:py-5 lg:rounded-2xl lg:border lg:border-white/8 lg:bg-white/4">
          <div className="p-0.5 rounded-full shrink-0" style={{ background: 'linear-gradient(135deg, #FFFFFF, #E0685C)', boxShadow: '0 0 16px rgba(224,104,92,0.25)' }}>
            <Avatar name={displayName} src={user?.images?.[0]?.url ?? appUser?.avatarUrl} size={80} className="ring-2 ring-bg" />
          </div>

          <div className="lg:flex-1 min-w-0">
            <h2 className="text-[20px] font-bold text-fg lg:truncate">{displayName}</h2>
            {user?.id
              ? <p className="text-[12px] text-cyan tracking-wide" title={`@${user.id}`}>@{user.id.length > 16 ? `${user.id.slice(0, 16)}…` : user.id}</p>
              : joined && <p className="text-[12px] text-fg4">Joined {joined}</p>}
            {(t.avg != null || tasteGenres) && (
              <p className="text-[12px] text-fg3 mt-1.5 leading-relaxed">
                {t.avg != null && <>avg <span className="text-fg font-semibold tabular-nums">{t.avg.toFixed(1)}</span> given</>}
                {t.avg != null && tasteGenres && ' · '}
                {tasteGenres && <>mostly <span className="text-fg2">{tasteGenres}</span></>}
              </p>
            )}
          </div>

          <div className="flex items-center gap-6 shrink-0 lg:pl-6 lg:border-l lg:border-white/8">
            <Stat value={appUser?.followerCount ?? 0} label="Followers" />
            <Stat value={appUser?.followingCount ?? 0} label="Following" />
            <Stat value={totalReviews} label="Reviews" />
          </div>
        </div>

        {/* Right rail — taste widgets. Sticks on desktop; sits between identity and reviews on mobile. */}
        <div className="lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto no-scrollbar flex flex-col gap-6">

          <Favorites items={t.favorites} />
          {t.count > 0 && <RatingHistogram dist={t.dist} maxDist={t.maxDist} label="How you rate" />}

          {/* Spotify-personalised sections — hidden for unlinked email users */}
          {!appUser?.spotifyLinked ? (
            <div className="rounded-2xl border border-white/8 bg-white/4 p-6 flex flex-col items-center gap-3 text-center">
              <SpotifyIcon size={32} />
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
            <div>
              <div className="flex items-center gap-2 mb-4">
                <SpotifyIcon size={13} />
                <p className="text-[11px] font-bold uppercase tracking-widest text-fg3">From Spotify</p>
              </div>

              {/* Top genres */}
              {topGenres.length > 0 && (
                <div className="rounded-2xl border border-white/8 bg-white/4 p-4 mb-5 flex flex-col gap-3">
                  {topGenres.map(([name, count], i) => (
                    <div key={name} className="flex items-center gap-3">
                      <span className="text-[12px] font-medium text-fg w-24 shrink-0 truncate">{name}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-white/8 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(count / maxCount) * 100}%`, background: GENRE_COLORS[i] }} />
                      </div>
                      <span className="text-[11px] text-fg4 tabular-nums w-4 text-right shrink-0">{count}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Top artists */}
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-bold uppercase tracking-widest text-fg3">Top artists</p>
                <div className="flex gap-1.5">
                  {([['short_term', '4w'], ['medium_term', '6m'], ['long_term', 'All']] as const).map(([range, label]) => (
                    <button
                      key={range}
                      onClick={() => setTimeRange(range)}
                      className="px-2 py-1 rounded-full text-[10px] font-bold border cursor-pointer transition-colors"
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

              {artistsLoading ? (
                <div className="rounded-2xl border border-white/8 bg-white/4 divide-y divide-white/6 mb-5">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="w-5 h-3 rounded bg-white/8 shrink-0" />
                      <div className="w-9 h-9 rounded-full bg-white/8 shrink-0 animate-pulse" />
                      <div className="flex-1 h-3 rounded bg-white/8 animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : topArtists.length > 0 ? (
                <div className="rounded-2xl border border-white/8 bg-white/4 divide-y divide-white/6 mb-5">
                  {topArtists.map((a, i) => (
                    <button
                      key={a.id}
                      onClick={() => nav(`/artist/${a.id}`)}
                      className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-white/5 transition-colors cursor-pointer text-left"
                    >
                      <span className="text-[12px] font-bold w-5 text-center shrink-0" style={{ color: i < 3 ? '#FFFFFF' : '#978A74' }}>{i + 1}</span>
                      {a.images?.[2]?.url
                        ? <img src={a.images[2].url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                        : <div className="w-9 h-9 rounded-full bg-white/8 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-fg truncate">{a.name}</p>
                        {a.genres?.[0] && <p className="text-[11px] text-fg3 truncate">{a.genres[0]}</p>}
                      </div>
                      <span className="text-fg3 text-sm shrink-0">›</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-[12px] text-fg4 text-center py-6 mb-5">No listening history yet — play something on Spotify.</p>
              )}

              {/* Unlink Spotify — the account and its reviews are kept */}
              <button
                onClick={() => void disconnectSpotify()}
                disabled={disconnecting}
                className="w-full text-center py-2 text-[12px] text-fg3 hover:text-fg2 transition-colors cursor-pointer disabled:opacity-50"
              >
                {disconnecting ? 'Logging out…' : 'Log out of Spotify'}
              </button>
            </div>
          )}
        </div>

        {/* Reviews — main column, below identity */}
        <div className="lg:col-start-1 lg:row-start-2">
          <ProfileReviews endpointBase="/users/me/reviews" counts={counts} />
        </div>
      </div>
    </div>
  );
}
