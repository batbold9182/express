import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Avatar } from './Avatar';
import { api } from '../lib/api';
import { invalidate, queryClient, mutationMessage } from '../queries/client';
import { patchReviewInFeeds } from '../queries/feed';
import { withCommentLike } from '../queries/feedPatches';
import { afterLikeOrComment } from '../queries/invalidation';
import { timeAgo, MAX_COMMENT_LENGTH } from '@tunelog/shared';
import type { Comment } from '@tunelog/shared';
import { useAuth } from '../context/auth';
import { HeartIcon } from './icons';

type Props = { reviewId: string; comments: Comment[]; myId: string };

// The three comment-mutation endpoints (POST / PUT / DELETE) all return the full, populated
// comments array. That array replaces the review's `comments` in the cached feed, so `comments` here
// is always what the cache says — there is no copy in component state to go stale when the feed
// refreshes. Threads are one level deep: a reply to a reply attaches to the thread root, matching
// the mobile CommentSection.

const authorName   = (c: Comment) => (c.userId as { displayName?: string })?.displayName ?? '?';
const authorId     = (c: Comment) => (c.userId as { _id?: string })?._id;
const authorAvatar = (c: Comment) => (c.userId as { avatarUrl?: string })?.avatarUrl;

/** Puts a review's new comments into the cached feed, and marks the feed out of date for its next mount. */
function applyComments(reviewId: string, updated: Comment[]) {
  patchReviewInFeeds(queryClient, reviewId, r => ({ ...r, comments: updated }));
  void invalidate(afterLikeOrComment());
}

export function CommentSection({ reviewId, comments, myId }: Props) {
  const { token } = useAuth();
  const [text,        setText]        = useState('');
  const [open,        setOpen]        = useState(false);
  const [replyingTo,  setReplyingTo]  = useState<Comment | null>(null); // thread root — drives parentId
  const [replyTarget, setReplyTarget] = useState<Comment | null>(null); // who was tapped — display only
  const inputRef = useRef<HTMLInputElement>(null);

  const topLevel   = comments.filter(c => !c.parentId);
  const repliesFor = (id: string) => comments.filter(c => c.parentId === id);

  // Posting: the draft is kept on failure and the message shows under the box (`meta.inline`).
  const sendMutation = useMutation({
    mutationFn: (body: { text: string; parentId?: string }) => api.post<Comment[]>(`/reviews/${reviewId}/comments`, body),
    meta: { inline: true },
    onSuccess: (updated) => {
      applyComments(reviewId, updated);
      setText('');
      setReplyingTo(null);
      setReplyTarget(null);
      setOpen(true);
    },
  });
  const sending = sendMutation.isPending;

  function send() {
    if (!text.trim() || sending || !token) return;
    const body: { text: string; parentId?: string } = { text: text.trim() };
    if (replyingTo) body.parentId = replyingTo._id;
    sendMutation.mutate(body);
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
          onChange={updated => applyComments(reviewId, updated)}
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
              onChange={e => { setText(e.target.value.slice(0, MAX_COMMENT_LENGTH)); if (sendMutation.isError) sendMutation.reset(); }}
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
          {sendMutation.isError && (
            <p role="alert" className="text-[11px]" style={{ color: '#E0685C' }}>{mutationMessage(sendMutation.error)}</p>
          )}
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
  const [showActions, setShowActions] = useState(false);
  const [editing,   setEditing]   = useState(false);
  const [editText,  setEditText]  = useState(comment.text);

  // Straight from the cached comment: a click edits the cache (below), and the row follows.
  const liked     = (comment.likes ?? []).includes(myId);
  const likeCount = (comment.likes ?? []).length;
  const isOwn = authorId(comment) === myId;

  const likeMutation = useMutation({
    mutationFn: (wasLiked: boolean) =>
      wasLiked
        ? api.del<{ likes: number }>(`/reviews/${reviewId}/comments/${comment._id}/like`)
        : api.post<{ likes: number }>(`/reviews/${reviewId}/comments/${comment._id}/like`, {}),
    onMutate: (wasLiked: boolean) => ({
      rollback: patchReviewInFeeds(queryClient, reviewId, r => ({
        ...r, comments: withCommentLike(r.comments, comment._id, myId, wasLiked),
      })),
    }),
    onError: (_error, _wasLiked, context) => context?.rollback(),   // and the global handler shows a toast
    onSuccess: () => { void invalidate(afterLikeOrComment()); },
  });

  const editMutation = useMutation({
    mutationFn: (newText: string) => api.put<Comment[]>(`/reviews/${reviewId}/comments/${comment._id}`, { text: newText }),
    meta: { inline: true },   // the editor stays open and shows the message
    onSuccess: (updated) => {
      onChange(updated);
      setEditing(false);
      setShowActions(false);
    },
  });
  const busy = editMutation.isPending;

  const removeMutation = useMutation({
    mutationFn: () => api.del<Comment[]>(`/reviews/${reviewId}/comments/${comment._id}`),
    onSuccess: (updated) => onChange(updated),   // a failure shows as a toast
  });

  function saveEdit() {
    if (!editText.trim() || busy) return;
    editMutation.mutate(editText.trim());
  }

  function startEdit() {
    editMutation.reset();
    setEditText(comment.text);   // start from what is there now
    setEditing(true);
    setShowActions(false);
  }

  function cancelEdit() {
    setEditing(false);
    setEditText(comment.text);
  }

  function remove() {
    if (removeMutation.isPending || !window.confirm('Delete this comment?')) return;
    removeMutation.mutate();
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
          <>
            <div className="flex gap-2 items-center">
              <input
                value={editText}
                onChange={e => { setEditText(e.target.value.slice(0, MAX_COMMENT_LENGTH)); if (editMutation.isError) editMutation.reset(); }}
                onKeyDown={e => {
                  if (e.key === 'Enter') saveEdit();
                  if (e.key === 'Escape') cancelEdit();
                }}
                autoFocus
                className="flex-1 bg-transparent text-[12px] text-fg border-b border-violet/60 outline-none py-0.5"
              />
              <button onClick={saveEdit} disabled={busy} className="text-[11px] font-semibold text-violet cursor-pointer disabled:opacity-50">Save</button>
              <button onClick={cancelEdit} className="text-fg3 hover:text-fg cursor-pointer text-xs">✕</button>
            </div>
            {editMutation.isError && (
              <p role="alert" className="text-[11px]" style={{ color: '#E0685C' }}>{mutationMessage(editMutation.error)}</p>
            )}
          </>
        ) : (
          <p className="text-[12px] text-fg2 break-words leading-snug">{comment.text}</p>
        )}

        {!editing && (
          <div className="flex items-center gap-3 mt-0.5">
            <button
              onClick={() => { if (!likeMutation.isPending) likeMutation.mutate(liked); }}
              className="flex items-center gap-1 text-[10px] cursor-pointer transition-colors"
              style={{ color: liked ? '#E0685C' : '#5C5142' }}
            >
              <HeartIcon size={12} filled={liked} />
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
            <button onClick={startEdit} className="text-violet cursor-pointer font-semibold">Edit</button>
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
