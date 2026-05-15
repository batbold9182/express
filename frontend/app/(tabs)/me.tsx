import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Image, TextInput, RefreshControl, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar, Eyebrow, GCard, Icon } from '../components';
import { C, R } from '../theme';
import { useAuth } from '../context/auth';
import { api } from '../lib/api';
import { ProfileReviewCard, type ProfileReview } from '../profile/ReviewCard';

type SpotifyUser   = { display_name: string; id: string; images: { url: string }[] };
type SpotifyArtist = { id: string; name: string; images: { url: string }[]; genres: string[] };
type AppUser       = { followerCount: number; followingCount: number };
type ReviewType    = 'track' | 'album' | 'artist';

export default function Profile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token, spotifyId, clearToken } = useAuth();

  const [user, setUser]           = useState<SpotifyUser | null>(null);
  const [appUser, setAppUser]     = useState<AppUser | null>(null);
  const [topArtists, setTopArtists] = useState<SpotifyArtist[]>([]);
  const [lists, setLists]         = useState<{ _id: string; title: string; items: any[] }[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nowPlaying, setNowPlaying] = useState<{ trackName: string; artistName: string; albumArt?: string; isPlaying: boolean } | null>(null);

  const [tab, setTab]             = useState<ReviewType | null>(null);
  const [q, setQ]                 = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [cache, setCache]         = useState<Partial<Record<ReviewType, ProfileReview[]>>>({});
  const [counts, setCounts]       = useState<Record<ReviewType, number>>({ track: 0, album: 0, artist: 0 });
  const [revLoading, setRevLoading] = useState(false);
  const [hasMoreMap, setHasMoreMap] = useState<Partial<Record<ReviewType, boolean>>>({});
  const [revLoadingMore, setRevLoadingMore] = useState(false);
  const offsetMap      = useRef<Partial<Record<ReviewType, number>>>({});
  const loadingMoreRef = useRef(false);
  const [timeRange, setTimeRange] = useState<'short_term' | 'medium_term' | 'long_term'>('medium_term');
  const [artistsLoading, setArtistsLoading] = useState(false);

  const reviews = tab ? (cache[tab] ?? null) : null;

  function load(isRefresh = false) {
    if (!token || !spotifyId) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    if (isRefresh) { setCache({}); offsetMap.current = {}; }
    Promise.allSettled([
      api.get('/me', token),
      api.get(`/users/${spotifyId}`, token),
      api.get(`/users/${spotifyId}/lists`, token),
      api.get(`/users/${spotifyId}/reviews/counts`, token),
    ]).then(([u, au, ls, c]) => {
      const ok = (r: PromiseSettledResult<any>) => r.status === 'fulfilled' ? r.value : null;
      setUser(ok(u));
      setAppUser(ok(au));
      setLists(ok(ls) ?? []);
      setCounts(ok(c) ?? { track: 0, album: 0, artist: 0 });
    }).finally(() => { setLoading(false); setRefreshing(false); });
  }

  useEffect(() => { load(); }, [token, spotifyId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!token) return;
    function fetchNowPlaying() {
      api.get('/me/player/currently-playing', token!).then((data: any) => {
        if (data?.item) {
          setNowPlaying({
            trackName:  data.item.name,
            artistName: data.item.artists?.map((a: any) => a.name).join(', ') ?? '',
            albumArt:   data.item.album?.images?.[2]?.url,
            isPlaying:  data.is_playing ?? false,
          });
        } else {
          setNowPlaying(null);
        }
      }).catch(() => setNowPlaying(null));
    }
    fetchNowPlaying();
    const id = setInterval(fetchNowPlaying, 30000);
    return () => clearInterval(id);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setArtistsLoading(true);
    api.get(`/me/top/artists?time_range=${timeRange}`, token)
      .then((data: any) => setTopArtists(data?.items ?? []))
      .catch(() => setTopArtists([]))
      .finally(() => setArtistsLoading(false));
  }, [token, timeRange]);

  function selectTab(type: ReviewType) {
    if (tab === type) { setTab(null); return; }
    setTab(type);
    setQ('');
    if (cache[type]) return;
    offsetMap.current[type] = 0;
    loadTabPage(type, 0);
  }

  async function loadTabPage(type: ReviewType, offset: number) {
    if (!token || !spotifyId) return;
    if (offset === 0) setRevLoading(true);
    else {
      if (loadingMoreRef.current) return;
      loadingMoreRef.current = true;
      setRevLoadingMore(true);
    }
    try {
      const data = await api.get(`/users/${spotifyId}/reviews?type=${type}&offset=${offset}&limit=20`, token) as { reviews: ProfileReview[]; hasMore: boolean };
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

  const genreMap: Record<string, number> = {};
  topArtists.forEach(a => (a.genres ?? []).slice(0, 2).forEach(g => { genreMap[g] = (genreMap[g] ?? 0) + 1; }));
  const topGenres    = Object.entries(genreMap).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const maxCount     = topGenres[0]?.[1] ?? 1;
  const GENRE_COLORS = [C.violet, C.pink, C.cyan, C.lime];

  const filtered = reviews
    ? reviews.filter(r => !q.trim() || r.trackName.toLowerCase().includes(q.toLowerCase()) || r.artistName.toLowerCase().includes(q.toLowerCase()))
    : null;

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
        pt={insets.top + 12}
        trailing={
          <TouchableOpacity activeOpacity={0.7}>
            <Icon name="share" size={22} color={C.fg2} />
          </TouchableOpacity>
        }
      />

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
          {user?.images?.[0]?.url
            ? <Image source={{ uri: user.images[0].url }} style={s.avatar} />
            : <View style={[s.avatar, { backgroundColor: C.glass }]} />}
          <Text style={s.name}>{user?.display_name ?? '—'}</Text>
          <Text style={s.handle} numberOfLines={1}>
            @{user?.id && user.id.length > 20 ? user.id.slice(0, 18) + '…' : user?.id}
          </Text>
          {nowPlaying && (
            <View style={[s.nowPlaying, !nowPlaying.isPlaying && s.nowPlayingPaused]}>
              {nowPlaying.albumArt && <Image source={{ uri: nowPlaying.albumArt }} style={s.nowArt} />}
              <View style={[s.nowDot, !nowPlaying.isPlaying && { backgroundColor: C.fg3 }]} />
              <Text style={[s.nowTxt, !nowPlaying.isPlaying && { color: C.fg3 }]} numberOfLines={1}>
                {nowPlaying.trackName} — {nowPlaying.artistName}
              </Text>
            </View>
          )}
        </View>

        {/* Stats */}
        <GCard style={{ padding: 14, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginBottom: 20 }}>
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/profile/follow-list', params: { id: spotifyId, type: 'followers' } } as any)}
            activeOpacity={0.7} style={{ alignItems: 'center', gap: 2 }}
          >
            <Text style={s.statVal}>{appUser?.followerCount ?? 0}</Text>
            <Text style={s.statLbl}>followers</Text>
          </TouchableOpacity>
          <View style={s.statDivider} />
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/profile/follow-list', params: { id: spotifyId, type: 'following' } } as any)}
            activeOpacity={0.7} style={{ alignItems: 'center', gap: 2 }}
          >
            <Text style={s.statVal}>{appUser?.followingCount ?? 0}</Text>
            <Text style={s.statLbl}>following</Text>
          </TouchableOpacity>
          <View style={s.statDivider} />
          <View style={{ alignItems: 'center', gap: 2 }}>
            <Text style={s.statVal}>{counts.track + counts.album + counts.artist}</Text>
            <Text style={s.statLbl}>reviews</Text>
          </View>
        </GCard>

        {/* Top genres */}
        {topGenres.length > 0 && (
          <>
            <Eyebrow>Top genres</Eyebrow>
            <GCard style={{ padding: 14, marginTop: 8, marginBottom: 20, gap: 10 }}>
              {topGenres.map(([name, count], i) => (
                <View key={name} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={s.genreName} numberOfLines={1}>{name}</Text>
                  <View style={s.barTrack}>
                    <View style={[s.barFill, { width: `${(count / maxCount) * 100}%` as any, backgroundColor: GENRE_COLORS[i] }]} />
                  </View>
                </View>
              ))}
            </GCard>
          </>
        )}

        {/* Top artists */}
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Eyebrow>Top artists</Eyebrow>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {([['short_term', '4 weeks'], ['medium_term', '6 months'], ['long_term', 'All time']] as const).map(([range, label]) => (
                <TouchableOpacity
                  key={range}
                  onPress={() => setTimeRange(range)}
                  activeOpacity={0.7}
                  style={[s.rangePill, timeRange === range && s.rangePillActive]}
                >
                  <Text style={[s.rangeTxt, timeRange === range && s.rangeTxtActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {artistsLoading
            ? <ActivityIndicator color={C.violet} style={{ marginTop: 8, marginBottom: 20 }} />
            : topArtists.length > 0 && (
              <View style={{ gap: 8, marginTop: 0, marginBottom: 20 }}>
                {topArtists.map((a, i) => (
                  <TouchableOpacity key={a.id} activeOpacity={0.8} onPress={() => router.push(`/artist/${a.id}` as any)}>
                    <GCard style={{ padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={[s.rankBadge, i < 3 && s.rankBadgeTop]}>
                        <Text style={[s.artistRank, i < 3 && { color: C.violet }]}>{i + 1}</Text>
                      </View>
                      {a.images?.[2]?.url
                        ? <Image source={{ uri: a.images[2].url }} style={s.artistImg} />
                        : <View style={[s.artistImg, { backgroundColor: C.glass }]} />}
                      <View style={{ flex: 1 }}>
                        <Text style={s.artistName}>{a.name}</Text>
                        {a.genres?.[0] && <Text style={s.artistGenre} numberOfLines={1}>{a.genres[0]}</Text>}
                      </View>
                      <Icon name="arrow-right" size={14} color={C.fg4} />
                    </GCard>
                  </TouchableOpacity>
                ))}
              </View>
            )
          }
        </>

        {/* My lists */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Eyebrow>My lists</Eyebrow>
          <TouchableOpacity onPress={() => router.push('/list/create' as any)} activeOpacity={0.7} style={s.newListBtn}>
            <Icon name="plus" size={14} color={C.violet} />
            <Text style={s.newListTxt}>New</Text>
          </TouchableOpacity>
        </View>
        {lists.length === 0 ? (
          <GCard style={{ padding: 14, alignItems: 'center', gap: 6, marginBottom: 20 }}>
            <Text style={s.emptyTxt}>No lists yet</Text>
          </GCard>
        ) : (
          <View style={{ gap: 8, marginBottom: 20 }}>
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
        )}

        {/* Reviews */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <Eyebrow>My reviews</Eyebrow>
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
              ? <View style={s.empty}><Icon name="activity" size={28} color={C.fg3} /><Text style={s.emptyTxt}>No reviews yet</Text></View>
              : <View style={{ gap: 10, marginTop: 8 }}>{filtered?.map(r => <ProfileReviewCard key={r._id} r={r} />)}</View>
        )}
        {revLoadingMore && <ActivityIndicator color={C.violet} style={{ marginTop: 16 }} />}
        {tab && !revLoading && !revLoadingMore && hasMoreMap[tab] === false && (cache[tab]?.length ?? 0) > 0 && (
          <Text style={s.endTxt}>All {counts[tab]} reviews loaded</Text>
        )}

        <TouchableOpacity
          style={s.logoutBtn}
          activeOpacity={0.7}
          onPress={() => Alert.alert('Log out', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Log out', style: 'destructive', onPress: clearToken },
          ])}
        >
          <Text style={s.logoutTxt}>Log out</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },

  scroll: { flex: 1 },

  identity: { alignItems: 'center', gap: 8, paddingBottom: 20 },
  avatar:   { width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: C.violet },
  name:     { fontSize: 24, fontWeight: '600', color: C.fg, letterSpacing: -0.5 },
  handle:   { fontSize: 12, color: C.cyan, letterSpacing: 0.8 },

  statVal:     { fontSize: 22, fontWeight: '600', color: C.fg, letterSpacing: -0.5 },
  statLbl:     { fontSize: 10, fontWeight: '500', color: C.fg3, letterSpacing: 1.2, textTransform: 'uppercase' },
  statDivider: { width: 1, height: 32, backgroundColor: C.stroke },

  genreName: { width: 120, fontSize: 12, fontWeight: '500', color: C.fg },
  barTrack:  { flex: 1, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  barFill:   { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 4 },

  rankBadge:    { width: 26, height: 26, borderRadius: 13, backgroundColor: C.glass, alignItems: 'center', justifyContent: 'center' },
  rankBadgeTop: { backgroundColor: 'rgba(177,78,255,0.18)' },
  artistRank:   { fontSize: 12, fontWeight: '700', color: C.fg3, letterSpacing: -0.5 },
  artistImg:   { width: 44, height: 44, borderRadius: 22 },
  artistName:  { fontSize: 14, fontWeight: '600', color: C.fg },
  artistGenre: { fontSize: 12, color: C.fg3, marginTop: 1 },

  nowPlaying:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: R.pill, backgroundColor: 'rgba(29,185,84,0.12)', borderWidth: 1, borderColor: 'rgba(29,185,84,0.35)', maxWidth: 260 },
  nowPlayingPaused: { backgroundColor: C.glassThin, borderColor: C.stroke },
  nowArt:           { width: 18, height: 18, borderRadius: 3 },
  nowDot:           { width: 6, height: 6, borderRadius: 3, backgroundColor: '#1DB954' },
  nowTxt:           { fontSize: 12, fontWeight: '500', color: '#1DB954', flex: 1 },

  newListBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.pill, borderWidth: 1, borderColor: C.violet },
  newListTxt: { fontSize: 12, fontWeight: '600', color: C.violet },
  listTitle:  { fontSize: 14, fontWeight: '600', color: C.fg },
  listMeta:   { fontSize: 12, color: C.fg3, marginTop: 1 },

  boxes:         { flexDirection: 'row', gap: 8, marginBottom: 12 },
  box:           { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: R.r3, backgroundColor: C.glass, borderWidth: 1, borderColor: C.stroke },
  boxActive:     { backgroundColor: 'rgba(177,78,255,0.14)', borderColor: 'rgba(177,78,255,0.5)' },
  boxLabel:      { fontSize: 12, fontWeight: '600', color: C.fg3, letterSpacing: 0.4 },
  boxLabelActive:{ color: C.violet },
  boxCount:      { fontSize: 20, fontWeight: '700', color: C.fg2, letterSpacing: -0.5, marginTop: 2 },
  boxCountActive:{ color: C.violet },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.glass, borderRadius: R.r2, borderWidth: 1,
    borderColor: C.stroke, paddingHorizontal: 10, paddingVertical: 7,
    marginBottom: 10,
  },

  empty:    { alignItems: 'center', gap: 10, paddingTop: 24 },
  emptyTxt: { fontSize: 13, color: C.fg3 },
  endTxt:   { fontSize: 12, color: C.fg4, textAlign: 'center', marginTop: 16, marginBottom: 8 },

  rangePill:       { paddingHorizontal: 8, paddingVertical: 4, borderRadius: R.pill, backgroundColor: C.glassThin, borderWidth: 1, borderColor: C.stroke },
  rangePillActive: { backgroundColor: 'rgba(177,78,255,0.15)', borderColor: 'rgba(177,78,255,0.5)' },
  rangeTxt:        { fontSize: 11, fontWeight: '600', color: C.fg3 },
  rangeTxtActive:  { color: C.violet },

  logoutBtn: { alignItems: 'center', marginTop: 32, marginBottom: 8, paddingVertical: 12 },
  logoutTxt: { fontSize: 14, fontWeight: '500', color: C.fg3 },
});
