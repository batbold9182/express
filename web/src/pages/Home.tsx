import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ReviewCard } from '../components/ReviewCard';
import { BellIcon } from '../components/icons';
import { SuggestedUsers } from '../components/SuggestedUsers';
import { TopScoredWidget } from '../components/TopScoredWidget';
import { api } from '../lib/api';
import { useAuth } from '../context/auth';
import { useNotif } from '../context/notif';
import type { FeedItem } from '@tunelog/shared';
import { Spinner } from '../components/Spinner';

const TABS = [
  { key: 'foryou',    label: 'For You',   endpoint: '/reviews/trending'  },
  { key: 'following', label: 'Following', endpoint: '/users/feed/me'     },
] as const;
type Tab = typeof TABS[number]['key'];
const LIMIT = 15;

export default function Home() {
  const { token } = useAuth();
  const { unreadCount } = useNotif();
  const nav = useNavigate();

  const [tab,         setTab]         = useState<Tab>('foryou');
  const [items,       setItems]       = useState<FeedItem[]>([]);
  const [myId,        setMyId]        = useState('');
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore,     setHasMore]     = useState(false);
  const offsetRef      = useRef(0);
  const loadingMoreRef = useRef(false);

  const endpoint = TABS.find(t => t.key === tab)!.endpoint;

  async function load() {
    if (!token) return;
    setLoading(true);
    offsetRef.current = 0;
    try {
      const d = await api.get(`${endpoint}?offset=0&limit=${LIMIT}`);
      setItems(d.items ?? []); setMyId(d.myId ?? ''); setHasMore(d.hasMore ?? false);
      offsetRef.current = (d.items ?? []).length;
    } catch { setItems([]); } finally { setLoading(false); }
  }

  async function loadMore() {
    if (!token || !hasMore || loadingMoreRef.current) return;
    loadingMoreRef.current = true; setLoadingMore(true);
    try {
      const d = await api.get(`${endpoint}?offset=${offsetRef.current}&limit=${LIMIT}`);
      setItems(prev => [...prev, ...(d.items ?? [])]);
      setHasMore(d.hasMore ?? false);
      offsetRef.current += (d.items ?? []).length;
    } catch {} finally { loadingMoreRef.current = false; setLoadingMore(false); }
  }

  useEffect(() => { setItems([]); setHasMore(false); load(); }, [tab, token]);

  function onScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 400) loadMore();
  }

  const emptyIcon = tab === 'following' ? '👥' : '🔥';
  const emptyMsg  = tab === 'following' ? 'No reviews from people you follow yet.' : 'Be the first to post a review.';
  const emptyCta  = tab === 'following' ? 'Find people to follow' : 'Browse music';
  const emptyCb   = tab === 'following' ? () => nav('/search?scope=people') : () => nav('/search');

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-white/8 sticky top-0 z-10 shrink-0"
        style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(12px)' }}
      >
        <div className="flex gap-2 flex-1">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex-1 py-2 rounded-xl text-[13px] font-semibold border transition-all cursor-pointer"
              style={{
                borderColor: tab === t.key ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.08)',
                background:  tab === t.key ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.04)',
                color:       tab === t.key ? '#FFFFFF' : '#978A74',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button onClick={() => nav('/notifications')} className="relative p-2 cursor-pointer text-fg2 hover:text-fg">
          <BellIcon size={22} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-pink text-white text-[9px] font-bold rounded-full min-w-[15px] h-[15px] flex items-center justify-center px-0.5">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Body: main feed + right discovery panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Feed column */}
        <div className="flex-1 overflow-y-auto pb-20 md:pb-4" onScroll={onScroll}>
          {loading ? (
            <div className="flex items-center justify-center py-24"><Spinner /></div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-24 text-center px-8">
              <span className="text-4xl">{emptyIcon}</span>
              <p className="text-fg font-semibold">Nothing here yet</p>
              <p className="text-fg3 text-[13px]">{emptyMsg}</p>
              <button onClick={emptyCb} className="mt-1 px-5 py-2 rounded-xl border border-white/10 bg-white/6 text-fg2 text-[13px] font-semibold cursor-pointer">
                {emptyCta}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 p-4 max-w-2xl xl:mx-0 xl:max-w-none xl:mr-0">
              {items.map(item => (
                <ReviewCard key={item._id} item={item} myId={myId} onDelete={() => setItems(prev => prev.filter(r => r._id !== item._id))} />
              ))}
              {loadingMore && <div className="flex justify-center py-4"><Spinner /></div>}
              {!hasMore && items.length > 0 && <p className="text-center text-fg4 text-[12px] py-4">You're all caught up</p>}
            </div>
          )}
        </div>

        {/* Discovery panel — lg+ only */}
        <div className="hidden lg:flex flex-col gap-4 w-72 shrink-0 p-4 overflow-y-auto border-l border-white/6">
          <TopScoredWidget />
          <SuggestedUsers />
        </div>
      </div>
    </div>
  );
}

