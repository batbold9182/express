import React, { useState, useRef } from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { Icon } from '../../components';
import { C } from '../../theme';
import { api } from '../../lib/api';

type Props = { reviewId: string; likes: string[]; token: string; myId: string };

export function LikeButton({ reviewId, likes, token, myId }: Props) {
  const initLiked = likes.includes(myId);
  const [liked, setLiked] = useState(initLiked);
  const [count, setCount] = useState(likes.length);

  const syncedRef  = useRef(initLiked);   // last state the server confirmed
  const likedRef   = useRef(initLiked);   // latest display state for debounce closure
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  function toggle() {
    const next = !likedRef.current;
    likedRef.current = next;
    setLiked(next);
    setCount(c => next ? c + 1 : c - 1);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const target = likedRef.current;
      if (target === syncedRef.current) return; // net no-op, skip API
      try {
        if (target) await api.post(`/reviews/${reviewId}/like`, token, {});
        else        await api.del(`/reviews/${reviewId}/like`, token);
        syncedRef.current = target;
      } catch {
        const revert = syncedRef.current;
        likedRef.current = revert;
        setLiked(revert);
        setCount(c => revert ? c + 1 : c - 1);
      }
    }, 400);
  }

  return (
    <TouchableOpacity onPress={toggle} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Icon name="heart" size={16} color={liked ? C.pink : C.fg3} />
      {count > 0 && <Text style={{ fontSize: 11, color: liked ? C.pink : C.fg3 }}>{count}</Text>}
    </TouchableOpacity>
  );
}
