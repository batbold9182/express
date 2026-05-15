import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar, Icon } from '../components';
import { C, R } from '../theme';
import { useAuth } from '../context/auth';
import { api } from '../lib/api';
import type { FeedItem } from './feed/types';
import { ReviewCard } from './feed/ReviewCard';

const TABS = [
  { key: 'trending', label: 'Trending', icon: 'flame',  endpoint: '/reviews/trending' },
  { key: 'top',      label: 'Top rated', icon: 'star',  endpoint: '/reviews/top' },
] as const;

type Tab = typeof TABS[number]['key'];

const LIMIT = 15;

export default function Home() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>('trending');
  const [items, setItems]         = useState<FeedItem[]>([]);
  const [myId, setMyId]           = useState('');
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]     = useState(true);

  const offsetRef = useRef(0);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const endpoint = TABS.find(t => t.key === activeTab)!.endpoint;

  const load = useCallback(async (opts: { refresh?: boolean; more?: boolean } = {}) => {
    if (!token) return;
    const { refresh, more } = opts;

    if (more && (!hasMore || loadingMore)) return;

    if (refresh) { setRefreshing(true); offsetRef.current = 0; }
    else if (more) setLoadingMore(true);
    else { setLoading(true); offsetRef.current = 0; }

    try {
      const data = await api.get(`${endpoint}?offset=${offsetRef.current}&limit=${LIMIT}`, token);
      if (refresh || !more) {
        setItems(data.items);
      } else {
        setItems(prev => [...prev, ...data.items]);
      }

      setMyId(data.myId);
      setHasMore(data.hasMore);
      offsetRef.current += data.items.length;
    } catch {
      if (!more) setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [token, endpoint, hasMore, loadingMore]);

  // Reset and reload when tab changes
  useEffect(() => {
    setItems([]);
    setHasMore(true);
    setLoading(true);
    offsetRef.current = 0;
    load();
  }, [activeTab, token]);

  function switchTab(key: Tab) {
    if (key === activeTab) return;
    setActiveTab(key);
  }

  const header = (
    <View style={[s.topSection, { paddingTop: insets.top + 12 }]}>
      <TopBar title={<Text style={s.wordmark}>rotation</Text>} large pt={0} />
      <View style={s.tabs}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            onPress={() => switchTab(t.key)}
            activeOpacity={0.7}
            style={[s.tab, activeTab === t.key && s.tabActive]}
          >
            <Icon name={t.icon} size={13} color={activeTab === t.key ? C.violet : C.fg3} />
            <Text style={[s.tabTxt, activeTab === t.key && s.tabTxtActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={s.screen}>
        {header}
        <View style={s.center}><ActivityIndicator color={C.violet} size="large" /></View>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <FlatList
        data={items}
        keyExtractor={item => item._id}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={header}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load({ refresh: true })} tintColor={C.violet} />
        }
        onEndReached={() => load({ more: true })}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyTxt}>Nothing here yet — be the first to post a review!</Text>
          </View>
        }
        ListFooterComponent={
          loadingMore ? <ActivityIndicator color={C.violet} style={{ marginTop: 16 }} /> : null
        }
        renderItem={({ item }) => (
          <View style={{ marginBottom: 12 }}>
            <ReviewCard
              item={item}
              token={token!}
              myId={myId}
              onDelete={() => setItems(prev => prev.filter(r => r._id !== item._id))}
            />
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: C.bg },

  wordmark: { fontSize: 22, fontWeight: '700', color: C.violet, letterSpacing: -0.5 },
  center:   { flex: 1, alignItems: 'center', justifyContent: 'center' },

  topSection: { backgroundColor: 'rgba(11,8,22,0.92)', borderBottomWidth: 1, borderBottomColor: C.stroke, marginBottom: 16 },

  tabs:        { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  tab:         { flex: 1, flexDirection: 'row', gap: 6, paddingVertical: 9, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: C.glassThin, borderWidth: 1, borderColor: C.stroke },
  tabActive:   { backgroundColor: 'rgba(177,78,255,0.15)', borderColor: 'rgba(177,78,255,0.5)', shadowColor: C.violet, shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  tabTxt:      { fontSize: 12, fontWeight: '600', color: C.fg3, letterSpacing: 0.2 },
  tabTxtActive:{ color: C.violet },

  empty:    { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyTxt: { fontSize: 13, color: C.fg3, textAlign: 'center', lineHeight: 20 },
});
