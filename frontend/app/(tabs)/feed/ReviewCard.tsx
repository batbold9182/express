import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TextInput, TouchableOpacity, Linking, Alert } from 'react-native';
import Slider from '@react-native-community/slider';
import { useRouter } from 'expo-router';
import { GCard, Icon, Mood, MoodTag, Score } from '../../components';
import { C, R, scoreColor } from '../../theme'; // scoreColor still used for edit slider label
import { api } from '../../lib/api';
import { shareUrl } from '../../lib/share';
import type { FeedItem } from './types';
import { LikeButton } from './LikeButton';
import { CommentSection } from './CommentSection';
import { MOOD_LIST } from '../../lib/constants';

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
  const [editText, setEditText]         = useState(item.text);
  const [editScore, setEditScore]       = useState(item.score);
  const [editMoods, setEditMoods]       = useState<string[]>(item.moods ?? []);
  const [displayText, setDisplayText]   = useState(item.text);
  const [displayScore, setDisplayScore] = useState(item.score);
  const [displayMoods, setDisplayMoods] = useState<string[]>(item.moods ?? []);
  const [busy, setBusy]               = useState(false);
  const isOwn = item.userId._id?.toString() === myId;

  function toggleMood(m: string) {
    setEditMoods(prev =>
      prev.includes(m) ? prev.filter(x => x !== m) : prev.length < 3 ? [...prev, m] : prev
    );
  }

  async function saveEdit() {
    if (busy) return;
    setBusy(true);
    try {
      await api.put(`/reviews/${item._id}`, token, { text: editText, score: editScore, moods: editMoods });
      setDisplayText(editText);
      setDisplayScore(editScore);
      setDisplayMoods(editMoods);
      setEditing(false);
      setShowActions(false);
    } catch {} finally { setBusy(false); }
  }

  return (
    <GCard style={{ padding: 16, gap: 14 }} accentColor={typeCfg.color}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {item.userId.avatarUrl
          ? <Image source={{ uri: item.userId.avatarUrl }} style={s.avatar} />
          : <View style={[s.avatar, { backgroundColor: C.glass }]} />}
        <TouchableOpacity onPress={() => router.push(`/profile/${item.userId.spotifyId}` as any)} activeOpacity={0.7} style={{ flex: 1 }}>
          <Text style={s.username}>{item.userId.displayName}</Text>
          <Text style={s.time}>{formatTime(item.createdAt)}</Text>
        </TouchableOpacity>
        {isOwn && (
          <TouchableOpacity onPress={() => { setShowActions(v => !v); setEditing(false); }} activeOpacity={0.7} style={s.moreBtn}>
            <Icon name="more" size={16} color={C.fg3} />
          </TouchableOpacity>
        )}
      </View>

      {isOwn && showActions && !editing && (
        <View style={s.actionsMenu}>
          <TouchableOpacity onPress={() => setEditing(true)} activeOpacity={0.7} style={s.actionItem}>
            <Icon name="edit" size={13} color={C.violet} />
            <Text style={[s.actionTxt, { color: C.violet }]}>Edit</Text>
          </TouchableOpacity>
          <View style={s.actionDivider} />
          <TouchableOpacity onPress={() => Alert.alert('Delete review', 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: async () => { await api.del(`/reviews/${item._id}`, token); onDelete(); } },
          ])} activeOpacity={0.7} style={s.actionItem}>
            <Icon name="x" size={13} color={C.pink} />
            <Text style={[s.actionTxt, { color: C.pink }]}>Delete</Text>
          </TouchableOpacity>
          <View style={s.actionDivider} />
          <TouchableOpacity onPress={() => setShowActions(false)} activeOpacity={0.7} style={s.actionItem}>
            <Text style={[s.actionTxt, { color: C.fg3 }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {editing && (
        <View style={{ gap: 10 }}>
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
            <TouchableOpacity onPress={() => { setEditing(false); setEditText(displayText); setEditScore(displayScore); setEditMoods(displayMoods); }} activeOpacity={0.7}>
              <Icon name="x" size={14} color={C.fg3} />
            </TouchableOpacity>
          </View>
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 11, color: C.fg3 }}>Score</Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: scoreColor(editScore) }}>{editScore.toFixed(1)}</Text>
            </View>
            <Slider
              minimumValue={0} maximumValue={10} step={0.5}
              value={editScore} onValueChange={setEditScore}
              minimumTrackTintColor={C.violet} maximumTrackTintColor={C.glass}
              thumbTintColor={C.violet}
              style={{ height: 28 }}
            />
          </View>
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 11, color: C.fg3 }}>Mood · pick up to 3</Text>
              <Text style={{ fontSize: 11, color: C.fg3 }}>{editMoods.length}/3</Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {MOOD_LIST.map(([m, mc]) => (
                <Mood key={m} color={mc} selected={editMoods.includes(m)} onPress={() => toggleMood(m)}>{m}</Mood>
              ))}
            </View>
          </View>
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        <TouchableOpacity activeOpacity={0.7} onPress={navigateToSubject}>
          {item.albumArt
            ? <Image source={{ uri: item.albumArt }} style={s.art} />
            : <View style={[s.art, { backgroundColor: C.glass }]} />}
        </TouchableOpacity>
        <View style={{ flex: 1, gap: 3 }}>
          <TouchableOpacity activeOpacity={0.7} onPress={navigateToSubject} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[s.track, { flex: 1 }]} numberOfLines={1}>{item.trackName}</Text>
            <View style={[s.typePill, { backgroundColor: typeCfg.color + '30' }]}>
              <Text style={[s.typeTxt, { color: typeCfg.color }]}>{typeCfg.label}</Text>
            </View>
          </TouchableOpacity>
          {item.spotifyArtistId
            ? <TouchableOpacity onPress={() => router.push(`/artist/${item.spotifyArtistId}` as any)} activeOpacity={0.7}>
                <Text style={[s.artist, { color: C.violet }]} numberOfLines={1}>{item.artistName} ›</Text>
              </TouchableOpacity>
            : <Text style={s.artist} numberOfLines={1}>{item.artistName}</Text>}
        </View>
        <TouchableOpacity activeOpacity={0.7} onPress={navigateToSubject}>
          <View style={[s.scorePill, { backgroundColor: scoreColor(displayScore) + '1A' }]}>
            <Score value={displayScore} size="md" glow={false} />
          </View>
        </TouchableOpacity>
      </View>

      {!!displayText && <Text style={s.reviewText}>{displayText}</Text>}

      {displayMoods.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {displayMoods.map(m => <MoodTag key={m} label={m} />)}
        </View>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
        {(item.spotifyTrackId || item.spotifyAlbumId || item.spotifyArtistId) && (() => {
          const url = item.type === 'artist' && item.spotifyArtistId
            ? `https://open.spotify.com/artist/${item.spotifyArtistId}`
            : item.type === 'album' && item.spotifyAlbumId
              ? `https://open.spotify.com/album/${item.spotifyAlbumId}`
              : `https://open.spotify.com/track/${item.spotifyTrackId}`;
          return (
            <>
              <TouchableOpacity onPress={() => shareUrl(url, `${item.trackName} by ${item.artistName}`)} activeOpacity={0.7}>
                <Icon name="share" size={15} color={C.fg3} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Linking.openURL(url)} activeOpacity={0.7} style={s.spotifyBtn}>
                <Text style={s.spotifyTxt}>▶ Spotify</Text>
              </TouchableOpacity>
            </>
          );
        })()}
        <LikeButton reviewId={item._id} likes={item.likes ?? []} token={token} myId={myId} />
      </View>

      <View style={s.commentDivider} />
      <CommentSection reviewId={item._id} initial={item.comments ?? []} token={token} myId={myId} />
    </GCard>
  );
}

