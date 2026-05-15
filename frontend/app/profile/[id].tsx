import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator, TextInput, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GCard, Eyebrow, Icon } from '../components';
import { C, R } from '../theme';
import { useAuth } from '../context/auth';
import { api } from '../lib/api';
import { ProfileReviewCard, type ProfileReview } from './ReviewCard';

type AppUser = {
  _id: string;
  spotifyId: string;
  displayName: string;
  avatarUrl: string;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
};

type ReviewType = 'track' | 'album' | 'artist';

export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, spotifyId: myId } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [profile, setProfile]   = useState<AppUser | null>(null);
  const [lists, setLists]       = useState<{ _id: string; title: string; items: any[] }[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy]         = useState(false);

  const [tab, setTab]           = useState<ReviewType | null>(null);
  const [q, setQ]               = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [cache, setCache]       = useState<Partial<Record<ReviewType, ProfileReview[]>>>({});
  const [counts, setCounts]     = useState<Record<ReviewType, number>>({ track: 0, album: 0, artist: 0 });
  const [revLoading, setRevLoading] = useState(false);
  const [hasMoreMap, setHasMoreMap] = useState<Partial<Record<ReviewType, boolean>>>({});
  const [revLoadingMore, setRevLoadingMore] = useState(false);
  const offsetMap      = useRef<Partial<Record<ReviewType, number>>>({});
  const loadingMoreRef = useRef(false);

  const isOwn = id === myId;
  const reviews = tab ? (cache[tab] ?? null) : null;
  const totalReviews = counts.track + counts.album + counts.artist;

  function load(isRefresh = false) {
    if (!token || !id) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    if (isRefresh) { setCache({}); offsetMap.current = {}; }
    Promise.allSettled([
      api.get(`/users/${id}`, token),
      api.get(`/users/${id}/lists`, token),
      api.get(`/users/${id}/reviews/counts`, token),
    ]).then(([user, ls, c]) => {
      const ok = (r: PromiseSettledResult<any>) => r.status === 'fulfilled' ? r.value : null;
      const u = ok(user);
      if (u) { setProfile(u); setFollowing(u.isFollowing); }
      setLists(ok(ls) ?? []);
      setCounts(ok(c) ?? { track: 0, album: 0, artist: 0 });
    }).finally(() => { setLoading(false); setRefreshing(false); });
  }

  useEffect(() => { load(); }, [id, token]); // eslint-disable-line react-hooks/exhaustive-deps

  function selectTab(type: ReviewType) {
    if (tab === type) { setTab(null); return; }
    setTab(type);
    setQ('');
    if (cache[type]) return;
    offsetMap.current[type] = 0;
    loadTabPage(type, 0);
  }

  async function loadTabPage(type: ReviewType, offset: number) {
    if (!token || !id) return;
    if (offset === 0) setRevLoading(true);
    else {
      if (loadingMoreRef.current) return;
      loadingMoreRef.current = true;
      setRevLoadingMore(true);
    }
    try {
      const data = await api.get(`/users/${id}/reviews?type=${type}&offset=${offset}&limit=20`, token) as { reviews: ProfileReview[]; hasMore: boolean };
      if (offset === 0) {
        setCache(prev => ({ ...prev, [type]: data.reviews }));
      } else {
        setCache(prev => ({ ...prev, [type]: [...(prev[type] ?? []), ...data.reviews] }));
      }
      offsetMap.current[type] = offset + data.reviews.length;
      setHasMoreMap(prev => ({ ...prev, [type]: data.hasMore }));
    } catch {
      if (offset === 0) setCache(prev => ({ ...prev, [type]: [] }));
    } finally {
      if (offset === 0) setRevLoading(false);
      else { loadingMoreRef.current = false; setRevLoadingMore(false); }
    }
  }

  const filtered = reviews
    ? reviews.filter(r => !q.trim() || r.trackName.toLowerCase().includes(q.toLowerCase()) || r.artistName.toLowerCase().includes(q.toLowerCase()))
    : null;

  async function toggleFollow() {
    if (!token || busy || !id) return;
    setBusy(true);
    try {
      if (following) {
        await api.del(`/users/${id}/follow`, token);
        setFollowing(false);
        setProfile(p => p ? { ...p, followerCount: p.followerCount - 1 } : p);
      } else {
        await api.post(`/users/${id}/follow`, token, {});
        setFollowing(true);
        setProfile(p => p ? { ...p, followerCount: p.followerCount + 1 } : p);
      }
    } catch {} finally { setBusy(false); }
  }

  if (loading) {
    return (
      <View style={[s.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={C.violet} size="large" />
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <View style={s.glow} pointerEvents="none" />

      <View style={[s.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={s.backBtn}>
          <Icon name="arrow-left" size={22} color={C.fg} />
        </TouchableOpacity>
        <Text style={s.topBarTitle} numberOfLines={1}>{profile?.displayName ?? ''}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.violet} />}
        onScroll={({ nativeEvent: e }) => {
          if (e.contentOffset.y + e.layoutMeasurement.height < e.contentSize.height - 300) return;
          if (tab && hasMoreMap[tab] && !loadingMoreRef.current) loadTabPage(tab, offsetMap.current[tab] ?? 0);
        }}
        scrollEventThrottle={100}
      >
        {/* Identity */}
        <View style={s.identity}>
          {profile?.avatarUrl
            ? <Image source={{ uri: profile.avatarUrl }} style={s.avatar} />
            : <View style={[s.avatar, { backgroundColor: C.glass }]} />}
          <Text style={s.name}>{profile?.displayName ?? '—'}</Text>
          <Text style={s.handle}>@{profile?.spotifyId}</Text>
        </View>

        {/* Stats */}
        <GCard style={{ padding: 14, flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 }}>
          <View style={{ alignItems: 'center', gap: 2 }}>
            <Text style={s.statVal}>{totalReviews}</Text>
            <Text style={s.statLbl}>reviews</Text>
          </View>
          {(['followers', 'following'] as const).map(type => (
            <TouchableOpacity
              key={type}
              onPress={() => router.push({ pathname: '/profile/follow-list', params: { id, type } } as any)}
              activeOpacity={0.7}
              style={{ alignItems: 'center', gap: 2 }}
            >
              <Text style={s.statVal}>{type === 'followers' ? profile?.followerCount ?? 0 : profile?.followingCount ?? 0}</Text>
              <Text style={[s.statLbl, { color: C.violet }]}>{type}</Text>
            </TouchableOpacity>
          ))}
        </GCard>

        {/* Follow button */}
        {!isOwn && (
          <TouchableOpacity
            onPress={toggleFollow}
            activeOpacity={0.7}
            disabled={busy}
            style={[s.followBtn, following && s.followingBtn]}
          >
            {busy
              ? <ActivityIndicator size="small" color={following ? C.violet : C.ink900} />
              : <Text style={[s.followTxt, following && s.followingTxt]}>
                  {following ? 'Following' : 'Follow'}
                </Text>}
          </TouchableOpacity>
        )}

        {/* Lists */}
        {lists.length > 0 && (
          <>
            <View style={{ marginTop: 20, marginBottom: 8 }}><Eyebrow>Lists</Eyebrow></View>
            <View style={{ gap: 8, marginBottom: 8 }}>
              {lists.map(l => (
                <TouchableOpacity key={l._id} onPress={() => router.push(`/list/${l._id}` as any)} activeOpacity={0.85}>
                  <GCard style={{ padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Icon name="list" size={18} color={C.violet} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.listTitle} numberOfLines={1}>{l.title}</Text>
                      <Text style={s.listMeta}>{l.items.length} {l.items.length === 1 ? 'item' : 'items'}</Text>
                    </View>
                    <Icon name="arrow-right" size={16} color={C.fg3} />
                  </GCard>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Reviews */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 10 }}>
          <Eyebrow>Reviews</Eyebrow>
          {tab && (
            <TouchableOpacity onPress={() => { setShowSearch(v => !v); setQ(''); }} activeOpacity={0.7}>
              <Icon name="search" size={16} color={showSearch ? C.violet : C.fg3} />
            </TouchableOpacity>
          )}
        </View>

        <View style={s.boxes}>
          {([['artist', 'Artist'], ['album', 'Album'], ['track', 'Song']] as const).map(([key, label]) => {
            const active = tab === key;
            return (
              <TouchableOpacity key={key} onPress={() => selectTab(key)} activeOpacity={0.75}
                style={[s.box, active && s.boxActive]}>
                <Text style={[s.boxLabel, active && s.boxLabelActive]}>{label}</Text>
                <Text style={[s.boxCount, active && s.boxCountActive]}>
                  {counts[key]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {tab && showSearch && (
          <View style={s.searchBox}>
            <Icon name="search" size={14} color={C.fg3} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search reviews…"
              placeholderTextColor={C.fg3}
              style={{ flex: 1, fontSize: 13, color: C.fg, height: 18 }}
              autoFocus
              autoCorrect={false}
              autoCapitalize="none"
            />
            {!!q && (
              <TouchableOpacity onPress={() => setQ('')} activeOpacity={0.7}>
                <Icon name="x" size={14} color={C.fg3} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {tab && (
          revLoading
            ? <ActivityIndicator color={C.violet} style={{ marginTop: 24 }} />
            : filtered && filtered.length === 0
              ? <View style={s.empty}><Icon name="activity" size={28} color={C.fg4} /><Text style={s.emptyTxt}>No reviews yet</Text></View>
              : <View style={{ gap: 10, marginTop: 8 }}>{filtered?.map(r => <ProfileReviewCard key={r._id} r={r} />)}</View>
        )}
        {revLoadingMore && <ActivityIndicator color={C.violet} style={{ marginTop: 16 }} />}
        {tab && !revLoading && !revLoadingMore && hasMoreMap[tab] === false && (cache[tab]?.length ?? 0) > 0 && (
          <Text style={s.endTxt}>All {counts[tab]} reviews loaded</Text>
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
  backBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  identity: { alignItems: 'center', gap: 8, paddingBottom: 20 },
  avatar:   { width: 88, height: 88, borderRadius: 44, borderWidth: 2, borderColor: C.violet },
  name:     { fontSize: 22, fontWeight: '600', color: C.fg, letterSpacing: -0.5 },
  handle:   { fontSize: 11, color: C.cyan, letterSpacing: 0.8 },

  statVal: { fontSize: 20, fontWeight: '600', color: C.fg, letterSpacing: -0.5 },
  statLbl: { fontSize: 9, fontWeight: '500', color: C.fg3, letterSpacing: 1.2, textTransform: 'uppercase' },

  followBtn:    { alignSelf: 'center', paddingHorizontal: 36, paddingVertical: 10, borderRadius: R.pill, backgroundColor: C.violet, marginBottom: 4 },
  followingBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.violet },
  followTxt:    { fontSize: 14, fontWeight: '600', color: C.ink900 },
  followingTxt: { color: C.violet },

  listTitle: { fontSize: 14, fontWeight: '600', color: C.fg },
  listMeta:  { fontSize: 11, color: C.fg3, marginTop: 1 },

  boxes:          { flexDirection: 'row', gap: 8, marginBottom: 12 },
  box:            { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: R.r3, backgroundColor: C.glass, borderWidth: 1, borderColor: C.stroke },
  boxActive:      { backgroundColor: 'rgba(177,78,255,0.14)', borderColor: 'rgba(177,78,255,0.5)' },
  boxLabel:       { fontSize: 12, fontWeight: '600', color: C.fg3, letterSpacing: 0.4 },
  boxLabelActive: { color: C.violet },
  boxCount:       { fontSize: 20, fontWeight: '700', color: C.fg2, letterSpacing: -0.5, marginTop: 2 },
  boxCountActive: { color: C.violet },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.glass, borderRadius: R.r2, borderWidth: 1,
    borderColor: C.stroke, paddingHorizontal: 10, paddingVertical: 7,
    marginBottom: 10,
  },

  empty:    { alignItems: 'center', gap: 10, paddingTop: 24 },
  emptyTxt: { fontSize: 13, color: C.fg3 },
  endTxt:   { fontSize: 11, color: C.fg4, textAlign: 'center', marginTop: 16, marginBottom: 8 },
});
