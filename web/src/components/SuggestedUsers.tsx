import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Avatar } from './Avatar';

type SuggestedUser = {
  _id: string;
  spotifyId: string;
  displayName: string;
  avatarUrl?: string;
  followerCount: number;
};

export function SuggestedUsers() {
  const nav = useNavigate();
  const [users, setUsers] = useState<SuggestedUser[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<SuggestedUser[]>('/users/suggested?limit=5')
      .then(data => setUsers(data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function follow(user: SuggestedUser) {
    setFollowing(prev => new Set(prev).add(user._id));
    try {
      await api.post(`/users/${user.spotifyId}/follow`, {});
    } catch {
      setFollowing(prev => { const s = new Set(prev); s.delete(user._id); return s; });
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/8 p-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
        <div className="h-4 w-24 rounded bg-white/8 animate-pulse mb-4" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2.5">
            <div className="w-8 h-8 rounded-full bg-white/8 animate-pulse shrink-0" />
            <div className="flex-1 h-3 rounded bg-white/8 animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  const visible = users.filter(u => !following.has(u._id));

  return (
    <div className="rounded-2xl border border-white/8 p-4 flex flex-col gap-0.5" style={{ background: 'rgba(255,255,255,0.03)' }}>
      <p className="text-[11px] font-bold uppercase tracking-widest text-fg3 mb-2">Who to Follow</p>

      {visible.length === 0 && (
        <div className="py-3 text-center">
          <p className="text-[12px] text-fg4">You're following everyone active on Tunelog.</p>
          <button
            onClick={() => nav('/search?scope=people')}
            className="mt-2 text-[12px] text-violet hover:text-fg transition-colors cursor-pointer"
          >
            Search for people →
          </button>
        </div>
      )}

      {visible.map(user => (
        <div key={user._id} className="flex items-center gap-3 py-2">
          <button onClick={() => nav(`/profile/${user.spotifyId}`)} className="cursor-pointer shrink-0">
            <Avatar name={user.displayName} src={user.avatarUrl} size={32} />
          </button>
          <button onClick={() => nav(`/profile/${user.spotifyId}`)} className="flex-1 min-w-0 text-left cursor-pointer">
            <p className="text-[13px] font-semibold text-fg truncate">{user.displayName}</p>
            <p className="text-[11px] text-fg4">{user.followerCount} {user.followerCount === 1 ? 'follower' : 'followers'}</p>
          </button>
          <button
            onClick={() => follow(user)}
            className="shrink-0 text-[12px] font-semibold px-3 py-1 rounded-full border border-violet/40 text-violet hover:bg-violet/15 transition-colors cursor-pointer"
          >
            Follow
          </button>
        </div>
      ))}

      {visible.length > 0 && (
        <button
          onClick={() => nav('/search?scope=people')}
          className="mt-1 text-[12px] text-fg4 hover:text-fg3 text-right cursor-pointer transition-colors"
        >
          See more →
        </button>
      )}
    </div>
  );
}
