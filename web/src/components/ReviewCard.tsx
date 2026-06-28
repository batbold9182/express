import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from './Avatar';
import { Score } from './Score';
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

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3 border"
      style={{
        background: 'rgba(255,255,255,0.06)',
        borderColor: glowColor ? `${glowColor}40` : 'rgba(255,255,255,0.08)',
        boxShadow: glowColor ? `0 0 20px ${glowColor}20` : undefined,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <button onClick={() => nav(`/profile/${(item.userId as any)?.spotifyId}`)} className="cursor-pointer">
          <Avatar
            name={(item.userId as any)?.displayName || '?'}
            src={(item.userId as any)?.avatarUrl}
            size={36}
          />
        </button>
        <button onClick={() => nav(`/profile/${(item.userId as any)?.spotifyId}`)} className="flex-1 text-left cursor-pointer">
          <div className="text-[13px] font-bold text-fg">{(item.userId as any)?.displayName}</div>
          <div className="text-[11px] text-fg4">{timeAgo(item.createdAt)}</div>
        </button>
        {isOwn && (
          <button
            onClick={() => { setShowActions(v => !v); setEditing(false); }}
            className="p-1.5 rounded-lg text-fg3 hover:text-fg cursor-pointer"
          >
            ···
          </button>
        )}
      </div>

      {/* Actions menu */}
      {isOwn && showActions && !editing && (
        <div className="flex items-center gap-3 text-[12px] px-3 py-2 rounded-xl border border-white/10 bg-white/10 self-start">
          <button onClick={() => setEditing(true)} className="text-violet cursor-pointer font-medium">Edit</button>
          <div className="w-px h-3 bg-white/15" />
          <button onClick={doDelete} className="text-red cursor-pointer font-medium">Delete</button>
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
        <button onClick={navSubject} className="cursor-pointer shrink-0">
          {item.albumArt
            ? <img src={item.albumArt} alt="" className="w-[76px] h-[76px] rounded-xl border border-white/10 object-cover" />
            : <div className="w-[76px] h-[76px] rounded-xl bg-white/6 border border-white/8" />}
        </button>
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <button onClick={navSubject} className="flex items-center gap-2 cursor-pointer text-left">
            <span className="text-[14px] font-semibold text-fg flex-1 truncate">{item.trackName}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ color: cfg.color, background: `${cfg.color}30` }}>
              {cfg.label}
            </span>
          </button>
          {item.spotifyArtistId
            ? <button onClick={() => nav(`/artist/${item.spotifyArtistId}`)} className="text-[12px] text-violet cursor-pointer text-left truncate">{item.artistName} ›</button>
            : <span className="text-[12px] text-fg2 truncate">{item.artistName}</span>}
        </div>
        <button onClick={navSubject} className="cursor-pointer shrink-0 px-2 py-1 rounded-full" style={{ background: `${scoreColor(dispScore)}1A` }}>
          <Score value={dispScore} size="md" />
        </button>
      </div>

      {/* Review text */}
      {!!dispText && <p className="text-[13px] text-fg2 leading-[1.6] m-0">{dispText}</p>}

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

      {/* Actions row */}
      <div className="flex items-center gap-2">
        {spotifyUrl && (
          <>
            <a
              href={spotifyUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-full border text-[12px] font-bold transition-opacity hover:opacity-80"
              style={{ color: '#1DB954', borderColor: '#1DB954' }}
            >
              Spotify
            </a>
            <div className="flex-1" />
          </>
        )}
        <LikeButton reviewId={item._id} likes={(item as any).likes ?? []} myId={myId} />
      </div>

      {/* Divider */}
      <div className="border-t border-white/8 -mx-4" />

      <CommentSection reviewId={item._id} initial={(item as any).comments ?? []} myId={myId} />
    </div>
  );
}
