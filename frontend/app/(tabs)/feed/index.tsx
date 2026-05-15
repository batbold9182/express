import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar, Eyebrow, Icon } from '../../components';
import { C } from '../../theme';
import { useAuth } from '../../context/auth';
import { api } from '../../lib/api';
import type { FeedItem } from './types';
import { ReviewCard } from './ReviewCard';

export default function Feed() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [items, setItems]           = useState<FeedItem[]>([]);
  const [myId, setMyId]             = useState('');
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
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
    try {
      const data = await api.get(`/users/feed/me?offset=${offsetRef.current}&limit=15`, token);
      setItems(prev => [...prev, ...data.items]);
      setHasMore(data.hasMore);
      offsetRef.current += data.items.length;
    } catch {
      // silently fail — user can keep scrolling to retry
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
        </View>
      ) : (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
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
          {!loadingMore && !hasMore && items.length > 0 && (
            <Text style={s.endTxt}>Youre all caught up</Text>
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

  emptyTitle: { fontSize: 16, fontWeight: '600', color: C.fg },
  empty:      { fontSize: 13, color: C.fg3, textAlign: 'center', lineHeight: 20 },
  endTxt:     { fontSize: 12, color: C.fg4, textAlign: 'center', marginTop: 16, marginBottom: 8 },
});
