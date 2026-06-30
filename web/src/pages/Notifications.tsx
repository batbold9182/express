import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { api } from '../lib/api';
import { useAuth } from '../context/auth';
import { useNotif } from '../context/notif';
import { timeAgo } from '@tunelog/shared';

type NotifEntity = { spotifyTrackId?: string; spotifyAlbumId?: string; spotifyArtistId?: string; type?: string };
type Notif = {
  _id: string;
  type: 'like' | 'comment' | 'follow' | 'reply';
  read: boolean;
  createdAt: string;
  updatedAt: string;
  actorCount: number;
  actors: { _id: string; displayName: string; avatarUrl?: string; spotifyId: string }[];
  entityId?: NotifEntity;
  entitySnapshot?: NotifEntity & { trackName?: string; albumArt?: string };
};

const TYPE_ICONS: Record<string, string> = {
  like: '❤️', comment: '💬', follow: '👤', reply: '↩️',
};

export default function Notifications() {
  const { token } = useAuth();
  const { markAllRead } = useNotif();
  const nav = useNavigate();

  const [items,   setItems]   = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    api.get('/notifications?limit=50')
      .then((d: any) => setItems(d.notifications ?? []))
      .catch(() => {})
      .finally(() => { setLoading(false); markAllRead(); });
  }, [token]);

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
    if (type === 'artist' && artistId) nav(`/artist/${artistId}`);
    else if (type === 'album' && albumId) nav(`/album/${albumId}`);
    else if (trackId) nav(`/song/${trackId}`);
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
          <div className="flex justify-center pt-24"><div className="w-8 h-8 border-2 border-violet/30 border-t-violet rounded-full animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 pt-24 text-center px-8">
            <span className="text-4xl">🔔</span>
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
                {/* Actors avatars */}
                <div className="relative shrink-0" style={{ width: 40, height: 40 }}>
                  {n.actors[0] && (
                    <Avatar
                      name={n.actors[0].displayName}
                      src={n.actors[0].avatarUrl}
                      size={36}
                    />
                  )}
                  <span className="absolute -bottom-0.5 -right-0.5 text-[14px] leading-none">{TYPE_ICONS[n.type]}</span>
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
