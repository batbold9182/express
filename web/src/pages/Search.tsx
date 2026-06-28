import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/auth';
import { useRate } from '../context/rate';
import { Avatar } from '../components/Avatar';
import { scoreColor } from '@tunelog/shared';

type Track  = { id: string; name: string; artists: { name: string }[]; album: { id: string; images: { url: string }[] } };
type Album  = { id: string; name: string; artists: { name: string }[]; images: { url: string }[] };
type Artist = { id: string; name: string; images: { url: string }[]; genres: string[] };
type UserResult = { _id: string; spotifyId: string; displayName: string; avatarUrl: string; isFollowing: boolean };
type TrendingItem = { _id: string; type?: string; trackName: string; artistName: string; albumArt: string; score: number; spotifyTrackId?: string; spotifyAlbumId?: string; spotifyArtistId?: string };

const SCOPES   = ['All', 'Songs', 'Albums', 'Artists', 'People'];
const TYPE_MAP = ['track,album,artist', 'track', 'album', 'artist'];

export default function Search() {
  const nav = useNavigate();
  const { token, spotifyId } = useAuth();
  const { setItem } = useRate();

  const [q,        setQ]        = useState('');
  const [scope,    setScope]    = useState(0);
  const [loading,  setLoading]  = useState(false);
  const [tracks,   setTracks]   = useState<Track[]>([]);
  const [albums,   setAlbums]   = useState<Album[]>([]);
  const [artists,  setArtists]  = useState<Artist[]>([]);
  const [users,    setUsers]    = useState<UserResult[]>([]);
  const [trending, setTrending] = useState<TrendingItem[]>([]);
  const [reviewedTrackIds,  setReviewedTrackIds]  = useState<Set<string>>(new Set());
  const [reviewedAlbumIds,  setReviewedAlbumIds]  = useState<Set<string>>(new Set());
  const [reviewedArtistIds, setReviewedArtistIds] = useState<Set<string>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isPeople = scope === 4;

  useEffect(() => {
    if (!token) return;
    api.get('/reviews/mine').then((data: any[]) => {
      const tIds = new Set<string>(), aIds = new Set<string>(), arIds = new Set<string>();
      data.forEach(r => {
        if (r.type === 'artist' && r.spotifyArtistId) arIds.add(r.spotifyArtistId);
        else if (r.type === 'album' && r.spotifyAlbumId) aIds.add(r.spotifyAlbumId);
        else if (r.spotifyTrackId) tIds.add(r.spotifyTrackId);
      });
      setReviewedTrackIds(tIds); setReviewedAlbumIds(aIds); setReviewedArtistIds(arIds);
    }).catch(() => {});
    api.get('/reviews/trending?offset=0&limit=5')
      .then((d: any) => setTrending(d.items ?? []))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!q.trim() || !token) { setTracks([]); setAlbums([]); setArtists([]); setUsers([]); return; }
    const ctrl = new AbortController();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        if (isPeople) {
          const d = await api.get(`/users/search?q=${encodeURIComponent(q)}`, ctrl.signal);
          setUsers(d);
        } else {
          const d = await api.get(`/search?q=${encodeURIComponent(q)}&type=${TYPE_MAP[scope]}`, ctrl.signal);
          setTracks(d.tracks?.items ?? []); setAlbums(d.albums?.items ?? []); setArtists(d.artists?.items ?? []); setUsers([]);
        }
      } catch (e: any) { if (e.name === 'AbortError') return; }
      finally { setLoading(false); }
    }, 400);
    return () => { ctrl.abort(); if (timer.current) clearTimeout(timer.current); };
  }, [q, scope, token]);

  function navTrending(item: TrendingItem) {
    if (item.type === 'artist' && item.spotifyArtistId) nav(`/artist/${item.spotifyArtistId}`);
    else if (item.type === 'album' && item.spotifyAlbumId) nav(`/album/${item.spotifyAlbumId}`);
    else if (item.spotifyTrackId) nav(`/song/${item.spotifyTrackId}`);
  }

  const hasResults = tracks.length > 0 || albums.length > 0 || artists.length > 0;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-white/8 sticky top-0 z-10 flex flex-col gap-2" style={{ background: 'rgba(11,8,22,0.92)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/15 bg-white/6">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A7FAC" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={isPeople ? 'Search people by name' : 'Search songs, albums, artists'}
            className="flex-1 text-[14px] text-fg bg-transparent outline-none"
            autoFocus
          />
          {q && <button onClick={() => setQ('')} className="text-fg3 cursor-pointer text-lg leading-none">✕</button>}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
          {SCOPES.map((sc, i) => (
            <button
              key={sc}
              onClick={() => setScope(i)}
              className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide border shrink-0 cursor-pointer transition-all"
              style={{
                borderColor: i === scope ? 'rgba(177,78,255,0.5)' : 'rgba(255,255,255,0.08)',
                background:  i === scope ? 'rgba(177,78,255,0.15)' : 'rgba(255,255,255,0.04)',
                color:       i === scope ? '#B14EFF' : '#8A7FAC',
              }}
            >
              {sc}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-20 md:pb-4 px-4 py-4 max-w-2xl mx-auto w-full">
        {loading && <div className="flex justify-center pt-12"><Spinner /></div>}

        {/* Empty: trending */}
        {!loading && !q && !isPeople && trending.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-fg3 mb-1">🔥 Trending now</p>
            {trending.map((item, i) => (
              <button key={item._id} onClick={() => navTrending(item)} className="flex items-center gap-3 p-2.5 rounded-xl border border-white/10 bg-white/4 hover:bg-white/8 transition-colors cursor-pointer text-left w-full">
                <span className="text-[13px] font-bold w-6 text-center" style={{ color: i === 0 ? '#B14EFF' : '#5A4F78' }}>{i + 1}</span>
                {item.albumArt
                  ? <img src={item.albumArt} alt="" className="w-10 h-10 rounded-lg object-cover" />
                  : <div className="w-10 h-10 rounded-lg bg-white/8" />}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-fg truncate">{item.trackName}</p>
                  <p className="text-[11px] text-fg3 truncate">{item.artistName}</p>
                </div>
                <span className="text-[16px] font-bold tabular-nums shrink-0" style={{ color: scoreColor(item.score) }}>{item.score.toFixed(1)}</span>
              </button>
            ))}
          </div>
        )}

        {!loading && !q && isPeople && (
          <div className="flex flex-col items-center gap-3 pt-12 text-fg3"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><p>Find people to follow</p></div>
        )}

        {!loading && !!q && !hasResults && !isPeople && (
          <p className="text-center text-fg3 pt-12 text-[13px]">No results for "{q}"</p>
        )}

        {/* People */}
        {!loading && isPeople && users.map(u => (
          <UserRow key={u._id} user={u} myId={spotifyId!} nav={nav} />
        ))}

        {/* Songs */}
        {!loading && !isPeople && (scope === 0 || scope === 1) && tracks.map(t => {
          const reviewed = reviewedTrackIds.has(t.id);
          return (
            <MusicRow
              key={t.id}
              img={t.album?.images?.[2]?.url}
              title={t.name}
              sub={t.artists.map(a => a.name).join(', ')}
              reviewed={reviewed}
              onPress={() => nav(`/song/${t.id}`)}
              onRate={() => setItem({ type: 'track', spotifyTrackId: t.id, trackName: t.name, artistName: t.artists[0]?.name ?? '', albumArt: t.album?.images?.[1]?.url ?? '' })}
            />
          );
        })}

        {/* Albums */}
        {!loading && !isPeople && (scope === 0 || scope === 2) && albums.map(a => {
          const reviewed = reviewedAlbumIds.has(a.id);
          return (
            <MusicRow
              key={a.id}
              img={a.images?.[2]?.url}
              title={a.name}
              sub={a.artists?.map(ar => ar.name).join(', ')}
              reviewed={reviewed}
              onPress={() => nav(`/album/${a.id}`)}
              onRate={() => setItem({ type: 'album', spotifyAlbumId: a.id, trackName: a.name, artistName: a.artists?.[0]?.name ?? '', albumArt: a.images?.[1]?.url ?? '' })}
            />
          );
        })}

        {/* Artists */}
        {!loading && !isPeople && (scope === 0 || scope === 3) && artists.map(a => {
          const reviewed = reviewedArtistIds.has(a.id);
          return (
            <MusicRow
              key={a.id}
              img={a.images?.[2]?.url}
              title={a.name}
              sub={a.genres?.[0] ?? ''}
              circle
              reviewed={reviewed}
              onPress={() => nav(`/artist/${a.id}`)}
              onRate={() => setItem({ type: 'artist', spotifyArtistId: a.id, trackName: a.name, artistName: a.name, albumArt: a.images?.[1]?.url ?? '' })}
            />
          );
        })}
      </div>
    </div>
  );
}