const s = StyleSheet.create({
  avatar:   { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: C.stroke },
  username: { fontSize: 13, fontWeight: '700', color: C.fg },
  time:     { fontSize: 11, color: C.fg4, marginTop: 1 },
  moreBtn:  { padding: 6 },

  art:    { width: 76, height: 76, borderRadius: R.r3, borderWidth: 1, borderColor: C.stroke },
  track:  { fontSize: 14, fontWeight: '600', color: C.fg },
  artist: { fontSize: 12, color: C.fg2 },

  reviewText: { fontSize: 13, color: C.fg2, lineHeight: 21 },

  typePill:  { paddingHorizontal: 7, paddingVertical: 3, borderRadius: R.pill },
  typeTxt:   { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  scorePill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: R.pill },

  spotifyBtn: {
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: R.pill,
    borderWidth: 1, borderColor: '#1DB954',
    alignItems: 'center', justifyContent: 'center',
  },
  spotifyTxt: { fontSize: 10, fontWeight: '700', color: '#1DB954', letterSpacing: 0.4 },

  actionsMenu: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.glassThick, borderRadius: R.r2, borderWidth: 1,
    borderColor: C.stroke, paddingHorizontal: 12, paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  actionItem:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 4 },
  actionTxt:     { fontSize: 12, fontWeight: '500' },
  actionDivider: { width: 1, height: 12, backgroundColor: C.stroke },

  commentDivider: { height: 1, backgroundColor: C.stroke, marginHorizontal: -16 },

  editRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.glass, borderRadius: R.r2, borderWidth: 1,
    borderColor: C.stroke, paddingHorizontal: 10, paddingVertical: 8,
  },
});
