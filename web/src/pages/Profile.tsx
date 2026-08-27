import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { ProfileReviews } from '../components/ProfileReviews';
import { api } from '../lib/api';
import { useAuth } from '../context/auth';
import { PageSpinner } from '../components/Spinner';
import { BackHeader } from '../components/subject';

type AppUser = { displayName: string; avatarUrl?: string; spotifyId: string; followerCount: number; followingCount: number; isFollowing: boolean };

export default function Profile() {
  const { id } = useParams<{ id: string }>();
  const { spotifyId: myId } = useAuth();
  const nav = useNavigate();

  const [user,       setUser]       = useState<AppUser | null>(null);
  const [counts,     setCounts]     = useState({ track: 0, album: 0, artist: 0 });
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

  async function toggleFollow() {
    if (busy || !id) return;
    setBusy(true);
    try {
      if (following) { await api.del(`/users/${id}/follow`); setFollowing(false); setUser(u => u ? { ...u, followerCount: u.followerCount - 1 } : u); }
      else { await api.post(`/users/${id}/follow`, {}); setFollowing(true); setUser(u => u ? { ...u, followerCount: u.followerCount + 1 } : u); }
    } catch {} finally { setBusy(false); }
  }

  const isOwn = id === myId;

  if (loading) return <PageSpinner />;
  if (!user) return <div className="flex items-center justify-center h-screen text-fg3">User not found.</div>;

  return (
    <div className="h-screen overflow-y-auto">
      <BackHeader onBack={() => nav(-1)} bg="rgba(0,0,0,0.9)" />

      <div className="max-w-2xl mx-auto px-4 pb-20">
        {/* Identity */}
        <div className="flex flex-col items-center gap-3 py-8">
          <div className="p-0.5 rounded-full" style={{ background: 'linear-gradient(135deg, #FFFFFF, #E0685C)' }}>
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
                background:  following ? 'transparent' : '#FFFFFF',
                color:       following ? '#FFFFFF' : '#fff',
                borderColor: '#FFFFFF',
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

        {/* Reviews */}
        <ProfileReviews endpointBase={`/users/${id}/reviews`} counts={counts} />
      </div>
    </div>
  );
}
