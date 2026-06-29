import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from './Avatar';
import { LikeButton } from './LikeButton';
import { CommentSection } from './CommentSection';
import { api } from '../lib/api';
import { timeAgo, scoreColor, MOOD_LIST } from '@tunelog/shared';
import type { FeedItem } from '@tunelog/shared';

const MOOD_COLOR = Object.fromEntries(MOOD_LIST.map(([m, c]) => [m, c]));

const TYPE_CFG: Record<string, { label: string; color: string }> = {
  album:  { label: 'Album',  color: '#00D9FF' },
  artist: { label: 'Artist', color: '#FF3FA4' },
  track:  { label: 'Track',  color: '#8A7FAC' },
};

type Props = { item: FeedItem; myId: string; onDelete: () => void };

export function ReviewCard({ item, myId, onDelete }: Props) {
  const nav = useNavigate();
  const cfg = TYPE_CFG[item.type ?? 'track'];

  const [showActions, setShowActions] = useState(false);
  const [editing,     setEditing]     = useState(false);
  const [editText,    setEditText]     = useState(item.text);
  const [editScore,   setEditScore]    = useState(item.score);
  const [editMoods,   setEditMoods]    = useState<string[]>(item.moods ?? []);
  const [dispText,    setDispText]     = useState(item.text);
  const [dispScore,   setDispScore]    = useState(item.score);
  const [dispMoods,   setDispMoods]    = useState<string[]>(item.moods ?? []);
  const [busy, setBusy] = useState(false);

  const isOwn = (item.userId as any)?._id?.toString() === myId;

  function navSubject() {
    if (item.type === 'artist' && item.spotifyArtistId) nav(`/artist/${item.spotifyArtistId}`);
    else if (item.type === 'album' && item.spotifyAlbumId) nav(`/album/${item.spotifyAlbumId}`);
    else if (item.spotifyTrackId) nav(`/song/${item.spotifyTrackId}`);
  }

  function toggleMood(m: string) {
    setEditMoods(prev => prev.includes(m) ? prev.filter(x => x !== m) : prev.length < 3 ? [...prev, m] : prev);
  }

  async function saveEdit() {
    if (busy) return;
    setBusy(true);
    try {
      await api.put(`/reviews/${item._id}`, { text: editText, score: editScore, moods: editMoods });
      setDispText(editText); setDispScore(editScore); setDispMoods(editMoods);
      setEditing(false); setShowActions(false);
    } catch {} finally { setBusy(false); }
  }

  async function doDelete() {
    if (!window.confirm('Delete this review?')) return;
    await api.del(`/reviews/${item._id}`);
    onDelete();
  }

  const spotifyUrl = item.type === 'artist' && item.spotifyArtistId
    ? `https://open.spotify.com/artist/${item.spotifyArtistId}`
    : item.type === 'album' && item.spotifyAlbumId
      ? `https://open.spotify.com/album/${item.spotifyAlbumId}`
      : item.spotifyTrackId
        ? `https://open.spotify.com/track/${item.spotifyTrackId}`
        : null;

  const glowColor = dispScore >= 8.5 ? scoreColor(dispScore) : null;
  const scoreCol  = scoreColor(dispScore);
  const commentCount = ((item as any).comments ?? []).length;

  return (
    <div
      className="rounded-2xl flex flex-col gap-3 border overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.05)',
        borderColor: glowColor ? `${glowColor}35` : 'rgba(255,255,255,0.07)',
        boxShadow: glowColor ? `0 0 24px ${glowColor}18` : undefined,
        borderLeft: `3px solid ${cfg.color}`,
      }}
    >
      {/* Inner padding wrapper */}
      <div className="flex flex-col gap-3 p-4">
        {/* Header: avatar + name + timestamp + menu */}
        <div className="flex items-center gap-2.5">
          <button onClick={() => nav(`/profile/${(item.userId as any)?.spotifyId}`)} className="cursor-pointer">
            <Avatar
              name={(item.userId as any)?.displayName || '?'}
              src={(item.userId as any)?.avatarUrl}
              size={34}
            />
          </button>
          <button onClick={() => nav(`/profile/${(item.userId as any)?.spotifyId}`)} className="flex-1 text-left cursor-pointer">
            <div className="text-[13px] font-bold text-fg">{(item.userId as any)?.displayName}</div>
            <div className="text-[11px] text-fg4">{timeAgo(item.createdAt)}</div>
          </button>
          {isOwn && (
            <button
              onClick={() => { setShowActions(v => !v); setEditing(false); }}
              className="p-1.5 rounded-lg text-fg3 hover:text-fg cursor-pointer text-lg leading-none"
            >
              ···
            </button>
          )}
        </div>

        {/* Actions menu */}
        {isOwn && showActions && !editing && (
          <div className="flex items-center gap-3 text-[12px] px-3 py-2 rounded-xl border border-white/10 bg-white/8 self-start">
            <button onClick={() => setEditing(true)} className="text-violet cursor-pointer font-semibold">Edit</button>
            <div className="w-px h-3 bg-white/15" />
            <button onClick={doDelete} className="text-red cursor-pointer font-semibold">Delete</button>
            <div className="w-px h-3 bg-white/15" />
            <button onClick={() => setShowActions(false)} className="text-fg3 cursor-pointer">Cancel</button>
          </div>
        )}

        {/* Edit mode */}
        {editing && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2 items-start rounded-xl border border-white/10 bg-white/5 p-2.5">
              <textarea
                value={editText}
                onChange={e => setEditText(e.target.value.slice(0, 280))}
                className="flex-1 text-[13px] text-fg bg-transparent resize-none outline-none min-h-[60px]"
                autoFocus
              />
              <div className="flex gap-2 shrink-0">
                <button onClick={saveEdit} disabled={busy} className="text-[12px] text-violet font-semibold cursor-pointer disabled:opacity-50">Save</button>
                <button onClick={() => { setEditing(false); setEditText(dispText); setEditScore(dispScore); setEditMoods(dispMoods); }} className="text-[12px] text-fg3 cursor-pointer">✕</button>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[11px] mb-1"><span className="text-fg3">Score</span><span className="font-semibold" style={{ color: scoreColor(editScore) }}>{editScore.toFixed(1)}</span></div>
              <input type="range" min={0} max={10} step={0.1} value={editScore} onChange={e => setEditScore(+e.target.value)} className="w-full accent-violet" />
            </div>
            <div>
              <div className="text-[11px] text-fg3 mb-2">Mood · pick up to 3 ({editMoods.length}/3)</div>
              <div className="flex flex-wrap gap-1.5">
                {MOOD_LIST.map(([m, mc]) => (
                  <button
                    key={m}
                    onClick={() => toggleMood(m)}
                    className="px-2.5 py-1 rounded-full text-[11px] font-semibold border cursor-pointer transition-all"
                    style={{
                      color: mc,
                      borderColor: editMoods.includes(m) ? mc : `${mc}40`,
                      background: editMoods.includes(m) ? `${mc}22` : 'transparent',
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Music info */}
        <div className="flex gap-3 items-center">
          {/* Album art */}
          <button onClick={navSubject} className="cursor-pointer shrink-0">
            {item.albumArt
              ? <img src={item.albumArt} alt="" className="w-14 h-14 rounded-xl border border-white/10 object-cover" />
              : <div className="w-14 h-14 rounded-xl bg-white/6 border border-white/8" />}
          </button>

          {/* Track info */}
          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <button onClick={navSubject} className="cursor-pointer text-left">
              <span className="text-[14px] font-semibold text-fg line-clamp-1">{item.trackName}</span>
            </button>
            {item.spotifyArtistId
              ? <button onClick={() => nav(`/artist/${item.spotifyArtistId}`)} className="text-[12px] text-violet cursor-pointer text-left truncate">{item.artistName} ›</button>
              : <span className="text-[12px] text-fg2 truncate">{item.artistName}</span>}
            <span className="text-[10px] font-bold mt-0.5 self-start px-2 py-0.5 rounded-full" style={{ color: cfg.color, background: `${cfg.color}25` }}>
              {cfg.label}
            </span>
          </div>

          {/* Score pill */}
          <button
            onClick={navSubject}
            className="cursor-pointer shrink-0 flex flex-col items-center justify-center rounded-xl px-3 py-2 border"
            style={{ background: `${scoreCol}12`, borderColor: `${scoreCol}35` }}
          >
            <span className="text-[20px] font-bold tabular-nums leading-none" style={{ color: scoreCol }}>{dispScore.toFixed(1)}</span>
          </button>
        </div>

        {/* Review text */}
        {!!dispText && <p className="text-[13px] text-fg2 leading-[1.65]">{dispText}</p>}

        {/* Moods */}
        {dispMoods.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {dispMoods.map(m => (
              <span key={m} className="text-[11px] font-semibold px-2.5 py-1 rounded-full border" style={{ color: MOOD_COLOR[m], borderColor: `${MOOD_COLOR[m]}50`, background: `${MOOD_COLOR[m]}18` }}>
                {m}
              </span>
            ))}
          </div>
        )}

        {/* Action row */}
        <div className="flex items-center gap-4 pt-0.5">
          <LikeButton reviewId={item._id} likes={(item as any).likes ?? []} myId={myId} />

          {commentCount > 0 && (
            <span className="flex items-center gap-1.5 text-[12px] text-fg3">
              <CommentIcon />
              {commentCount}
            </span>
          )}

          <div className="flex-1" />

          {spotifyUrl && (
            <a
              href={spotifyUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-[12px] font-semibold text-fg3 hover:text-fg transition-colors"
            >
              <SpotifyIcon />
              Open
            </a>
          )}
        </div>
      </div>

      {/* Comments — full width, no side padding */}
      <div className="border-t border-white/6 px-4 pb-4 pt-3">
        <CommentSection reviewId={item._id} initial={(item as any).comments ?? []} myId={myId} />
      </div>
    </div>
  );
}

function CommentIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

function SpotifyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  );
}
