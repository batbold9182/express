import React, { useEffect, useState } from 'react';
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
  const [feed, setFeed]             = useState<{ items: FeedItem[]; myId: string }>({ items: [], myId: '' });
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { items, myId } = feed;

  async function load(isRefresh = false) {
    if (!token) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const data = await api.get('/users/feed/me', token);
      setFeed({ items: data.items, myId: data.myId });
    } catch {
      setFeed({ items: [], myId: '' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={s.screen}>
      <View style={s.glow} pointerEvents="none" />
      <TopBar title="Feed" pt={insets.top + 12} />

      {loading ? (
        <View style={s.center}><ActivityIndicator color={C.violet} size="large" /></View>
      ) : items.length === 0 ? (
        <View style={s.center}>
          <Icon name="search" size={32} color={C.fg4} />
          <Text style={s.emptyTitle}>Nothing here yet</Text>
          <Text style={s.empty}>Follow people to see their reviews.</Text>
        </View>
      ) : (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.violet} />}
        >
          <Eyebrow>Latest from people you follow</Eyebrow>
          <View style={{ gap: 12, marginTop: 8 }}>
            {items.map(item => (
              <ReviewCard key={item._id} item={item} token={token!} myId={myId}
                onDelete={() => setFeed(prev => ({ ...prev, items: prev.items.filter(r => r._id !== item._id) }))} />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  glow:   { position: 'absolute', top: 0, left: 0, right: 0, height: 240, backgroundColor: 'rgba(177,78,255,0.07)' },
  scroll: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },

  emptyTitle: { fontSize: 16, fontWeight: '600', color: C.fg },
  empty:      { fontSize: 13, color: C.fg3, textAlign: 'center', lineHeight: 20 },
});
