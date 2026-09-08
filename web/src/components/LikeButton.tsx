import { useState } from 'react';
import { api } from '../lib/api';
import { HeartIcon } from './icons';

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
      <HeartIcon size={14} filled={liked} />
      <span className="text-xs font-semibold">{count > 0 ? count : ''}</span>
    </button>
  );
}
