import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/auth';
import { useRate } from '../context/rate';
import { Avatar } from '../components/Avatar';
import { scoreColor, subjectPath } from '@tunelog/shared';
import { SearchIcon, FlameIcon } from '../components/icons';
import { Spinner } from '../components/Spinner';
import { ErrorState } from '../components/ErrorState';
import { useLeaderboard, type LeaderboardItem } from '../queries/leaderboard';
import { useMyReviews } from '../queries/reviews';
import { reviewedIds } from '../queries/reviewedIds';
import { useCatalogSearch, useUserSearch, type UserResult } from '../queries/search';
import { useFollow } from '../queries/users';
import { resolveChoice, type Choice } from '../queries/toggle';

const SCOPES   = ['All', 'Songs', 'Albums', 'Artists', 'People'];
const TYPE_MAP = ['track,album,artist', 'track', 'album', 'artist'];
const DEBOUNCE_MS = 400;

export default function Search() {
  const nav = useNavigate();
  const { spotifyId } = useAuth();
  const { setItem } = useRate();

  const [q,           setQ]           = useState('');
  const [debouncedQ,  setDebouncedQ]  = useState('');
  const [scope,       setScope]       = useState(0);

  const isPeople = scope === 4;
  const typed = q.trim();

  // The request follows the text after a pause, not every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(typed), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [typed]);

  // Both searches are always called (hooks can't be conditional); only the one for this scope runs.
  const catalog = useCatalogSearch(TYPE_MAP[scope] ?? TYPE_MAP[0], debouncedQ, !isPeople);
  const people  = useUserSearch(debouncedQ, isPeople);
  const active  = isPeople ? people : catalog;

  const { data: mine } = useMyReviews();
  const reviewed = useMemo(() => reviewedIds(mine ?? []), [mine]);
  const { data: trending = [] } = useLeaderboard('most-rated', 5);

  const tracks  = catalog.data?.tracks?.items  ?? [];
  const albums  = catalog.data?.albums?.items  ?? [];
  const artists = catalog.data?.artists?.items ?? [];
  const users   = people.data ?? [];
  const hasResults = isPeople ? users.length > 0 : tracks.length + albums.length + artists.length > 0;

  // What the screen shows for non-empty text. Previous results stay up (dimmed) while the next ones
  // load, so the list is replaced, not blanked — and "No results" can only mean the answer for the
  // text currently in the box came back empty.
  const waiting       = typed !== '' && typed !== debouncedQ;   // still inside the pause before the request
  const hasData       = active.data !== undefined;
  const showSpinner   = typed !== '' && !active.isError && !hasData;
  const showError     = typed !== '' && active.isError && !waiting;
  const showResults   = typed !== '' && hasData;
  const stale         = showResults && (waiting || active.isPlaceholderData);
  const showNoResults = showResults && !stale && !hasResults;

  function navTrending(item: LeaderboardItem) {
    const p = subjectPath(item);
    if (p) nav(p);
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-white/8 sticky top-0 z-10 flex flex-col gap-2" style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/15 bg-white/6">
          <SearchIcon size={16} stroke="#978A74" caps={false} />
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
                borderColor: i === scope ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.08)',
                background:  i === scope ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.04)',
                color:       i === scope ? '#FFFFFF' : '#978A74',
              }}
            >
              {sc}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-20 md:pb-4 px-4 py-4 max-w-2xl mx-auto w-full">
        {showSpinner && <div className="flex justify-center pt-12"><Spinner /></div>}

        {showError && (
          <ErrorState
            size="compact"
            title="Search failed"
            error={active.error}
            onRetry={() => void active.refetch()}
          />
        )}

        {/* Empty: trending */}
        {!typed && !isPeople && trending.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-fg3 mb-1">
              <FlameIcon size={13} className="text-pink" /> Trending now
            </p>
            {trending.map((item, i) => (
              <button key={`${item.type}-${item.spotifyTrackId ?? item.spotifyAlbumId ?? item.spotifyArtistId}`} onClick={() => navTrending(item)} className="flex items-center gap-3 p-2.5 rounded-xl border border-white/10 bg-white/4 hover:bg-white/8 transition-colors cursor-pointer text-left w-full">
                <span className="text-[13px] font-bold w-6 text-center" style={{ color: i === 0 ? '#FFFFFF' : '#5C5142' }}>{i + 1}</span>
                {item.albumArt
                  ? <img src={item.albumArt} alt="" className="w-10 h-10 rounded-lg object-cover" />
                  : <div className="w-10 h-10 rounded-lg bg-white/8" />}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-fg truncate">{item.trackName}</p>
                  <p className="text-[11px] text-fg3 truncate">{item.artistName}</p>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <span className="text-[16px] font-bold tabular-nums" style={{ color: scoreColor(item.avgScore) }}>{item.avgScore.toFixed(1)}</span>
                  <span className="text-[10px] text-fg4">{item.reviewCount} {item.reviewCount === 1 ? 'review' : 'reviews'}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {!typed && isPeople && (
          <div className="flex flex-col items-center gap-3 pt-12 text-fg3"><SearchIcon size={32} strokeWidth={1.5} caps={false} /><p>Find people to follow</p></div>
        )}

        {showNoResults && (
          <p className="text-center text-fg3 pt-12 text-[13px]">
            {isPeople ? `No people found for "${typed}"` : `No results for "${typed}"`}
          </p>
        )}

        {showResults && (
          <div className={`transition-opacity ${stale ? 'opacity-60' : ''}`}>
            {/* People */}
            {isPeople && users.map(u => (
              <UserRow key={u._id} user={u} myId={spotifyId!} nav={nav} />
            ))}

            {/* Songs */}
            {!isPeople && (scope === 0 || scope === 1) && tracks.map(t => {
              const isReviewed = reviewed.tracks.has(t.id);
              return (
                <MusicRow
                  key={t.id}
                  img={t.album?.images?.[2]?.url}
                  title={t.name}
                  sub={t.artists.map(a => a.name).join(', ')}
                  reviewed={isReviewed}
                  onPress={() => nav(`/song/${t.id}`)}
                  onRate={() => setItem({ type: 'track', spotifyTrackId: t.id, trackName: t.name, artistName: t.artists[0]?.name ?? '', albumArt: t.album?.images?.[1]?.url ?? '' })}
                />
              );
            })}

            {/* Albums */}
            {!isPeople && (scope === 0 || scope === 2) && albums.map(a => {
              const isReviewed = reviewed.albums.has(a.id);
              return (
                <MusicRow
                  key={a.id}
                  img={a.images?.[2]?.url}
                  title={a.name}
                  sub={a.artists?.map(ar => ar.name).join(', ')}
                  reviewed={isReviewed}
                  onPress={() => nav(`/album/${a.id}`)}
                  onRate={() => setItem({ type: 'album', spotifyAlbumId: a.id, trackName: a.name, artistName: a.artists?.[0]?.name ?? '', albumArt: a.images?.[1]?.url ?? '' })}
                />
              );
            })}

            {/* Artists */}
            {!isPeople && (scope === 0 || scope === 3) && artists.map(a => {
              const isReviewed = reviewed.artists.has(a.id);
              return (
                <MusicRow
                  key={a.id}
                  img={a.images?.[2]?.url}
                  title={a.name}
                  sub={a.genres?.[0] ?? ''}
                  circle
                  reviewed={isReviewed}
                  onPress={() => nav(`/artist/${a.id}`)}
                  onRate={() => setItem({ type: 'artist', spotifyArtistId: a.id, trackName: a.name, artistName: a.name, albumArt: a.images?.[1]?.url ?? '' })}
                />
              );
            })}
          </div>
        )}
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
  // Not `useState(user.isFollowing)`: results come from a cache that refreshes in the background, and
  // a value copied once would ignore that refresh and keep showing the old button. The user's click
  // wins only until the data says something different (see `resolveChoice`).
  const [choice, setChoice] = useState<Choice<boolean> | null>(null);
  const followMutation = useFollow();
  const busy = followMutation.isPending;
  const following = resolveChoice(user.isFollowing, choice);
  const isOwn = user.spotifyId === myId;

  // A failed request leaves the button as it was and shows a toast (the mutation's default). On success
  // `useFollow` marks cached people-search results stale, so searching this name again can't show the old button.
  function toggle() {
    if (busy) return;
    const from = user.isFollowing;
    followMutation.mutate({ userId: user.spotifyId, following }, { onSuccess: () => setChoice({ from, to: !following }) });
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
          className="px-3 py-1.5 rounded-full text-[12px] font-semibold cursor-pointer transition-all disabled:opacity-50"
          style={{
            background:  following ? 'transparent' : '#FFFFFF',
            color:       following ? '#FFFFFF' : '#0A0A0A',
            border:      '1px solid #FFFFFF',
          }}
        >
          {busy ? '…' : following ? 'Following' : 'Follow'}
        </button>
      )}
    </div>
  );
}
