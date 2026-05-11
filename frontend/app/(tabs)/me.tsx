import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Image, TextInput } from 'react-native';
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
  const [nowPlaying, setNowPlaying] = useState<{ trackName: string; artistName: string; albumArt?: string; isPlaying: boolean } | null>(null);

  const [tab, setTab]             = useState<ReviewType | null>(null);
  const [q, setQ]                 = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [cache, setCache]         = useState<Partial<Record<ReviewType, ProfileReview[]>>>({});
  const [counts, setCounts]       = useState<Record<ReviewType, number>>({ track: 0, album: 0, artist: 0 });
  const [revLoading, setRevLoading] = useState(false);

  const reviews = tab ? (cache[tab] ?? null) : null;

  useEffect(() => {
    if (!token || !spotifyId) return;
    Promise.all([
      api.get('/me', token),
      api.get('/me/top/artists', token),
      api.get(`/users/${spotifyId}`, token),
      api.get(`/users/${spotifyId}/lists`, token),
      api.get(`/users/${spotifyId}/reviews/counts`, token),
    ]).then(([u, a, au, ls, c]) => {
      setUser(u);
      setTopArtists(a.items ?? []);
      setAppUser(au);
      setLists(ls);
      setCounts(c);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [token, spotifyId]);

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

  function selectTab(type: ReviewType) {
    if (tab === type) { setTab(null); return; }
    setTab(type);
    setQ('');
    if (cache[type]) return; // already loaded
    if (!token || !spotifyId) return;
    setRevLoading(true);
    api.get(`/users/${spotifyId}/reviews?type=${type}`, token)
      .then((data: ProfileReview[]) => setCache(prev => ({ ...prev, [type]: data })))
      .catch(() => setCache(prev => ({ ...prev, [type]: [] })))
      .finally(() => setRevLoading(false));
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
      <View style={s.glow} pointerEvents="none" />
      <TopBar
        pt={insets.top + 12}
        leading={
          <TouchableOpacity activeOpacity={0.7} onPress={clearToken}>
            <Icon name="settings" size={22} color={C.fg2} />
          </TouchableOpacity>
        }
        trailing={
          <TouchableOpacity activeOpacity={0.7}>
            <Icon name="share" size={22} color={C.fg2} />
          </TouchableOpacity>
        }
      />

      <ScrollView style={s.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

        {/* Identity */}
        <View style={s.identity}>
          {user?.images?.[0]?.url
            ? <Image source={{ uri: user.images[0].url }} style={s.avatar} />
            : <View style={[s.avatar, { backgroundColor: C.glass }]} />}
          <Text style={s.name}>{user?.display_name ?? '—'}</Text>
          <Text style={s.handle}>@{user?.id}</Text>
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
        <GCard style={{ padding: 14, flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 }}>
          {(['followers', 'following'] as const).map(type => (
            <TouchableOpacity
              key={type}
              onPress={() => router.push({ pathname: '/profile/follow-list', params: { id: spotifyId, type } } as any)}
              activeOpacity={0.7}
              style={{ alignItems: 'center', gap: 2 }}
            >
              <Text style={s.statVal}>{type === 'followers' ? appUser?.followerCount ?? 0 : appUser?.followingCount ?? 0}</Text>
              <Text style={[s.statLbl, { color: C.violet }]}>{type}</Text>
            </TouchableOpacity>
          ))}
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
        {topArtists.length > 0 && (
          <>
            <Eyebrow>Top artists</Eyebrow>
            <View style={{ gap: 8, marginTop: 8, marginBottom: 20 }}>
              {topArtists.map((a, i) => (
                <GCard key={a.id} style={{ padding: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Text style={s.artistRank}>{i + 1}</Text>
                  {a.images?.[2]?.url
                    ? <Image source={{ uri: a.images[2].url }} style={s.artistImg} />
                    : <View style={[s.artistImg, { backgroundColor: C.glass }]} />}
                  <View style={{ flex: 1 }}>
                    <Text style={s.artistName}>{a.name}</Text>
                    {a.genres?.[0] && <Text style={s.artistGenre} numberOfLines={1}>{a.genres[0]}</Text>}
                  </View>
                </GCard>
              ))}
            </View>
          </>
        )}

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
                  <Icon name="arrow-left" size={16} color={C.fg3} />
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
            const loaded = cache[key];
            return (
              <TouchableOpacity key={key} onPress={() => selectTab(key)} activeOpacity={0.75}
                style={[s.box, active && s.boxActive]}>
                <Text style={[s.boxLabel, active && s.boxLabelActive]}>{label}</Text>
                <Text style={[s.boxCount, active && s.boxCountActive]}>
                  {loaded ? loaded.length : counts[key]}
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

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  glow:   { position: 'absolute', top: 0, left: 0, right: 0, height: 260, backgroundColor: 'rgba(177,78,255,0.08)' },
  scroll: { flex: 1 },

  identity: { alignItems: 'center', gap: 8, paddingBottom: 20 },
  avatar:   { width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: C.violet },
  name:     { fontSize: 24, fontWeight: '600', color: C.fg, letterSpacing: -0.5 },
  handle:   { fontSize: 11, color: C.cyan, letterSpacing: 0.8 },

  statVal: { fontSize: 22, fontWeight: '600', color: C.fg, letterSpacing: -0.5 },
  statLbl: { fontSize: 9, fontWeight: '500', color: C.fg3, letterSpacing: 1.2, textTransform: 'uppercase' },

  genreName: { width: 120, fontSize: 12, fontWeight: '500', color: C.fg },
  barTrack:  { flex: 1, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  barFill:   { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 4 },

  artistRank:  { width: 24, fontSize: 18, fontWeight: '600', color: C.fg3, letterSpacing: -0.5 },
  artistImg:   { width: 40, height: 40, borderRadius: 20 },
  artistName:  { fontSize: 14, fontWeight: '600', color: C.fg },
  artistGenre: { fontSize: 11, color: C.fg3, marginTop: 1 },

  nowPlaying:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: R.pill, backgroundColor: 'rgba(29,185,84,0.12)', borderWidth: 1, borderColor: 'rgba(29,185,84,0.35)', maxWidth: 260 },
  nowPlayingPaused: { backgroundColor: C.glassThin, borderColor: C.stroke },
  nowArt:           { width: 18, height: 18, borderRadius: 3 },
  nowDot:           { width: 6, height: 6, borderRadius: 3, backgroundColor: '#1DB954' },
  nowTxt:           { fontSize: 11, fontWeight: '500', color: '#1DB954', flex: 1 },

  newListBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.pill, borderWidth: 1, borderColor: C.violet },
  newListTxt: { fontSize: 11, fontWeight: '600', color: C.violet },
  listTitle:  { fontSize: 14, fontWeight: '600', color: C.fg },
  listMeta:   { fontSize: 11, color: C.fg3, marginTop: 1 },

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
});
