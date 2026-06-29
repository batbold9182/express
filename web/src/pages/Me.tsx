import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { api } from '../lib/api';
import { useAuth } from '../context/auth';
import { scoreColor, MOOD_LIST } from '@tunelog/shared';
import type { ProfileReview } from '@tunelog/shared';

const MOOD_COLOR = Object.fromEntries(MOOD_LIST.map(([m, c]) => [m, c]));
type ReviewType = 'track' | 'album' | 'artist';

type SpotifyUser = { display_name: string; id: string; images: { url: string }[] };
type AppUser     = { displayName: string; avatarUrl: string; followerCount: number; followingCount: number };
type SpotifyArtist = { id: string; name: string; images: { url: string }[]; genres: string[] };

const GENRE_COLORS = ['#B14EFF', '#FF3FA4', '#00D9FF', '#C6FF3D'];

export default function Me() {
  const { token, spotifyId, clearToken } = useAuth();
  const nav = useNavigate();
  const isEmailOnly = spotifyId?.startsWith('email:');
  const apiBase = (import.meta.env.VITE_API_BASE as string) ?? '';

  function connectSpotify() {
    const callbackUrl = window.location.origin + '/auth/callback';
    window.location.href = `${apiBase}/auth/login?redirect=${encodeURIComponent(callbackUrl)}&linkId=${encodeURIComponent(spotifyId ?? '')}`;
  }

  const [user,       setUser]       = useState<SpotifyUser | null>(null);
  const [appUser,    setAppUser]    = useState<AppUser | null>(null);
  const [topArtists, setTopArtists] = useState<SpotifyArtist[]>([]);
  const [counts,     setCounts]     = useState({ track: 0, album: 0, artist: 0 });
  const [tab,        setTab]        = useState<ReviewType | null>(null);
  const [reviews,    setReviews]    = useState<ProfileReview[]>([]);
  const [revLoading, setRevLoading] = useState(false);
  const [loading,    setLoading]    = useState(true);
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

  async function selectTab(type: ReviewType) {
    if (tab === type) { setTab(null); setReviews([]); return; }
    setTab(type); setReviews([]); setRevLoading(true);
    try {
      const d = await api.get(`/users/me/reviews?type=${type}&offset=0&limit=20`);
      setReviews(d.reviews ?? []);
    } catch {} finally { setRevLoading(false); }
  }

  const genreMap: Record<string, number> = {};
  topArtists.forEach(a => (a.genres ?? []).slice(0, 2).forEach(g => { genreMap[g] = (genreMap[g] ?? 0) + 1; }));
  const topGenres = Object.entries(genreMap).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const maxCount  = topGenres[0]?.[1] ?? 1;

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="w-8 h-8 border-2 border-violet/30 border-t-violet rounded-full animate-spin" /></div>;

  return (
    <div className="h-screen overflow-y-auto">
      <div className="sticky top-0 z-10 px-4 py-3 border-b border-white/8" style={{ background: 'rgba(11,8,22,0.92)', backdropFilter: 'blur(12px)' }}>
        <h1 className="text-[18px] font-bold text-fg">My Profile</h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 pb-20">
        {/* Identity */}
        <div className="flex flex-col items-center gap-3 py-8">
          <div className="p-0.5 rounded-full" style={{ background: 'linear-gradient(135deg, #B14EFF, #FF3FA4)', boxShadow: '0 0 24px rgba(177,78,255,0.5)' }}>
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
              style={{ background: 'linear-gradient(135deg, #B14EFF, #FF3FA4)' }}
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
                      borderColor: timeRange === range ? 'rgba(177,78,255,0.5)' : 'rgba(255,255,255,0.08)',
                      background:  timeRange === range ? 'rgba(177,78,255,0.15)' : 'transparent',
                      color:       timeRange === range ? '#B14EFF' : '#8A7FAC',
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
                    <span className="text-[12px] font-bold w-6 text-center" style={{ color: i < 3 ? '#B14EFF' : '#5A4F78' }}>{i + 1}</span>
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
          </>
        )}

        {/* Reviews */}
        <p className="text-[11px] font-bold uppercase tracking-widest text-fg3 mb-3">My reviews</p>
        <div className="flex gap-2 mb-4">
          {(['artist', 'album', 'track'] as ReviewType[]).map(type => (
            <button
              key={type}
              onClick={() => selectTab(type)}
              className="flex-1 py-3 flex flex-col items-center gap-0.5 rounded-xl border transition-all cursor-pointer"
              style={{
                borderColor: tab === type ? 'rgba(177,78,255,0.5)' : 'rgba(255,255,255,0.08)',
                background:  tab === type ? 'rgba(177,78,255,0.14)' : 'rgba(255,255,255,0.04)',
              }}
            >
              <span className="text-[18px] font-bold" style={{ color: tab === type ? '#B14EFF' : '#E6E2F2' }}>{counts[type]}</span>
              <span className="text-[11px] font-semibold capitalize" style={{ color: tab === type ? '#B14EFF' : '#8A7FAC' }}>{type === 'track' ? 'Song' : type}</span>
            </button>
          ))}
        </div>

        {tab && (
          revLoading ? <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-violet/30 border-t-violet rounded-full animate-spin" /></div> :
          reviews.length === 0 ? <p className="text-fg3 text-center text-[13px] py-8">No reviews yet</p> :
          <div className="flex flex-col gap-3 mb-4">
            {reviews.map(r => (
              <button key={r._id} onClick={() => {
                if (r.type === 'artist' && r.spotifyArtistId) nav(`/artist/${r.spotifyArtistId}`);
                else if (r.type === 'album' && r.spotifyAlbumId) nav(`/album/${r.spotifyAlbumId}`);
                else if (r.spotifyTrackId) nav(`/song/${r.spotifyTrackId}`);
              }} className="flex gap-3 p-3 rounded-2xl border border-white/8 bg-white/4 hover:bg-white/8 transition-colors cursor-pointer text-left w-full">
                {r.albumArt ? <img src={r.albumArt} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" /> : <div className="w-12 h-12 rounded-lg bg-white/8 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-fg flex-1 truncate">{r.trackName}</span>
                    <span className="text-[15px] font-bold tabular-nums shrink-0" style={{ color: scoreColor(r.score) }}>{r.score.toFixed(1)}</span>
                  </div>
                  <p className="text-[11px] text-fg3 truncate">{r.artistName}</p>
                  {r.text && <p className="text-[12px] text-fg2 mt-1 line-clamp-2">{r.text}</p>}
                  {(r.moods?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {r.moods!.map(m => <span key={m} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ color: MOOD_COLOR[m], background: `${MOOD_COLOR[m]}20` }}>{m}</span>)}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => { if (window.confirm('Log out?')) clearToken(); }}
          className="w-full py-3 text-[14px] font-medium text-fg3 hover:text-fg transition-colors cursor-pointer mt-6"
        >
          Log out
        </button>
      </div>
    </div>
  );
}
