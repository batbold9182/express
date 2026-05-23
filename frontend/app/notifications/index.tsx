import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Image, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar, Avatar, Icon } from '../components';
import { C, R } from '../theme';
import { useAuth } from '../context/auth';
import { useNotif } from '../context/notif';
import { api } from '../lib/api';

type Actor = { _id: string; displayName: string; avatarUrl?: string; spotifyId: string };
type NotifEntity = { spotifyTrackId?: string; spotifyAlbumId?: string; spotifyArtistId?: string; type?: string };
type Notif = {
  _id: string;
  type: 'like' | 'comment' | 'follow' | 'reply';
  actors: Actor[];
  actorCount: number;
  read: boolean;
  entityId?: NotifEntity;
  entitySnapshot?: NotifEntity & { trackName?: string; albumArt?: string };
  updatedAt: string;
};

const NOTIF_TYPE_CFG = {
  like:    { icon: 'heart',   color: C.pink,   bg: C.pink   + '33' },
  comment: { icon: 'comment', color: C.violet, bg: C.violet + '33' },
  reply:   { icon: 'comment', color: C.cyan,   bg: C.cyan   + '33' },
  follow:  { icon: 'user',    color: C.lime,   bg: C.lime   + '33' },
} as const;

function TypeBadge({ type }: { type: Notif['type'] }) {
  const cfg = NOTIF_TYPE_CFG[type];
  return (
    <View style={[nb.badge, { backgroundColor: cfg.bg }]}>
      <Icon name={cfg.icon} size={10} color={cfg.color} strokeWidth={2.5} />
    </View>
  );
}

const nb = StyleSheet.create({
  badge: {
    position: 'absolute', bottom: -2, right: -4,
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: C.bg,
  },
});

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function notifText(n: Notif): string {
  const first = n.actors[0]?.displayName ?? 'Someone';
  const extra = n.actorCount - 1;
  const actor = extra > 0 ? `${first} and ${extra} other${extra > 1 ? 's' : ''}` : first;
  const track = n.entitySnapshot?.trackName;
  switch (n.type) {
    case 'like':    return `${actor} liked your ${track ?? 'review'}`;
    case 'comment': return `${actor} commented on your ${track ?? 'review'}`;
    case 'reply':   return `${actor} replied to your comment${track ? ` on ${track}` : ''}`;
    case 'follow':  return `${actor} started following you`;
  }
}

export default function Notifications() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { markAllRead } = useNotif();

  const [notifs, setNotifs]         = useState<Notif[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore]       = useState(false);
  const [offset, setOffset]         = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const loadingMoreRef = React.useRef(false);

  async function load(isRefresh = false) {
    if (!token) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const data = await api.get('/notifications?offset=0&limit=20', token) as { notifications: Notif[]; hasMore: boolean };
      setNotifs(data.notifications);
      setHasMore(data.hasMore);
      setOffset(data.notifications.length);
      if (!isRefresh) markAllRead();
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadMore() {
    if (!token || loadingMoreRef.current || !hasMore) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const data = await api.get(`/notifications?offset=${offset}&limit=20`, token) as { notifications: Notif[]; hasMore: boolean };
      setNotifs(prev => [...prev, ...data.notifications]);
      setHasMore(data.hasMore);
      setOffset(prev => prev + data.notifications.length);
      setLoadMoreError(false);
    } catch {
      setLoadMoreError(true);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }

  useEffect(() => { load(); }, [token]);

  if (loading) {
    return (
      <View style={[s.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={C.violet} size="large" />
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <TopBar
        title="Notifications"
        pt={insets.top + 12}
        leading={
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Icon name="arrow-left" size={22} color={C.fg2} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.violet} />}
        onScroll={({ nativeEvent: e }) => {
          if (e.contentOffset.y + e.layoutMeasurement.height >= e.contentSize.height - 300) loadMore();
        }}
        scrollEventThrottle={100}
      >
        {notifs.length === 0 ? (
          <View style={s.empty}>
            <View style={s.emptyIcon}>
              <Icon name="bell" size={28} color={C.fg4} />
            </View>
            <Text style={s.emptyTitle}>All caught up</Text>
            <Text style={s.emptyTxt}>Likes, comments, and follows will appear here</Text>
          </View>
        ) : (
          notifs.map(n => (
            <TouchableOpacity
              key={n._id}
              activeOpacity={0.75}
              style={[s.row, !n.read && s.rowUnread]}
              onPress={() => {
                if (n.type === 'follow' && n.actors[0]?.spotifyId) {
                  router.push(`/profile/${n.actors[0].spotifyId}` as any);
                } else {
                  // entitySnapshot is authoritative (stored at write time, survives review deletion)
                  // entityId (populated review) is the fallback for old notifications
                  const snap = n.entitySnapshot;
                  const eid  = n.entityId;
                  const type      = snap?.type      ?? eid?.type;
                  const trackId   = snap?.spotifyTrackId  ?? eid?.spotifyTrackId;
                  const albumId   = snap?.spotifyAlbumId  ?? eid?.spotifyAlbumId;
                  const artistId  = snap?.spotifyArtistId ?? eid?.spotifyArtistId;
                  if (type === 'artist' && artistId) router.push(`/artist/${artistId}` as any);
                  else if (type === 'album' && albumId) router.push(`/album/${albumId}` as any);
                  else if (trackId) router.push(`/song/${trackId}` as any);
                }
              }}
            >
              <View style={s.avatarWrap}>
                {n.actors[0]?.avatarUrl
                  ? <Image source={{ uri: n.actors[0].avatarUrl }} style={s.avatar} />
                  : <Avatar name={n.actors[0]?.displayName ?? '?'} size={44} />}
                <TypeBadge type={n.type} />
              </View>

              <View style={s.body}>
                <Text style={s.txt} numberOfLines={2}>{notifText(n)}</Text>
                <Text style={s.time}>{timeAgo(n.updatedAt)}</Text>
              </View>

              {n.entitySnapshot?.albumArt && (
                <Image source={{ uri: n.entitySnapshot.albumArt }} style={s.thumb} />
              )}
            </TouchableOpacity>
          ))
        )}

        {loadingMore && <ActivityIndicator color={C.violet} style={{ marginTop: 16 }} />}
        {loadMoreError && !loadingMore && (
          <TouchableOpacity onPress={loadMore} activeOpacity={0.8} style={s.retryBtn}>
            <Text style={s.retryTxt}>Failed to load — tap to retry</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },

  empty:      { alignItems: 'center', gap: 12, paddingTop: 80, paddingHorizontal: 40 },
  emptyIcon:  {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: C.glass, borderWidth: 1, borderColor: C.stroke,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: C.fg2 },
  emptyTxt:   { fontSize: 13, color: C.fg3, textAlign: 'center', lineHeight: 19 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.stroke,
    borderLeftWidth: 3, borderLeftColor: 'transparent',
  },
  rowUnread: { backgroundColor: C.violet + '1A', borderLeftColor: C.violet },
  retryBtn:  { alignSelf: 'center', marginVertical: 16, paddingHorizontal: 16, paddingVertical: 8, borderRadius: R.pill, backgroundColor: C.glass, borderWidth: 1, borderColor: C.stroke },
  retryTxt:  { fontSize: 12, color: C.fg3 },

  avatarWrap: { position: 'relative' },
  avatar:     { width: 44, height: 44, borderRadius: 22 },

  body: { flex: 1, gap: 3 },
  txt:  { fontSize: 13, color: C.fg, lineHeight: 18 },
  time: { fontSize: 11, color: C.fg3 },

  thumb: { width: 40, height: 40, borderRadius: 6 },
});
