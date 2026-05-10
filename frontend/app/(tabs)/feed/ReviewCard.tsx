import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TextInput, TouchableOpacity } from 'react-native';
import { GCard, Icon } from '../../components';
import { C, R, scoreColor } from '../../theme';
import { api } from '../../lib/api';
import type { FeedItem } from './types';
import { LikeButton } from './LikeButton';
import { CommentSection } from './CommentSection';

function formatTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

type Props = { item: FeedItem; token: string; myId: string; onDelete: () => void };

export function ReviewCard({ item, token, myId, onDelete }: Props) {
  const [showActions, setShowActions] = useState(false);
  const [editing, setEditing]         = useState(false);
  const [editText, setEditText]       = useState(item.text);
  const [busy, setBusy]               = useState(false);
  const isOwn = item.userId._id?.toString() === myId;

  async function saveEdit() {
    if (busy) return;
    setBusy(true);
    try {
      await api.put(`/reviews/${item._id}`, token, { text: editText });
      setEditing(false);
      setShowActions(false);
    } catch {} finally { setBusy(false); }
  }

  return (
    <GCard style={{ padding: 12, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {item.userId.avatarUrl
          ? <Image source={{ uri: item.userId.avatarUrl }} style={s.avatar} />
          : <View style={[s.avatar, { backgroundColor: C.glass }]} />}
        <Text style={s.username}>{item.userId.displayName}</Text>
        <Text style={s.time}>{formatTime(item.createdAt)}</Text>
        {isOwn && (
          <TouchableOpacity onPress={() => { setShowActions(v => !v); setEditing(false); }} activeOpacity={0.7}>
            <Icon name="more" size={16} color={C.fg2} />
          </TouchableOpacity>
        )}
      </View>

      {isOwn && showActions && !editing && (
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity onPress={() => setEditing(true)} activeOpacity={0.7}>
            <Text style={{ fontSize: 12, color: C.violet }}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={async () => { await api.del(`/reviews/${item._id}`, token); onDelete(); }} activeOpacity={0.7}>
            <Text style={{ fontSize: 12, color: C.pink }}>Delete</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowActions(false)} activeOpacity={0.7}>
            <Text style={{ fontSize: 12, color: C.fg3 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {editing && (
        <View style={s.editRow}>
          <TextInput
            value={editText}
            onChangeText={t => setEditText(t.slice(0, 280))}
            style={{ flex: 1, fontSize: 13, color: C.fg }}
            multiline
            autoFocus
          />
          <TouchableOpacity onPress={saveEdit} activeOpacity={0.7}>
            <Text style={{ fontSize: 12, color: C.violet }}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setEditing(false); setEditText(item.text); }} activeOpacity={0.7}>
            <Icon name="x" size={14} color={C.fg3} />
          </TouchableOpacity>
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        {item.albumArt
          ? <Image source={{ uri: item.albumArt }} style={s.art} />
          : <View style={[s.art, { backgroundColor: C.glass }]} />}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.track} numberOfLines={1}>{item.trackName}</Text>
          <Text style={s.artist} numberOfLines={1}>{item.artistName}</Text>
        </View>
        <Text style={[s.score, { color: scoreColor(item.score) }]}>{item.score.toFixed(1)}</Text>
      </View>

      {!!item.text && <Text style={s.reviewText}>{item.text}</Text>}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 }}>
          {item.moods?.map(m => (
            <View key={m} style={s.moodChip}>
              <Text style={s.moodTxt}>{m}</Text>
            </View>
          ))}
        </View>
        <LikeButton reviewId={item._id} likes={item.likes ?? []} token={token} myId={myId} />
      </View>

      <CommentSection reviewId={item._id} initial={item.comments ?? []} token={token} myId={myId} />
    </GCard>
  );
}

const s = StyleSheet.create({
  avatar:   { width: 28, height: 28, borderRadius: 14 },
  username: { flex: 1, fontSize: 12, fontWeight: '600', color: C.fg },
  time:     { fontSize: 10, color: C.fg3 },

  art:    { width: 48, height: 48, borderRadius: R.r2 },
  track:  { fontSize: 14, fontWeight: '600', color: C.fg },
  artist: { fontSize: 11, color: C.fg2 },
  score:  { fontSize: 22, fontWeight: '600', letterSpacing: -0.5 },

  reviewText: { fontSize: 13, color: C.fg2, lineHeight: 19 },

  moodChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill, backgroundColor: C.glassThin, borderWidth: 1, borderColor: C.stroke },
  moodTxt:  { fontSize: 10, color: C.fg3 },

  editRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.glass, borderRadius: R.r2, borderWidth: 1,
    borderColor: C.stroke, paddingHorizontal: 10, paddingVertical: 6,
  },
});
