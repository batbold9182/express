import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar, Eyebrow, Icon } from '../../components';
import { C, R } from '../../theme';
import { useAuth } from '../../context/auth';
import { api } from '../../lib/api';
import type { FeedItem } from './types';
import { ReviewCard } from './ReviewCard';

export default function Feed() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();
  const [items, setItems]           = useState<FeedItem[]>([]);
  const [myId, setMyId]             = useState('');
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [hasMore, setHasMore]       = useState(false);
  const [error, setError]           = useState(false);
  const offsetRef      = useRef(0);
  const loadingMoreRef = useRef(false);

  async function load(isRefresh = false) {
    if (!token) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    offsetRef.current = 0;
    try {
      const data = await api.get('/users/feed/me?offset=0&limit=15', token);
      setItems(data.items);
      setMyId(data.myId);
      setHasMore(data.hasMore);
      offsetRef.current = data.items.length;
      setError(false);
      setLoadMoreError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadMore() {
    if (!token || !hasMore || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setLoadMoreError(false);
    try {
      const data = await api.get(`/users/feed/me?offset=${offsetRef.current}&limit=15`, token);
      setItems(prev => [...prev, ...data.items]);
      setHasMore(data.hasMore);
      offsetRef.current += data.items.length;
    } catch {
      setLoadMoreError(true);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }

  useEffect(() => { load(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={s.screen}>

      <TopBar title="Feed" pt={insets.top + 12} />

      {loading ? (
        <View style={s.center}><ActivityIndicator color={C.violet} size="large" /></View>
      ) : error ? (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.center}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.violet} />}
        >
          <Icon name="wifi-off" size={32} color={C.fg3} />
          <Text style={s.emptyTitle}>Failed to load feed</Text>
          <Text style={s.empty}>Pull down to retry.</Text>
        </ScrollView>
      ) : items.length === 0 ? (
        <View style={s.center}>
          <Icon name="search" size={32} color={C.fg3} />
          <Text style={s.emptyTitle}>Nothing here yet</Text>
          <Text style={s.empty}>Follow people to see their reviews.</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/search' as any)} activeOpacity={0.8} style={s.emptyBtn}>
            <Text style={s.emptyBtnTxt}>Find people to follow</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 80 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.violet} />}
          onScroll={({ nativeEvent: e }) => {
            if (e.contentOffset.y + e.layoutMeasurement.height < e.contentSize.height - 300) return;
            loadMore();
          }}
          scrollEventThrottle={100}
        >
          <Eyebrow>Latest from people you follow</Eyebrow>
          <View style={{ gap: 12, marginTop: 8 }}>
            {items.map(item => (
              <ReviewCard key={item._id} item={item} token={token!} myId={myId}
                onDelete={() => setItems(prev => prev.filter(r => r._id !== item._id))} />
            ))}
          </View>
          {loadingMore && <ActivityIndicator color={C.violet} style={{ marginTop: 16 }} />}
          {loadMoreError && !loadingMore && (
            <TouchableOpacity onPress={loadMore} activeOpacity={0.8} style={s.retryBtn}>
              <Text style={s.retryTxt}>Failed to load more — tap to retry</Text>
            </TouchableOpacity>
          )}
          {!loadingMore && !loadMoreError && !hasMore && items.length > 0 && (
            <Text style={s.endTxt}>{"You're all caught up"}</Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },

  scroll: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },

  emptyTitle:  { fontSize: 16, fontWeight: '600', color: C.fg },
  empty:       { fontSize: 13, color: C.fg3, textAlign: 'center', lineHeight: 20 },
  emptyBtn:    { backgroundColor: C.glass, borderWidth: 1, borderColor: C.stroke, paddingHorizontal: 20, paddingVertical: 9, borderRadius: R.pill },
  emptyBtnTxt: { fontSize: 13, fontWeight: '600', color: C.fg2 },

  retryBtn: { alignSelf: 'center', marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: R.pill, backgroundColor: C.glass, borderWidth: 1, borderColor: C.stroke },
  retryTxt: { fontSize: 12, color: C.fg3, textAlign: 'center' },
  endTxt:   { fontSize: 12, color: C.fg4, textAlign: 'center', marginTop: 16, marginBottom: 8 },
});
