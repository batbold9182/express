import { useState, useRef } from 'react';
import { Avatar } from './Avatar';
import { api } from '../lib/api';
import { timeAgo } from '@tunelog/shared';
import type { Comment } from '@tunelog/shared';
import { useAuth } from '../context/auth';

type Props = { reviewId: string; initial: Comment[]; myId: string };

export function CommentSection({ reviewId, initial, myId }: Props) {
  const { token } = useAuth();
  const [comments, setComments] = useState<Comment[]>(initial);
  const [text, setText]         = useState('');
  const [open, setOpen]         = useState(false);
  const [sending, setSending]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function send() {
    if (!text.trim() || sending || !token) return;
    setSending(true);
    try {
      const c = await api.post(`/reviews/${reviewId}/comments`, { text: text.trim() });
      setComments(prev => [...prev, c]);
      setText('');
    } catch {} finally { setSending(false); }
  }

  async function deleteComment(commentId: string) {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await api.del(`/reviews/${reviewId}/comments/${commentId}`);
      setComments(prev => prev.filter(c => c._id !== commentId));
    } catch {}
  }

  const visible = open ? comments : comments.slice(0, 2);
  const hidden  = comments.length - 2;

  return (
    <div className="flex flex-col gap-2">
      {visible.map(c => (
        <div key={c._id} className="flex gap-2 items-start">
          <Avatar
            name={(c.userId as any)?.displayName || '?'}
            src={(c.userId as any)?.avatarUrl}
            size={26}
          />
          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-bold text-fg mr-1.5">
              {(c.userId as any)?.displayName}
            </span>
            <span className="text-[12px] text-fg2 break-words">{c.text}</span>
          </div>
          <span className="text-[10px] text-fg4 shrink-0">{timeAgo(c.createdAt)}</span>
          {(c.userId as any)?._id === myId && (
            <button onClick={() => deleteComment(c._id)} className="text-[10px] text-fg4 hover:text-red cursor-pointer ml-1">✕</button>
          )}
        </div>
      ))}

      {!open && hidden > 0 && (
        <button onClick={() => setOpen(true)} className="text-[11px] text-fg3 hover:text-violet cursor-pointer text-left">
          Show {hidden} more comment{hidden > 1 ? 's' : ''}
        </button>
      )}

      {token && (
        <div className="flex gap-2 items-center mt-1">
          <input
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value.slice(0, 200))}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Add a comment…"
            className="flex-1 bg-transparent text-[12px] text-fg placeholder:text-fg4 border-b border-white/10 focus:border-violet outline-none py-1 transition-colors"
          />
          {text && (
            <button
              onClick={send}
              disabled={sending}
              className="text-[11px] font-semibold text-violet cursor-pointer disabled:opacity-50"
            >
              Post
            </button>
          )}
        </div>
      )}
    </div>
  );
}