function MusicRow({ img, title, sub, reviewed, onPress, onRate, circle }: {
  img?: string; title: string; sub: string; reviewed: boolean;
  onPress: () => void; onRate: () => void; circle?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl border border-white/10 bg-white/4 hover:bg-white/8 transition-colors mb-2">
      <button onClick={onPress} className="cursor-pointer shrink-0">
        {img
          ? <img src={img} alt="" className={`w-11 h-11 object-cover ${circle ? 'rounded-full' : 'rounded-lg'}`} />
          : <div className={`w-11 h-11 bg-white/8 ${circle ? 'rounded-full' : 'rounded-lg'}`} />}
      </button>
      <button onClick={onPress} className="flex-1 min-w-0 text-left cursor-pointer">
        <p className="text-[13px] font-semibold text-fg truncate">{title}</p>
        {sub && <p className="text-[11px] text-fg3 truncate">{sub}</p>}
      </button>
      {reviewed && <span className="text-[10px] font-bold text-violet border border-violet/40 bg-violet/15 px-2 py-0.5 rounded-full shrink-0">Reviewed</span>}
      <button onClick={onRate} className="shrink-0 text-[11px] font-semibold text-fg3 border border-white/10 px-2.5 py-1 rounded-full hover:border-violet hover:text-violet transition-colors cursor-pointer">
        Rate
      </button>
    </div>
  );
}

