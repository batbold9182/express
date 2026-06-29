import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { api } from '../lib/api';
import { useAuth } from '../context/auth';
import { scoreColor, MOOD_LIST } from '@tunelog/shared';
import type { ProfileReview } from '@tunelog/shared';

const MOOD_COLOR = Object.fromEntries(MOOD_LIST.map(([m, c]) => [m, c]));
type ReviewType = 'track' | 'album' | 'artist';

type AppUser = { displayName: string; avatarUrl?: string; spotifyId: string; followerCount: number; followingCount: number; isFollowing: boolean };

export default function Profile() {
  const { id } = useParams<{ id: string }>();
  const { spotifyId: myId } = useAuth();
  const nav = useNavigate();

  const [user,       setUser]       = useState<AppUser | null>(null);
  const [counts,     setCounts]     = useState({ track: 0, album: 0, artist: 0 });
  const [tab,        setTab]        = useState<ReviewType | null>(null);
  const [reviews,    setReviews]    = useState<ProfileReview[]>([]);
  const [revLoading, setRevLoading] = useState(false);
  const [following,  setFollowing]  = useState(false);
  const [busy,       setBusy]       = useState(false);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.allSettled([
      api.get(`/users/${id}`),
      api.get(`/users/${id}/reviews/counts`),
    ]).then(([u, c]) => {
      if (u.status === 'fulfilled') { setUser(u.value); setFollowing(u.value.isFollowing); }
      if (c.status === 'fulfilled') setCounts(c.value ?? { track: 0, album: 0, artist: 0 });
    }).finally(() => setLoading(false));
  }, [id]);

  async function selectTab(type: ReviewType) {
    if (tab === type) { setTab(null); setReviews([]); return; }
    setTab(type); setReviews([]); setRevLoading(true);
    try {
      const d = await api.get(`/users/${id}/reviews?type=${type}&offset=0&limit=20`);
      setReviews(d.reviews ?? []);
    } catch {} finally { setRevLoading(false); }
  }

  async function toggleFollow() {
    if (busy || !id) return;
    setBusy(true);
    try {
      if (following) { await api.del(`/users/${id}/follow`); setFollowing(false); setUser(u => u ? { ...u, followerCount: u.followerCount - 1 } : u); }
      else { await api.post(`/users/${id}/follow`, {}); setFollowing(true); setUser(u => u ? { ...u, followerCount: u.followerCount + 1 } : u); }
    } catch {} finally { setBusy(false); }
  }

  const isOwn = id === myId;

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="w-8 h-8 border-2 border-violet/30 border-t-violet rounded-full animate-spin" /></div>;
  if (!user) return <div className="flex items-center justify-center h-screen text-fg3">User not found.</div>;

  return (
    <div className="h-screen overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center gap-2 px-4 pt-4 pb-2" style={{ background: 'rgba(11,8,22,0.9)', backdropFilter: 'blur(12px)' }}>
        <button onClick={() => nav(-1)} className="p-2 rounded-full bg-white/8 border border-white/10 cursor-pointer text-fg hover:text-violet">← Back</button>
      </div>

      <div className="max-w-2xl mx-auto px-4 pb-20">
        {/* Identity */}
        <div className="flex flex-col items-center gap-3 py-8">
          <div className="p-0.5 rounded-full" style={{ background: 'linear-gradient(135deg, #B14EFF, #FF3FA4)' }}>
            <Avatar name={user.displayName} src={user.avatarUrl} size={88} className="ring-2 ring-bg" />
          </div>
          <h1 className="text-[22px] font-bold text-fg">{user.displayName}</h1>
          <p className="text-[12px] text-cyan tracking-widest">@{user.spotifyId}</p>

          {!isOwn && (
            <button
              onClick={toggleFollow}
              disabled={busy}
              className="px-5 py-2 rounded-full text-[13px] font-semibold border transition-all cursor-pointer disabled:opacity-50"
              style={{
                background:  following ? 'transparent' : '#B14EFF',
                color:       following ? '#B14EFF' : '#fff',
                borderColor: '#B14EFF',
              }}
            >
              {busy ? '…' : following ? 'Following' : 'Follow'}
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="rounded-2xl border border-white/8 bg-white/4 p-4 flex justify-around mb-6">
          <div className="flex flex-col items-center gap-1">
            <span className="text-[22px] font-bold text-fg">{user.followerCount}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-fg3">Followers</span>
          </div>
          <div className="w-px bg-white/8" />
          <div className="flex flex-col items-center gap-1">
            <span className="text-[22px] font-bold text-fg">{user.followingCount}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-fg3">Following</span>
          </div>
          <div className="w-px bg-white/8" />
          <div className="flex flex-col items-center gap-1">
            <span className="text-[22px] font-bold text-fg">{counts.track + counts.album + counts.artist}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-fg3">Reviews</span>
          </div>
        </div>

        {/* Review tabs */}
        <p className="text-[11px] font-bold uppercase tracking-widest text-fg3 mb-3">Reviews</p>
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
          <div className="flex flex-col gap-3">
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
      </div>
    </div>
  );
}
