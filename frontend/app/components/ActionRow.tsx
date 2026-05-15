import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Icon } from './Icon';
import { C } from '../theme';

export function ActionRow({ likes, comments, liked, onLike, time }: {
  likes: number; comments: number; liked: boolean; onLike?: () => void; time?: string;
}) {
  return (
    <View style={s.row}>
      <TouchableOpacity onPress={onLike} activeOpacity={0.7} style={s.btn}>
        <Icon name="heart" fill={liked ? C.pink : 'none'} color={liked ? C.pink : C.fg2} size={18} />
        <Text style={[s.count, { color: liked ? C.pink : C.fg2 }]}>{likes}</Text>
      </TouchableOpacity>
      <TouchableOpacity activeOpacity={0.7} style={s.btn}>
        <Icon name="comment" size={18} color={C.fg2} />
        <Text style={[s.count, { color: C.fg2 }]}>{comments}</Text>
      </TouchableOpacity>
      <TouchableOpacity activeOpacity={0.7} style={s.btn}>
        <Icon name="share" size={18} color={C.fg2} />
      </TouchableOpacity>
      {time && <Text style={s.time}>{time}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 4 },
  btn:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  count: { fontSize: 13, fontWeight: '600' },
  time:  { marginLeft: 'auto', fontSize: 10, color: C.fg3 },
});