function UserRow({ user, myId, nav }: { user: UserResult; myId: string; nav: (p: string) => void }) {
  const [following, setFollowing] = useState(user.isFollowing);
  const [busy, setBusy] = useState(false);
  const isOwn = user.spotifyId === myId;

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      if (following) { await api.del(`/users/${user.spotifyId}/follow`); setFollowing(false); }
      else { await api.post(`/users/${user.spotifyId}/follow`, {}); setFollowing(true); }
    } catch {} finally { setBusy(false); }
  }

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl border border-white/10 bg-white/4 hover:bg-white/8 transition-colors mb-2">
      <button onClick={() => nav(`/profile/${user.spotifyId}`)} className="cursor-pointer">
        <Avatar name={user.displayName} src={user.avatarUrl} size={44} />
      </button>
      <button onClick={() => nav(`/profile/${user.spotifyId}`)} className="flex-1 text-left cursor-pointer min-w-0">
        <p className="text-[13px] font-semibold text-fg truncate">{user.displayName}</p>
        <p className="text-[11px] text-fg3 truncate">@{user.spotifyId}</p>
      </button>
      {!isOwn && (
        <button
          onClick={toggle}
          disabled={busy}
          className="px-3 py-1.5 rounded-full text-[12px] font-semibold cursor-pointer transition-all"
          style={{
            background:  following ? 'transparent' : '#B14EFF',
            color:       following ? '#B14EFF' : '#fff',
            border:      `1px solid #B14EFF`,
          }}
        >
          {busy ? '…' : following ? 'Following' : 'Follow'}
        </button>
      )}
    </div>
  );
}

function Spinner() {
  return <div className="w-8 h-8 border-2 border-violet/30 border-t-violet rounded-full animate-spin" />;
}
