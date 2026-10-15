import { useParams, useNavigate } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { ProfileReviews } from '../components/ProfileReviews';
import { Favorites, RatingHistogram, Stat } from '../components/TasteWidgets';
import { tasteStats } from '../lib/taste';
import { isNotFound } from '../lib/api';
import { queryClient } from '../queries/client';
import { qk } from '../queries/keys';
import { totalOf } from '../queries/counts';
import { useFollow, useUser, useUserCounts, useUserReviewsSample, type AppUser } from '../queries/users';
import { useAuth } from '../context/auth';
import { PageSpinner } from '../components/Spinner';
import { ErrorState } from '../components/ErrorState';
import { BackHeader } from '../components/subject';

export default function Profile() {
  const { id } = useParams<{ id: string }>();
  const { spotifyId: myId } = useAuth();
  const nav = useNavigate();

  // The profile gates the page. Counts and the review sample load alongside: if either fails the page
  // still shows, with "—" for the count and no taste rail, instead of a misleading 0.
  const userQ   = useUser(id);
  const countsQ = useUserCounts(id);
  const sampleQ = useUserReviewsSample(id);
  const follow  = useFollow();

  const user    = userQ.data;
  const counts  = countsQ.data;            // undefined while loading or if it failed
  const reviews = sampleQ.data ?? [];

  // Follow state IS the cached profile, so it cannot go stale: a click edits the cached record at once
  // (the button and follower count move), and a failed request puts it back and shows a toast.
  function toggleFollow() {
    if (follow.isPending || !id || !user) return;
    const wasFollowing = user.isFollowing;
    const before = queryClient.getQueryData<AppUser>(qk.user(id));
    queryClient.setQueryData<AppUser>(qk.user(id), u => u && { ...u, isFollowing: !wasFollowing, followerCount: u.followerCount + (wasFollowing ? -1 : 1) });
    follow.mutate({ userId: id, following: wasFollowing }, { onError: () => queryClient.setQueryData(qk.user(id), before) });
  }

  const isOwn = id === myId;

  if (userQ.isPending) return <PageSpinner />;
  if (!user) {
    // A request that failed is not the same as a user that doesn't exist.
    if (userQ.isError && !isNotFound(userQ.error)) {
      return <ErrorState size="page" back title="Couldn't load this profile" error={userQ.error} onRetry={() => void userQ.refetch()} />;
    }
    return <div className="flex items-center justify-center h-screen text-fg3">User not found.</div>;
  }

  const following = user.isFollowing;
  const busy      = follow.isPending;

  const totalReviews = counts ? totalOf(counts) : '—';
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
          <ProfileReviews userId={id} counts={counts} />
        </div>
      </div>
    </div>
  );
}
