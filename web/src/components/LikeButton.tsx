import { useState } from 'react';
import { api } from '../lib/api';

type Props = { reviewId: string; likes: string[]; myId: string };

export function LikeButton({ reviewId, likes, myId }: Props) {
  const [liked, setLiked]   = useState(likes.includes(myId));
  const [count, setCount]   = useState(likes.length);
  const [busy,  setBusy]    = useState(false);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const wasLiked = liked;
    setLiked(!wasLiked);
    setCount(c => wasLiked ? c - 1 : c + 1);
    try {
      if (wasLiked) {
        await api.del(`/reviews/${reviewId}/like`);
      } else {
        await api.post(`/reviews/${reviewId}/like`, {});
      }
    } catch {
      setLiked(wasLiked);
      setCount(c => wasLiked ? c + 1 : c - 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors cursor-pointer"
      style={{
        borderColor: liked ? 'rgba(224,104,92,0.5)' : 'rgba(255,255,255,0.08)',
        background:  liked ? 'rgba(224,104,92,0.12)' : 'transparent',
        color:       liked ? '#E0685C' : '#978A74',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
      <span className="text-xs font-semibold">{count > 0 ? count : ''}</span>
    </button>
  );
}
