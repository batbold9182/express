import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { ProfileReviews } from '../components/ProfileReviews';
import { Favorites, RatingHistogram, Stat } from '../components/TasteWidgets';
import { tasteStats } from '../lib/taste';
import { api } from '../lib/api';
import type { ProfileReview } from '@tunelog/shared';
import { useAuth } from '../context/auth';
import { PageSpinner } from '../components/Spinner';
import { BackHeader } from '../components/subject';

type AppUser = {
  displayName: string;
  avatarUrl?: string;
  spotifyId: string;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
  createdAt?: string;
};

const STATS_SAMPLE = 50;

export default function Profile() {
  const { id } = useParams<{ id: string }>();
  const { spotifyId: myId } = useAuth();
  const nav = useNavigate();

  const [user,      setUser]      = useState<AppUser | null>(null);
  const [counts,    setCounts]    = useState({ track: 0, album: 0, artist: 0 });
  const [reviews,   setReviews]   = useState<ProfileReview[]>([]);
  const [following, setFollowing] = useState(false);
  const [busy,      setBusy]      = useState(false);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.allSettled([
      api.get(`/users/${id}`),
      api.get(`/users/${id}/reviews/counts`),
      api.get(`/users/${id}/reviews?type=all&offset=0&limit=${STATS_SAMPLE}`),
    ]).then(([u, c, r]) => {
      if (u.status === 'fulfilled') { setUser(u.value); setFollowing(u.value.isFollowing); }
      if (c.status === 'fulfilled') setCounts(c.value ?? { track: 0, album: 0, artist: 0 });
      if (r.status === 'fulfilled') setReviews(r.value?.reviews ?? []);
    }).finally(() => setLoading(false));
  }, [id]);

  async function toggleFollow() {
    if (busy || !id) return;
    setBusy(true);
    try {
      if (following) { await api.del(`/users/${id}/follow`); setFollowing(false); setUser(u => u ? { ...u, followerCount: u.followerCount - 1 } : u); }
      else { await api.post(`/users/${id}/follow`, {}); setFollowing(true); setUser(u => u ? { ...u, followerCount: u.followerCount + 1 } : u); }
    } catch { /* ignore */ } finally { setBusy(false); }
  }

  const isOwn = id === myId;

  if (loading) return <PageSpinner />;
  if (!user) return <div className="flex items-center justify-center h-screen text-fg3">User not found.</div>;

  const totalReviews = counts.track + counts.album + counts.artist;
  const t = tasteStats(reviews);
  const hasRail = t.count > 0;

  const joined = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;
  const realHandle = !user.spotifyId.startsWith('email:');

  return (
    <div className="h-screen overflow-y-auto">
      <BackHeader onBack={() => nav(-1)} bg="rgba(0,0,0,0.9)" />

      <div className={`max-w-6xl mx-auto px-4 pt-4 pb-20 flex flex-col gap-6 ${hasRail ? 'lg:grid lg:grid-cols-[1fr_320px] lg:gap-8 lg:items-start' : 'lg:max-w-3xl'}`}>

        {/* Identity — matches /me: horizontal card on desktop, centred stack on mobile */}
        <div className="lg:col-start-1 lg:row-start-1 flex flex-col items-center text-center gap-3 pb-2 lg:flex-row lg:items-center lg:text-left lg:gap-6 lg:pb-0 lg:px-6 lg:py-5 lg:rounded-2xl lg:border lg:border-white/8 lg:bg-white/4">
          <div className="p-0.5 rounded-full shrink-0" style={{ background: 'linear-gradient(135deg, #FFFFFF, #E0685C)', boxShadow: '0 0 16px rgba(224,104,92,0.25)' }}>
            <Avatar name={user.displayName} src={user.avatarUrl} size={80} className="ring-2 ring-bg" />
          </div>

          <div className="lg:flex-1 min-w-0">
            <h1 className="text-[20px] font-bold text-fg lg:truncate">{user.displayName}</h1>
            {realHandle
              ? <p className="text-[12px] text-cyan tracking-wide" title={`@${user.spotifyId}`}>@{user.spotifyId.length > 16 ? `${user.spotifyId.slice(0, 16)}…` : user.spotifyId}</p>
              : joined && <p className="text-[12px] text-fg4">Joined {joined}</p>}
            {t.avg != null && (
              <p className="text-[12px] text-fg3 mt-1.5">
                avg <span className="text-fg font-semibold tabular-nums">{t.avg.toFixed(1)}</span> given
              </p>
            )}
          </div>

          {!isOwn && (
            <button
              onClick={toggleFollow}
              disabled={busy}
              className="px-5 py-2 rounded-full text-[13px] font-semibold border transition-all cursor-pointer disabled:opacity-50 shrink-0"
              style={{
                background:  following ? 'transparent' : '#FFFFFF',
                color:       following ? '#FFFFFF' : '#0A0A0A',
                borderColor: '#FFFFFF',
              }}
            >
              {busy ? '…' : following ? 'Following' : 'Follow'}
            </button>
          )}

          <div className="flex items-center gap-6 shrink-0 lg:pl-6 lg:border-l lg:border-white/8">
            <Stat value={user.followerCount} label="Followers" />
            <Stat value={user.followingCount} label="Following" />
            <Stat value={totalReviews} label="Reviews" />
          </div>
        </div>

        {/* Right rail — taste snapshot (no "From Spotify": another user's top artists aren't public) */}
        {hasRail && (
          <div className="lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto no-scrollbar flex flex-col gap-6">
            <Favorites items={t.favorites} />
            <RatingHistogram dist={t.dist} maxDist={t.maxDist} label="Ratings" />
          </div>
        )}

        {/* Reviews — main column */}
        <div className="lg:col-start-1 lg:row-start-2">
          <ProfileReviews endpointBase={`/users/${id}/reviews`} counts={counts} />
        </div>
      </div>
    </div>
  );
}
