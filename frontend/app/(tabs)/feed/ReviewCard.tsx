import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TextInput, TouchableOpacity, Linking, Alert } from 'react-native';
import { useRouter } from 'expo-router';
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

const TYPE_LABEL: Record<string, { label: string; color: string }> = {
  album:  { label: 'Album',  color: C.cyan },
  artist: { label: 'Artist', color: C.pink },
  track:  { label: 'Track',  color: C.fg3 },
};

type Props = { item: FeedItem; token: string; myId: string; onDelete: () => void };

export function ReviewCard({ item, token, myId, onDelete }: Props) {
  const router = useRouter();
  const typeCfg = TYPE_LABEL[item.type ?? 'track'];

  function navigateToSubject() {
    if (item.type === 'artist' && item.spotifyArtistId) router.push(`/artist/${item.spotifyArtistId}` as any);
    else if (item.type === 'album' && item.spotifyAlbumId) router.push(`/album/${item.spotifyAlbumId}` as any);
    else if (item.spotifyTrackId) router.push(`/song/${item.spotifyTrackId}` as any);
    else if (item.spotifyAlbumId) router.push(`/album/${item.spotifyAlbumId}` as any);
  }
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
        <TouchableOpacity onPress={() => router.push(`/profile/${item.userId.spotifyId}` as any)} activeOpacity={0.7} style={{ flex: 1 }}>
          <Text style={s.username}>{item.userId.displayName}</Text>
        </TouchableOpacity>
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
          <TouchableOpacity onPress={() => Alert.alert('Delete review', 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: async () => { await api.del(`/reviews/${item._id}`, token); onDelete(); } },
          ])} activeOpacity={0.7}>
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

      <TouchableOpacity activeOpacity={0.7} onPress={navigateToSubject} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        {item.albumArt
          ? <Image source={{ uri: item.albumArt }} style={s.art} />
          : <View style={[s.art, { backgroundColor: C.glass }]} />}
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[s.track, { flex: 1 }]} numberOfLines={1}>{item.trackName}</Text>
            <View style={[s.typePill, { borderColor: typeCfg.color + '55', backgroundColor: typeCfg.color + '18' }]}>
              <Text style={[s.typeTxt, { color: typeCfg.color }]}>{typeCfg.label}</Text>
            </View>
          </View>
          <Text style={s.artist} numberOfLines={1}>{item.artistName}</Text>
        </View>
        <Text style={[s.score, { color: scoreColor(item.score) }]}>{item.score.toFixed(1)}</Text>
      </TouchableOpacity>

      {!!item.text && <Text style={s.reviewText}>{item.text}</Text>}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 }}>
          {item.moods?.map(m => (
            <View key={m} style={s.moodChip}>
              <Text style={s.moodTxt}>{m}</Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {(item.spotifyTrackId || item.spotifyAlbumId || item.spotifyArtistId) && (
            <TouchableOpacity
              onPress={() => {
                const url = item.type === 'artist' && item.spotifyArtistId
                  ? `https://open.spotify.com/artist/${item.spotifyArtistId}`
                  : item.type === 'album' && item.spotifyAlbumId
                    ? `https://open.spotify.com/album/${item.spotifyAlbumId}`
                    : `https://open.spotify.com/track/${item.spotifyTrackId}`;
                Linking.openURL(url);
              }}
              activeOpacity={0.7}
              style={s.spotifyBtn}
            >
              <Text style={s.spotifyTxt}>▶ Spotify</Text>
            </TouchableOpacity>
          )}
          <LikeButton reviewId={item._id} likes={item.likes ?? []} token={token} myId={myId} />
        </View>
      </View>

      <CommentSection reviewId={item._id} initial={item.comments ?? []} token={token} myId={myId} />
    </GCard>
  );
}

const s = StyleSheet.create({
  avatar:   { width: 28, height: 28, borderRadius: 14 },
  username: { fontSize: 12, fontWeight: '600', color: C.fg },
  time:     { fontSize: 10, color: C.fg3 },

  art:    { width: 48, height: 48, borderRadius: R.r2 },
  track:  { fontSize: 14, fontWeight: '600', color: C.fg },
  artist: { fontSize: 11, color: C.fg2 },
  score:  { fontSize: 22, fontWeight: '600', letterSpacing: -0.5 },

  reviewText: { fontSize: 13, color: C.fg2, lineHeight: 19 },

  moodChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill, backgroundColor: C.glassThin, borderWidth: 1, borderColor: C.stroke },
  moodTxt:  { fontSize: 10, color: C.fg3 },

  typePill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: R.pill, borderWidth: 1 },
  typeTxt:  { fontSize: 9, fontWeight: '600', letterSpacing: 0.4 },

  spotifyBtn: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: R.pill,
    backgroundColor: '#1DB954', alignItems: 'center', justifyContent: 'center',
  },
  spotifyTxt: { fontSize: 10, fontWeight: '700', color: '#000', letterSpacing: 0.4 },

  editRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.glass, borderRadius: R.r2, borderWidth: 1,
    borderColor: C.stroke, paddingHorizontal: 10, paddingVertical: 6,
  },
});
