import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity, ActivityIndicator, Alert, TextInput, Dimensions, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Eyebrow, Icon, Score } from '../components';
import { C, R, scoreColor } from '../theme';
import { useAuth } from '../context/auth';
import { useRate } from '../context/rate';
import { api } from '../lib/api';
import { shareUrl } from '../lib/share';
import { ProfileReviewCard, type ProfileReview } from '../profile/ReviewCard';

type SpotifyArtist = {
  id: string;
  name: string;
  images: { url: string }[];
  genres: string[];
  followers?: { total: number };
};

type SpotifyAlbum = {
  id: string;
  name: string;
  release_date: string;
  images: { url: string }[];
};

type GroupData = {
  items: SpotifyAlbum[];
  total: number;
  loading: boolean;
  nextOffset: number | null;
};

type ArtistReview = ProfileReview & { type?: string };

function formatFollowers(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

const DISC_SECTIONS = [
  { key: 'album',       label: 'Albums' },
  { key: 'single',      label: 'Singles & EPs' },
  { key: 'compilation', label: 'Compilations' },
  { key: 'appears_on',  label: 'Appears On' },
] as const;

const PAGE_SIZE = 20;
const CARD_WIDTH = Math.floor((Dimensions.get('window').width - 32 - 24) / 3);

export default function ArtistDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const { setItem } = useRate();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [artist, setArtist]     = useState<SpotifyArtist | null>(null);
  const [reviews, setReviews]   = useState<ArtistReview[]>([]);
  const [avgScore, setAvgScore] = useState<number | null>(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);

  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [groupData, setGroupData]     = useState<Record<string, GroupData>>({});
  const loadingGroups = useRef(new Set<string>());
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch]   = useState(false);
  const [reviewHasMore, setReviewHasMore] = useState(true);
  const [revLoadingMore, setRevLoadingMore] = useState(false);
  const [reviewTotal, setReviewTotal] = useState(0);
  const reviewOffsetRef = useRef(0);
  const reviewLoadingMoreRef = useRef(false);

  function load(isRefresh = false) {
    if (!token || !id) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(false);
    reviewOffsetRef.current = 0;
    Promise.allSettled([
      api.get(`/artists/${id}`, token),
      api.get(`/artists/${id}/reviews?offset=0&limit=20`, token),
      api.get('/reviews/mine', token),
    ]).then((results) => {
      if (results[0].status === 'rejected') { setError(true); return; }
      const ok = (r: PromiseSettledResult<unknown>) => r.status === 'fulfilled' ? r.value as any : null;
      const art     = ok(results[0]);
      const revData = ok(results[1]);
      const mine: any[] = ok(results[2]) ?? [];
      if (art) setArtist(art);
      if (revData) {
        setReviews(revData.reviews ?? []);
        setAvgScore(revData.avgScore ?? null);
        setReviewHasMore(revData.hasMore ?? false);
        setReviewTotal(revData.total ?? 0);
        reviewOffsetRef.current = (revData.reviews ?? []).length;
      }
      setAlreadyReviewed(mine.some((r: any) => r.type === 'artist' && r.spotifyArtistId === id));
    }).finally(() => { setLoading(false); setRefreshing(false); });
  }

  async function loadMoreReviews() {
    if (!token || !id || !reviewHasMore || reviewLoadingMoreRef.current) return;
    reviewLoadingMoreRef.current = true;
    setRevLoadingMore(true);
    try {
      const data = await api.get(`/artists/${id}/reviews?offset=${reviewOffsetRef.current}&limit=20`, token);
      setReviews(prev => [...prev, ...(data.reviews ?? [])]);
      setReviewHasMore(data.hasMore ?? false);
      reviewOffsetRef.current += (data.reviews ?? []).length;
    } catch {} finally {
      reviewLoadingMoreRef.current = false;
      setRevLoadingMore(false);
    }
  }

  useEffect(() => { load(); }, [id, token]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadGroup = useCallback(async (group: string, offset: number) => {
    if (loadingGroups.current.has(group)) return;
    loadingGroups.current.add(group);
    setGroupData(prev => ({
      ...prev,
      [group]: { items: prev[group]?.items ?? [], total: prev[group]?.total ?? 0, nextOffset: prev[group]?.nextOffset ?? null, loading: true },
    }));
    try {
      const data = await api.get(`/artists/${id}/albums?group=${group}&limit=${PAGE_SIZE}&offset=${offset}`, token!);
      setGroupData(prev => ({
        ...prev,
        [group]: {
          items: offset === 0 ? (data.items ?? []) : [...(prev[group]?.items ?? []), ...(data.items ?? [])],
          total: data.total ?? 0,
          loading: false,
          nextOffset: (data.items?.length ?? 0) === PAGE_SIZE ? offset + PAGE_SIZE : null,
        },
      }));
    } catch {
      setGroupData(prev => ({ ...prev, [group]: { ...(prev[group] ?? { items: [], total: 0, nextOffset: null }), loading: false } }));
    } finally {
      loadingGroups.current.delete(group);
    }
  }, [id, token]);

  function selectGroup(key: string) {
    setSearchQuery('');
    setShowSearch(false);
    if (activeGroup === key) { setActiveGroup(null); return; }
    setActiveGroup(key);
    if (!groupData[key]?.items.length && !loadingGroups.current.has(key)) loadGroup(key, 0);
  }

  function onScroll({ nativeEvent }: any) {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    if (layoutMeasurement.height + contentOffset.y < contentSize.height - 300) return;
    if (activeGroup) {
      const gd = groupData[activeGroup];
      if (gd && !gd.loading && gd.nextOffset !== null) loadGroup(activeGroup, gd.nextOffset);
    }
    if (reviewHasMore && !reviewLoadingMoreRef.current) loadMoreReviews();
  }

  function rateArtist() {
    if (!artist) return;
    if (alreadyReviewed) {
      Alert.alert('Already reviewed', "You've already rated this artist. Delete your existing review to post a new one.");
      return;
    }
    setItem({
      type: 'artist',
      spotifyArtistId: artist.id,
      trackName: artist.name,
      artistName: artist.genres?.[0] ?? 'Artist',
      albumArt: artist.images[0]?.url ?? '',
    });
    router.push('/(tabs)/rate');
  }

  const activeData = activeGroup ? groupData[activeGroup] : null;
  const filteredItems = (activeData?.items ?? []).filter(a =>
    !searchQuery.trim() || a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <View style={[s.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={C.violet} size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[s.screen, { alignItems: 'center', justifyContent: 'center', gap: 12 }]}>
        <Icon name="wifi-off" size={32} color={C.fg3} />
        <Text style={{ color: C.fg, fontWeight: '600', fontSize: 16 }}>Something went wrong</Text>
        <TouchableOpacity onPress={() => load()} activeOpacity={0.7} style={s.retryBtn}>
          <Text style={s.retryTxt}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!artist) {
    return (
      <View style={[s.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: C.fg3 }}>Artist not found.</Text>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <View style={[s.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={s.backBtn}>
          <Icon name="arrow-left" size={22} color={C.fg} />
        </TouchableOpacity>
        <Text style={s.topBarTitle} numberOfLines={1}>{artist.name}</Text>
        <TouchableOpacity onPress={() => shareUrl(`https://open.spotify.com/artist/${artist.id}`, artist.name)} activeOpacity={0.7} style={s.backBtn}>
          <Icon name="share" size={18} color={C.fg} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.violet} />}
        onScroll={onScroll}
        scrollEventThrottle={200}
      >
        {/* Hero */}
        <View style={s.hero}>
          {artist.images[0]?.url
            ? <Image source={{ uri: artist.images[0].url }} style={s.cover} />
            : <View style={[s.cover, { backgroundColor: C.glass }]} />}
          <Text style={s.artistName}>{artist.name}</Text>
          {artist.genres?.[0] && (
            <Text style={s.genre}>{artist.genres.slice(0, 2).join(' · ')}</Text>
          )}
          {(artist.followers?.total ?? 0) > 0 && (
            <Text style={s.followers}>{formatFollowers(artist.followers!.total)} followers</Text>
          )}
          {avgScore !== null && (
            <View style={s.scoreRow}>
              <Score value={avgScore} size="xl" glow />
              <Text style={s.avgLabel}>avg · {reviewTotal} {reviewTotal === 1 ? 'review' : 'reviews'}</Text>
            </View>
          )}
        </View>

        {/* Rate button */}
        {alreadyReviewed ? (
          <TouchableOpacity onPress={rateArtist} activeOpacity={0.85} style={s.rateBtnReviewed}>
            <Icon name="star" size={16} color={C.violet} />
            <Text style={s.rateTxtReviewed}>Already reviewed</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={rateArtist} activeOpacity={0.85} style={{ borderRadius: R.pill, overflow: 'hidden' }}>
            <LinearGradient colors={['#B14EFF', '#FF3FA4']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.rateBtn}>
              <Icon name="star" size={16} color={C.ink900} />
              <Text style={s.rateTxt}>Rate this artist</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Discography */}
        <View style={{ marginTop: 28 }}>
          <View style={s.discHeader}>
            <Eyebrow>Discography</Eyebrow>
            {activeGroup && (
              <TouchableOpacity onPress={() => { setShowSearch(v => !v); setSearchQuery(''); }} activeOpacity={0.7}>
                <Icon name="search" size={16} color={showSearch ? C.violet : C.fg3} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
            {DISC_SECTIONS.map(({ key, label }) => {
              const active = activeGroup === key;
              const total  = groupData[key]?.total;
              return (
                <TouchableOpacity key={key} onPress={() => selectGroup(key)} activeOpacity={0.7}
                  style={[s.discTab, active && s.discTabActive]}>
                  <Text style={[s.discTabTxt, active && s.discTabTxtActive]}>{label}</Text>
                  {total != null && <Text style={[s.discTabCount, active && s.discTabCountActive]}> · {total}</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {activeGroup && showSearch && (
            <View style={s.searchBox}>
              <Icon name="search" size={14} color={C.fg3} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search releases…"
                placeholderTextColor={C.fg3}
                style={{ flex: 1, fontSize: 13, color: C.fg, height: 18 }}
                autoFocus
                autoCorrect={false}
                autoCapitalize="none"
              />
              {!!searchQuery && (
                <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
                  <Icon name="x" size={14} color={C.fg3} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {activeGroup && (
            activeData?.loading && !activeData.items.length
              ? <ActivityIndicator color={C.violet} style={{ marginTop: 24 }} />
              : (
                <>
                  <View style={s.albumGrid}>
                    {filteredItems.map(album => (
                      <TouchableOpacity
                        key={album.id}
                        activeOpacity={0.8}
                        style={s.albumCard}
                        onPress={() => router.push(`/album/${album.id}` as any)}
                      >
                        {album.images?.[1]?.url
                          ? <Image source={{ uri: album.images[1].url }} style={s.albumCover} />
                          : <View style={[s.albumCover, { backgroundColor: C.glass }]} />}
                        <Text style={s.albumName} numberOfLines={2}>{album.name}</Text>
                        <Text style={s.albumMeta}>{album.release_date?.slice(0, 4)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {activeData?.loading && activeData.items.length > 0 && (
                    <ActivityIndicator color={C.violet} style={{ marginTop: 16 }} />
                  )}
                  {!activeData?.loading && activeData?.nextOffset === null && activeData.items.length > 0 && !searchQuery && (
                    <Text style={s.endTxt}>All {activeData.total} releases loaded</Text>
                  )}
                </>
              )
          )}
        </View>

        {/* Reviews */}
        <View style={{ marginTop: 28, marginBottom: 10 }}><Eyebrow>Reviews</Eyebrow></View>
        {reviews.length === 0 ? (
          <View style={s.empty}>
            <Icon name="activity" size={28} color={C.fg3} />
            <Text style={s.emptyTxt}>No reviews yet — be the first!</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {reviews.map(r => <ProfileReviewCard key={r._id} r={r} />)}
          </View>
        )}
        {revLoadingMore && <ActivityIndicator color={C.violet} style={{ marginTop: 16 }} />}
        {!reviewHasMore && reviews.length > 0 && <Text style={s.endTxt}>All {reviewTotal} reviews loaded</Text>}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },

  scroll: { flex: 1 },

  topBar:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  topBarTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: C.fg, textAlign: 'center' },
  backBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  hero:       { alignItems: 'center', gap: 6, paddingBottom: 20 },
  cover:      { width: 200, height: 200, borderRadius: 100, borderWidth: 2, borderColor: C.violet, marginBottom: 8, shadowColor: C.violet, shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: 0 } },
  artistName: { fontSize: 24, fontWeight: '700', color: C.fg, letterSpacing: -0.5, textAlign: 'center' },
  genre:      { fontSize: 12, color: C.violet, fontWeight: '500', letterSpacing: 0.4 },
  followers:  { fontSize: 12, color: C.fg3 },

  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6 },
  avgScore: { fontSize: 36, fontWeight: '700', letterSpacing: -1 },
  avgLabel: { fontSize: 12, color: C.fg3 },

  rateBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, borderRadius: R.pill, shadowColor: C.violet, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 8 },
  rateBtnReviewed: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: R.pill, borderWidth: 1, borderColor: C.violet },
  rateTxt:         { fontSize: 15, fontWeight: '700', color: C.ink900 },
  rateTxtReviewed: { fontSize: 15, fontWeight: '700', color: C.violet },

  discHeader:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  discTab:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 14, borderRadius: R.pill, backgroundColor: C.glassThin, borderWidth: 1, borderColor: C.stroke },
  discTabActive:    { backgroundColor: 'rgba(177,78,255,0.15)', borderColor: 'rgba(177,78,255,0.5)' },
  discTabTxt:       { fontSize: 12, fontWeight: '600', color: C.fg3 },
  discTabTxtActive: { color: C.violet },
  discTabCount:     { fontSize: 12, color: C.fg4 },
  discTabCountActive: { color: C.violet },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.glass, borderRadius: R.r2, borderWidth: 1,
    borderColor: C.stroke, paddingHorizontal: 10, paddingVertical: 7,
    marginBottom: 10,
  },

  albumGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  albumCard:  { width: CARD_WIDTH },
  albumCover: { width: CARD_WIDTH, height: CARD_WIDTH, borderRadius: R.r3, marginBottom: 6 },
  albumName:  { fontSize: 12, fontWeight: '600', color: C.fg, lineHeight: 17 },
  albumMeta:  { fontSize: 12, color: C.fg3, marginTop: 2 },

  endTxt:   { fontSize: 12, color: C.fg4, textAlign: 'center', marginTop: 16 },
  empty:    { alignItems: 'center', gap: 10, paddingTop: 24 },
  emptyTxt: { fontSize: 13, color: C.fg3 },

  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: R.pill, backgroundColor: C.violet },
  retryTxt: { fontSize: 14, fontWeight: '700', color: C.ink900 },
});
