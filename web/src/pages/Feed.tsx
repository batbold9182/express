import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ReviewCard } from '../components/ReviewCard';
import { api } from '../lib/api';
import { useAuth } from '../context/auth';
import type { FeedItem } from '@tunelog/shared';

export default function Feed() {
  const { token } = useAuth();
  const nav = useNavigate();
  const [items,       setItems]       = useState<FeedItem[]>([]);
  const [myId,        setMyId]        = useState('');
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore,     setHasMore]     = useState(false);
  const [error,       setError]       = useState(false);
  const offsetRef      = useRef(0);
  const loadingMoreRef = useRef(false);

  async function load() {
    if (!token) return;
    setLoading(true); setError(false); offsetRef.current = 0;
    try {
      const d = await api.get('/users/feed/me?offset=0&limit=15');
      setItems(d.items); setMyId(d.myId); setHasMore(d.hasMore); offsetRef.current = d.items.length;
    } catch { setError(true); } finally { setLoading(false); }
  }

  async function loadMore() {
    if (!token || !hasMore || loadingMoreRef.current) return;
    loadingMoreRef.current = true; setLoadingMore(true);
    try {
      const d = await api.get(`/users/feed/me?offset=${offsetRef.current}&limit=15`);
      setItems(prev => [...prev, ...d.items]); setHasMore(d.hasMore); offsetRef.current += d.items.length;
    } catch {} finally { loadingMoreRef.current = false; setLoadingMore(false); }
  }

  useEffect(() => { load(); }, [token]);

  function onScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 400) loadMore();
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="px-4 py-4 border-b border-white/8 sticky top-0 z-10" style={{ background: 'rgba(11,8,22,0.92)', backdropFilter: 'blur(12px)' }}>
        <h1 className="text-[18px] font-bold text-fg">Feed</h1>
        <p className="text-[12px] text-fg3">From people you follow</p>
      </div>

      <div className="flex-1 overflow-y-auto pb-20 md:pb-4" onScroll={onScroll}>
        {loading ? (
          <div className="flex justify-center pt-24"><Spinner /></div>
        ) : error ? (
          <div className="flex flex-col items-center gap-4 pt-24 text-center px-8">
            <p className="text-fg3">Failed to load feed.</p>
            <button onClick={load} className="px-4 py-2 rounded-xl border border-white/10 text-fg2 text-[13px] cursor-pointer">Retry</button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-4 pt-24 text-center px-8">
            <p className="text-fg font-semibold">Nothing here yet</p>
            <p className="text-fg3 text-[13px]">Follow people to see their reviews.</p>
            <button onClick={() => nav('/search')} className="mt-1 px-5 py-2 rounded-xl border border-white/10 bg-white/6 text-fg2 text-[13px] font-semibold cursor-pointer">
              Find people to follow
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 p-4 max-w-2xl mx-auto">
            <p className="text-[11px] font-bold uppercase tracking-widest text-fg3">Latest</p>
            {items.map(item => (
              <ReviewCard key={item._id} item={item} myId={myId} onDelete={() => setItems(prev => prev.filter(r => r._id !== item._id))} />
            ))}
            {loadingMore && <div className="flex justify-center py-4"><Spinner /></div>}
            {!hasMore && items.length > 0 && <p className="text-center text-fg4 text-[12px] py-4">You're all caught up</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return <div className="w-8 h-8 border-2 border-violet/30 border-t-violet rounded-full animate-spin" />;
}
