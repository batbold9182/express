import React, { useState } from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { Icon } from '../../components';
import { C } from '../../theme';
import { api } from '../../lib/api';

type Props = { reviewId: string; likes: string[]; token: string; myId: string };

export function LikeButton({ reviewId, likes, token, myId }: Props) {
  const [count, setCount] = useState(likes.length);
  const [liked, setLiked] = useState(likes.includes(myId));
  const [busy, setBusy]   = useState(false);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      if (liked) {
        const res = await api.del(`/reviews/${reviewId}/like`, token);
        setCount(res.likes); setLiked(false);
      } else {
        const res = await api.post(`/reviews/${reviewId}/like`, token, {});
        setCount(res.likes); setLiked(true);
      }
    } catch {} finally { setBusy(false); }
  }

  return (
    <TouchableOpacity onPress={toggle} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Icon name="heart" size={16} color={liked ? C.pink : C.fg3} />
      {count > 0 && <Text style={{ fontSize: 11, color: liked ? C.pink : C.fg3 }}>{count}</Text>}
    </TouchableOpacity>
  );
}
