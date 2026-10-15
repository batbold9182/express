import { useEffect, useRef, type ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { useAuth } from '../context/auth';
import { useNotif } from '../context/notif';
import { useNotifications, type Notif } from '../queries/notifications';
import { timeAgo, subjectPath } from '@tunelog/shared';
import { ListSpinner } from '../components/Spinner';
import { ErrorState } from '../components/ErrorState';
import { HeartIcon, ChatBubbleIcon, MeIcon, ReplyIcon, BellIcon } from '../components/icons';

// icon + tint for the small badge overlaid on the actor's avatar
const TYPE_BADGE: Record<Notif['type'], { Icon: ComponentType<{ size?: number }>; tint: string }> = {
  like:    { Icon: HeartIcon,      tint: '#E0685C' },
  comment: { Icon: ChatBubbleIcon, tint: '#4FA3D1' },
  follow:  { Icon: MeIcon,         tint: '#FFFFFF' },
  reply:   { Icon: ReplyIcon,      tint: '#978A74' },
};

export default function Notifications() {
  const { token } = useAuth();
  const { markAllRead } = useNotif();
  const nav = useNavigate();

  const { data, error, isPending, isError, isSuccess, isFetching, refetch } = useNotifications(!!token);
  const items     = data ?? [];
  const loading   = isPending;
  const showError = isError && data === undefined;

  // Mark everything read — once per visit, and only after the list has actually been loaded *fresh*
  // (a cached copy may show first while it refreshes). Doing it earlier would clear the badge for
  // notifications the user has not seen; doing it on a failed load did exactly that.
  const markedThisVisit = useRef(false);
  useEffect(() => {
    if (isSuccess && !isFetching && !markedThisVisit.current) {
      markedThisVisit.current = true;
      markAllRead();
    }
  }, [isSuccess, isFetching, markAllRead]);

  function navigate(n: Notif) {
    const snap = n.entitySnapshot;
    const eid  = n.entityId;
    const type     = snap?.type     ?? eid?.type;
    const trackId  = snap?.spotifyTrackId  ?? eid?.spotifyTrackId;
    const albumId  = snap?.spotifyAlbumId  ?? eid?.spotifyAlbumId;
    const artistId = snap?.spotifyArtistId ?? eid?.spotifyArtistId;
    if (n.type === 'follow') {
      const first = n.actors[0];
      if (first) nav(`/profile/${first.spotifyId}`);
      return;
    }
    const path = subjectPath({
      type, spotifyTrackId: trackId, spotifyAlbumId: albumId, spotifyArtistId: artistId,
    });
    if (path) nav(path);
  }

  function describeNotif(n: Notif): string {
    const count = n.actorCount;
    const name  = n.actors[0]?.displayName ?? 'Someone';
    const extra = count > 1 ? ` and ${count - 1} other${count > 2 ? 's' : ''}` : '';
    const subject = n.entitySnapshot?.trackName ? `"${n.entitySnapshot.trackName}"` : 'your review';
    switch (n.type) {
      case 'like':    return `${name}${extra} liked ${subject}`;
      case 'comment': return `${name}${extra} commented on ${subject}`;
      case 'follow':  return `${name}${extra} followed you`;
      case 'reply':   return `${name}${extra} replied to your comment`;
      default:        return `${name} interacted with you`;
    }
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="px-4 py-4 border-b border-white/8 sticky top-0 z-10 flex items-center justify-between" style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(12px)' }}>
        <h1 className="text-[18px] font-bold text-fg">Notifications</h1>
        {items.some(n => !n.read) && (
          <button onClick={markAllRead} className="text-[12px] text-violet cursor-pointer hover:opacity-80">Mark all read</button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pb-20 md:pb-4">
        {loading ? (
          <ListSpinner />
        ) : showError ? (
          <ErrorState title="Couldn't load notifications" error={error} onRetry={() => void refetch()} />
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 pt-24 text-center px-8">
            <BellIcon size={38} className="text-fg4" />
            <p className="text-fg3 text-[13px]">No notifications yet</p>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto divide-y divide-white/6">
            {items.map(n => (
              <button
                key={n._id}
                onClick={() => navigate(n)}
                className="flex items-start gap-3 w-full px-4 py-3.5 hover:bg-white/4 transition-colors cursor-pointer text-left"
                style={{ background: n.read ? 'transparent' : 'rgba(255,255,255,0.05)' }}
              >
                {/* Actor avatar + type badge */}
                <div className="relative shrink-0" style={{ width: 40, height: 40 }}>
                  {n.actors[0] && (
                    <Avatar
                      name={n.actors[0].displayName}
                      src={n.actors[0].avatarUrl}
                      size={36}
                    />
                  )}
                  <span
                    className="absolute -bottom-1 -right-1 w-[18px] h-[18px] rounded-full flex items-center justify-center border border-bg"
                    style={{ background: '#1c1c1c', color: TYPE_BADGE[n.type].tint }}
                  >
                    {n.type === 'like'
                      ? <HeartIcon size={11} filled />
                      : (() => { const I = TYPE_BADGE[n.type].Icon; return <I size={11} />; })()}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-fg leading-snug">{describeNotif(n)}</p>
                  <p className="text-[11px] text-fg4 mt-0.5">{timeAgo(n.updatedAt ?? n.createdAt)}</p>
                </div>

                {/* Track art (if available) */}
                {n.entitySnapshot?.albumArt && n.type !== 'follow' && (
                  <img src={n.entitySnapshot.albumArt} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                )}

                {!n.read && <div className="w-2 h-2 rounded-full bg-violet shrink-0 mt-1.5" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
