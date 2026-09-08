import { useState, useRef } from 'react';
import { Avatar } from './Avatar';
import { api } from '../lib/api';
import { timeAgo, MAX_COMMENT_LENGTH } from '@tunelog/shared';
import type { Comment } from '@tunelog/shared';
import { useAuth } from '../context/auth';

type Props = { reviewId: string; initial: Comment[]; myId: string };

// The three comment-mutation endpoints (POST / PUT / DELETE) all return the full, populated
// comments array — so every write does `setComments(res)`, never a splice. Threads are one level
// deep: a reply to a reply attaches to the thread root, matching the mobile CommentSection.

const authorName   = (c: Comment) => (c.userId as { displayName?: string })?.displayName ?? '?';
const authorId     = (c: Comment) => (c.userId as { _id?: string })?._id;
const authorAvatar = (c: Comment) => (c.userId as { avatarUrl?: string })?.avatarUrl;

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

export function CommentSection({ reviewId, initial, myId }: Props) {
  const { token } = useAuth();
  const [comments,    setComments]    = useState<Comment[]>(initial);
  const [text,        setText]        = useState('');
  const [open,        setOpen]        = useState(false);
  const [sending,     setSending]     = useState(false);
  const [replyingTo,  setReplyingTo]  = useState<Comment | null>(null); // thread root — drives parentId
  const [replyTarget, setReplyTarget] = useState<Comment | null>(null); // who was tapped — display only
  const inputRef = useRef<HTMLInputElement>(null);

  const topLevel   = comments.filter(c => !c.parentId);
  const repliesFor = (id: string) => comments.filter(c => c.parentId === id);

  async function send() {
    if (!text.trim() || sending || !token) return;
    setSending(true);
    try {
      const body: { text: string; parentId?: string } = { text: text.trim() };
      if (replyingTo) body.parentId = replyingTo._id;
      const updated = await api.post<Comment[]>(`/reviews/${reviewId}/comments`, body);
      setComments(updated);
      setText('');
      setReplyingTo(null);
      setReplyTarget(null);
      setOpen(true);
    } catch {
      /* keep the draft so the user can retry */
    } finally {
      setSending(false);
    }
  }

  function startReply(target: Comment) {
    // Thread stays one level deep — a reply to a reply still attaches to the root comment.
    const root = target.parentId
      ? comments.find(c => c._id === target.parentId) ?? target
      : target;
    setReplyingTo(root);
    setReplyTarget(target);
    setText(`@${authorName(target)} `);
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function cancelReply() {
    setReplyingTo(null);
    setReplyTarget(null);
    setText('');
  }

  const visibleThreads = open ? topLevel : topLevel.slice(0, 2);
  const hiddenCount    = topLevel.length - 2;
  const remaining      = MAX_COMMENT_LENGTH - text.length;

  return (
    <div className="flex flex-col gap-2">
      {visibleThreads.map(c => (
        <Thread
          key={c._id}
          comment={c}
          replies={repliesFor(c._id)}
          reviewId={reviewId}
          myId={myId}
          onChange={setComments}
          onReply={startReply}
        />
      ))}

      {!open && hiddenCount > 0 && (
        <button onClick={() => setOpen(true)} className="text-[11px] text-fg3 hover:text-violet cursor-pointer text-left">
          Show {hiddenCount} more comment{hiddenCount > 1 ? 's' : ''}
        </button>
      )}

      {token && (
        <div className="flex flex-col gap-1.5 mt-1">
          {replyTarget && (
            <div className="flex items-center justify-between text-[11px] text-fg3 bg-violet/10 border border-violet/20 rounded-lg px-2.5 py-1">
              <span>Replying to <span className="text-violet font-semibold">@{authorName(replyTarget)}</span></span>
              <button onClick={cancelReply} className="text-fg3 hover:text-fg cursor-pointer text-sm leading-none">✕</button>
            </div>
          )}
          <div className="flex gap-2 items-center">
            <input
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value.slice(0, MAX_COMMENT_LENGTH))}
              onKeyDown={e => { if (e.key === 'Enter') send(); }}
              placeholder={replyTarget ? `Reply to @${authorName(replyTarget)}…` : 'Add a comment…'}
              className="flex-1 bg-transparent text-[12px] text-fg placeholder:text-fg4 border-b border-white/10 focus:border-violet outline-none py-1 transition-colors"
            />
            {remaining <= 80 && (
              <span className={`text-[10px] shrink-0 ${remaining <= 20 ? 'text-pink' : 'text-fg4'}`}>{remaining}</span>
            )}
            {text.trim() && (
              <button
                onClick={send}
                disabled={sending}
                className="text-[11px] font-semibold text-violet cursor-pointer disabled:opacity-50 shrink-0"
              >
                {replyTarget ? 'Reply' : 'Post'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Thread({ comment, replies, reviewId, myId, onChange, onReply }: {
  comment: Comment;
  replies: Comment[];
  reviewId: string;
  myId: string;
  onChange: (comments: Comment[]) => void;
  onReply: (c: Comment) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <Row comment={comment} reviewId={reviewId} myId={myId} onChange={onChange} onReply={onReply} />

      {replies.length > 0 && (
        <div className="ml-8 flex flex-col gap-1.5">
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-2 text-[11px] font-semibold text-fg3 hover:text-fg2 cursor-pointer self-start"
          >
            <span className="w-5 h-px bg-white/15" />
            {expanded ? 'Hide replies' : `View ${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`}
          </button>
          {expanded && replies.map(r => (
            <Row key={r._id} comment={r} reviewId={reviewId} myId={myId} onChange={onChange} onReply={onReply} isReply />
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ comment, reviewId, myId, onChange, onReply, isReply = false }: {
  comment: Comment;
  reviewId: string;
  myId: string;
  onChange: (comments: Comment[]) => void;
  onReply: (c: Comment) => void;
  isReply?: boolean;
}) {
  const [liked,     setLiked]     = useState((comment.likes ?? []).includes(myId));
  const [likeCount, setLikeCount] = useState((comment.likes ?? []).length);
  const [likeBusy,  setLikeBusy]  = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [editing,   setEditing]   = useState(false);
  const [editText,  setEditText]  = useState(comment.text);
  const [busy,      setBusy]      = useState(false);

  const isOwn = authorId(comment) === myId;

  async function toggleLike() {
    if (likeBusy) return;
    setLikeBusy(true);
    const was = liked;
    setLiked(!was);
    setLikeCount(n => (was ? n - 1 : n + 1));
    try {
      const res = was
        ? await api.del<{ likes: number }>(`/reviews/${reviewId}/comments/${comment._id}/like`)
        : await api.post<{ likes: number }>(`/reviews/${reviewId}/comments/${comment._id}/like`, {});
      setLikeCount(res.likes);
    } catch {
      setLiked(was);
      setLikeCount(n => (was ? n + 1 : n - 1));
    } finally {
      setLikeBusy(false);
    }
  }

  async function saveEdit() {
    if (!editText.trim() || busy) return;
    setBusy(true);
    try {
      const updated = await api.put<Comment[]>(`/reviews/${reviewId}/comments/${comment._id}`, { text: editText.trim() });
      onChange(updated);
      setEditing(false);
      setShowActions(false);
    } catch {
      /* leave the editor open on failure */
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm('Delete this comment?')) return;
    try {
      const updated = await api.del<Comment[]>(`/reviews/${reviewId}/comments/${comment._id}`);
      onChange(updated);
    } catch { /* ignore */ }
  }

  return (
    <div className="flex gap-2 items-start">
      <Avatar name={authorName(comment)} src={authorAvatar(comment)} size={isReply ? 22 : 26} />
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[11px] font-bold text-fg">{authorName(comment)}</span>
          <span className="text-[10px] text-fg4">{timeAgo(comment.createdAt)}</span>
        </div>

        {editing ? (
          <div className="flex gap-2 items-center">
            <input
              value={editText}
              onChange={e => setEditText(e.target.value.slice(0, MAX_COMMENT_LENGTH))}
              onKeyDown={e => {
                if (e.key === 'Enter') saveEdit();
                if (e.key === 'Escape') { setEditing(false); setEditText(comment.text); }
              }}
              autoFocus
              className="flex-1 bg-transparent text-[12px] text-fg border-b border-violet/60 outline-none py-0.5"
            />
            <button onClick={saveEdit} disabled={busy} className="text-[11px] font-semibold text-violet cursor-pointer disabled:opacity-50">Save</button>
            <button onClick={() => { setEditing(false); setEditText(comment.text); }} className="text-fg3 hover:text-fg cursor-pointer text-xs">✕</button>
          </div>
        ) : (
          <p className="text-[12px] text-fg2 break-words leading-snug">{comment.text}</p>
        )}

        {!editing && (
          <div className="flex items-center gap-3 mt-0.5">
            <button
              onClick={toggleLike}
              className="flex items-center gap-1 text-[10px] cursor-pointer transition-colors"
              style={{ color: liked ? '#E0685C' : '#5C5142' }}
            >
              <HeartIcon filled={liked} />
              {likeCount > 0 && likeCount}
            </button>
            <button onClick={() => onReply(comment)} className="text-[10px] font-semibold text-fg4 hover:text-violet cursor-pointer">
              Reply
            </button>
            {isOwn && (
              <button onClick={() => setShowActions(v => !v)} className="text-[10px] text-fg4 hover:text-fg2 cursor-pointer leading-none">···</button>
            )}
          </div>
        )}

        {isOwn && showActions && !editing && (
          <div className="flex items-center gap-3 text-[11px] px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/8 self-start mt-1">
            <button onClick={() => { setEditing(true); setShowActions(false); }} className="text-violet cursor-pointer font-semibold">Edit</button>
            <span className="w-px h-3 bg-white/15" />
            <button onClick={remove} className="text-red cursor-pointer font-semibold">Delete</button>
            <span className="w-px h-3 bg-white/15" />
            <button onClick={() => setShowActions(false)} className="text-fg3 cursor-pointer">Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}
