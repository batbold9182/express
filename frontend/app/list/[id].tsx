import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GCard, Eyebrow, Icon } from '../components';
import { C, R } from '../theme';
import { useAuth } from '../context/auth';
import { api } from '../lib/api';

type ListItem = {
  rank: number;
  type?: 'track' | 'album';
  spotifyTrackId?: string;
  spotifyAlbumId?: string;
  trackName: string;
  artistName: string;
  albumArt?: string;
};

type AppList = {
  _id: string;
  title: string;
  items: ListItem[];
  userId: { _id: string; displayName: string; avatarUrl: string; spotifyId: string };
  createdAt: string;
  updatedAt: string;
};

const RANK_COLORS = [C.amber, C.fg2, C.amber, C.fg3, C.fg3];

export default function ListView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, spotifyId: mySpotifyId } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [list, setList]     = useState<AppList | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!token || !id) return;
    api.get(`/lists/${id}`, token)
      .then(setList)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, token]);

  async function handleDelete() {
    Alert.alert('Delete list', 'Are you sure you want to delete this list?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await api.del(`/lists/${id}`, token!);
            router.back();
          } catch {
            Alert.alert('Error', 'Failed to delete list.');
            setDeleting(false);
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={[s.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={C.violet} size="large" />
      </View>
    );
  }

  if (!list) {
    return (
      <View style={[s.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: C.fg3 }}>List not found.</Text>
      </View>
    );
  }

  const isOwn = list.userId.spotifyId === mySpotifyId;
  const sorted = [...list.items].sort((a, b) => a.rank - b.rank);

  return (
    <View style={s.screen}>
      <View style={s.glow} pointerEvents="none" />

      <View style={[s.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={s.iconBtn}>
          <Icon name="arrow-left" size={22} color={C.fg} />
        </TouchableOpacity>
        <Text style={s.topBarTitle} numberOfLines={1}>{list.title}</Text>
        {isOwn ? (
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/list/create', params: { id } } as any)}
            activeOpacity={0.7}
            style={s.iconBtn}
          >
            <Icon name="edit" size={20} color={C.fg2} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Author */}
        <TouchableOpacity
          onPress={() => router.push(`/profile/${list.userId.spotifyId}` as any)}
          activeOpacity={0.7}
          style={s.authorRow}
        >
          {list.userId.avatarUrl
            ? <Image source={{ uri: list.userId.avatarUrl }} style={s.authorAvatar} />
            : <View style={[s.authorAvatar, { backgroundColor: C.glass }]} />}
          <Text style={s.authorName}>{list.userId.displayName}</Text>
          <Text style={s.authorHandle}>· {list.items.length} {list.items.length === 1 ? 'item' : 'items'}</Text>
        </TouchableOpacity>

        {/* Items */}
        {sorted.length === 0 ? (
          <View style={s.empty}>
            <Icon name="activity" size={28} color={C.fg4} />
            <Text style={s.emptyTxt}>No items in this list yet.</Text>
          </View>
        ) : (
          <View style={{ gap: 8, marginTop: 8 }}>
            {sorted.map((item, i) => (
              <GCard key={`${item.rank}-${item.trackName}`} style={{ padding: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={[s.rank, { color: RANK_COLORS[i] ?? C.fg4 }]}>#{item.rank}</Text>
                {item.albumArt
                  ? <Image source={{ uri: item.albumArt }} style={s.art} />
                  : <View style={[s.art, { backgroundColor: C.glass }]} />}
                <View style={{ flex: 1 }}>
                  <Text style={s.trackName} numberOfLines={1}>{item.trackName}</Text>
                  <Text style={s.artistName} numberOfLines={1}>{item.artistName}</Text>
                </View>
                {item.type === 'album' && (
                  <View style={s.typeBadge}><Text style={s.typeTxt}>Album</Text></View>
                )}
              </GCard>
            ))}
          </View>
        )}

        {/* Delete button for owner */}
        {isOwn && (
          <TouchableOpacity
            onPress={handleDelete}
            activeOpacity={0.7}
            disabled={deleting}
            style={s.deleteBtn}
          >
            {deleting
              ? <ActivityIndicator size="small" color={C.red} />
              : <Text style={s.deleteTxt}>Delete list</Text>}
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  glow:   { position: 'absolute', top: 0, left: 0, right: 0, height: 240, backgroundColor: 'rgba(177,78,255,0.07)' },
  scroll: { flex: 1 },

  topBar:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  topBarTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: C.fg, textAlign: 'center' },
  iconBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  authorRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  authorAvatar: { width: 28, height: 28, borderRadius: 14 },
  authorName:   { fontSize: 13, fontWeight: '600', color: C.fg },
  authorHandle: { fontSize: 12, color: C.fg3 },

  rank:       { width: 32, fontSize: 18, fontWeight: '700', letterSpacing: -0.5, textAlign: 'center' },
  art:        { width: 44, height: 44, borderRadius: R.r2 },
  trackName:  { fontSize: 14, fontWeight: '600', color: C.fg },
  artistName: { fontSize: 11, color: C.fg3, marginTop: 1 },

  typeBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: R.pill, backgroundColor: C.glassThin, borderWidth: 1, borderColor: C.stroke },
  typeTxt:   { fontSize: 9, fontWeight: '600', color: C.fg3, letterSpacing: 0.6, textTransform: 'uppercase' },

  empty:    { alignItems: 'center', gap: 10, paddingTop: 40 },
  emptyTxt: { fontSize: 13, color: C.fg3 },

  deleteBtn: { marginTop: 32, alignSelf: 'center', paddingHorizontal: 24, paddingVertical: 10, borderRadius: R.pill, borderWidth: 1, borderColor: C.red },
  deleteTxt: { fontSize: 13, fontWeight: '600', color: C.red },
});
