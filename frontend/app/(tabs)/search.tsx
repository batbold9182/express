import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Image, ActivityIndicator, Alert } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Eyebrow, Icon } from '../components';
import { C, R, scoreColor } from '../theme';
import { useAuth } from '../context/auth';
import { api } from '../lib/api';

type Track  = { id: string; name: string; artists: { name: string }[]; album: { id: string; images: { url: string }[] } };
type Album  = { id: string; name: string; artists: { name: string }[]; images: { url: string }[] };
type Artist = { id: string; name: string; images: { url: string }[]; genres: string[] };
type UserResult = { _id: string; spotifyId: string; displayName: string; avatarUrl: string; isFollowing: boolean };
type TrendingItem = {
  _id: string;
  type?: 'track' | 'album' | 'artist';
  trackName: string;
  artistName: string;
  albumArt: string;
  score: number;
  spotifyTrackId?: string;
  spotifyAlbumId?: string;
  spotifyArtistId?: string;
};

const SCOPES   = ['All', 'Songs', 'Albums', 'Artists', 'People'];
const TYPE_MAP = ['track,album,artist', 'track', 'album', 'artist'];

function ReviewedBadge() {
  return (
    <View style={s.reviewedBadge}>
      <Text style={s.reviewedTxt}>Reviewed</Text>
    </View>
  );
}

function UserRow({ user, token, myId }: { user: UserResult; token: string; myId: string }) {
  const router = useRouter();
  const [following, setFollowing] = useState(user.isFollowing);
  const [busy, setBusy] = useState(false);
  const isOwn = user.spotifyId === myId;

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      if (following) {
        await api.del(`/users/${user.spotifyId}/follow`, token);
        setFollowing(false);
      } else {
        await api.post(`/users/${user.spotifyId}/follow`, token, {});
        setFollowing(true);
      }
    } catch {} finally { setBusy(false); }
  }

  return (
    <TouchableOpacity
      onPress={() => router.push(`/profile/${user.spotifyId}` as any)}
      activeOpacity={0.85}
      style={s.userRow}
    >
      {user.avatarUrl
        ? <Image source={{ uri: user.avatarUrl }} style={s.userAvatar} />
        : <View style={[s.userAvatar, { backgroundColor: C.glass }]} />}
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle} numberOfLines={1}>{user.displayName}</Text>
        <Text style={s.rowSub} numberOfLines={1}>@{user.spotifyId}</Text>
      </View>
      {!isOwn && (
        <TouchableOpacity
          onPress={toggle}
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
    </TouchableOpacity>
  );
}

export default function Search() {
  const [q, setQ]             = useState('');
  const [scope, setScope]     = useState(0);
  const [loading, setLoading] = useState(false);
  const [tracks, setTracks]   = useState<Track[]>([]);
  const [albums, setAlbums]   = useState<Album[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [users, setUsers]     = useState<UserResult[]>([]);
  const [trending, setTrending] = useState<TrendingItem[]>([]);
  const [recents, setRecents]   = useState<string[]>([]);
  const [reviewedTrackIds, setReviewedTrackIds]   = useState<Set<string>>(new Set());
  const [reviewedAlbumIds, setReviewedAlbumIds]   = useState<Set<string>>(new Set());
  const [reviewedArtistIds, setReviewedArtistIds] = useState<Set<string>>(new Set());
  const { token, spotifyId }  = useAuth();
  const router                = useRouter();
  const insets                = useSafeAreaInsets();
  const timer                 = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isPeople = scope === 4;

  useEffect(() => {
    if (!token) return;
    api.get('/reviews/mine', token).then((data: any[]) => {
      const trackIds  = new Set<string>();
      const albumIds  = new Set<string>();
      const artistIds = new Set<string>();
      data.forEach(r => {
        if (r.type === 'artist' && r.spotifyArtistId) artistIds.add(r.spotifyArtistId);
        else if (r.type === 'album' && r.spotifyAlbumId) albumIds.add(r.spotifyAlbumId);
        else if (r.spotifyTrackId) trackIds.add(r.spotifyTrackId);
      });
      setReviewedTrackIds(trackIds);
      setReviewedAlbumIds(albumIds);
      setReviewedArtistIds(artistIds);
    }).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token) return;
    api.get('/reviews/trending?offset=0&limit=5', token)
      .then((data: any) => setTrending(data.items ?? []))
      .catch(() => {});
  }, [token]);

  function addRecent(term: string) {
    const t = term.trim();
    if (!t) return;
    setRecents(prev => [t, ...prev.filter(r => r !== t)].slice(0, 5));
  }

  function navigateTrending(item: TrendingItem) {
    if (item.type === 'artist' && item.spotifyArtistId) router.push(`/artist/${item.spotifyArtistId}` as any);
    else if (item.type === 'album' && item.spotifyAlbumId) router.push(`/album/${item.spotifyAlbumId}` as any);
    else if (item.spotifyTrackId) router.push(`/song/${item.spotifyTrackId}` as any);
    else if (item.spotifyAlbumId) router.push(`/album/${item.spotifyAlbumId}` as any);
  }

  function selectTrack(t: Track) {
    router.push(`/song/${t.id}` as any);
  }

  function selectAlbum(a: Album) {
    router.push(`/album/${a.id}` as any);
  }

  useEffect(() => {
    if (!q.trim() || !token) {
      setTracks([]); setAlbums([]); setArtists([]); setUsers([]);
      return;
    }
    const controller = new AbortController();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        if (isPeople) {
          const data = await api.get(`/users/search?q=${encodeURIComponent(q)}`, token, controller.signal);
          setUsers(data);
        } else {
          const data = await api.get(`/search?q=${encodeURIComponent(q)}&type=${TYPE_MAP[scope]}`, token, controller.signal);
          setTracks(data.tracks?.items ?? []);
          setAlbums(data.albums?.items ?? []);
          setArtists(data.artists?.items ?? []);
          setUsers([]);
        }
        addRecent(q);
      } catch (e: any) {
        if (e.name === 'AbortError') return;
        setTracks([]); setAlbums([]); setArtists([]); setUsers([]);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => { controller.abort(); if (timer.current) clearTimeout(timer.current); };
  }, [q, scope, token]);

  const hasSpotifyResults = tracks.length > 0 || albums.length > 0 || artists.length > 0;

  return (
    <View style={s.screen}>

      <BlurView intensity={70} tint="dark" style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View style={s.searchBox}>
          <Icon name="search" size={18} color={C.fg3} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={isPeople ? 'Search people by name' : 'Search songs, albums, artists'}
            placeholderTextColor={C.fg3}
            style={s.input}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {!!q && (
            <TouchableOpacity onPress={() => setQ('')} activeOpacity={0.7}>
              <Icon name="x" size={16} color={C.fg3} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }} contentContainerStyle={{ gap: 6 }}>
          {SCOPES.map((sc, i) => (
            <TouchableOpacity key={sc} onPress={() => setScope(i)} activeOpacity={0.7}
              style={[s.scopeChip, i === scope && s.scopeActive]}>
              <Text style={[s.scopeTxt, { color: i === scope ? C.violet : C.fg3 }]}>{sc}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </BlurView>

      <ScrollView style={s.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {loading && <ActivityIndicator color={C.violet} style={{ marginTop: 40 }} />}

        {/* Empty state — recents + trending */}
        {!loading && !q && !isPeople && (
          <>
            {recents.length > 0 && (
              <>
                <Eyebrow>Recent</Eyebrow>
                <View style={{ gap: 2, marginBottom: 24 }}>
                  {recents.map(r => (
                    <TouchableOpacity key={r} onPress={() => setQ(r)} activeOpacity={0.7} style={s.recentRow}>
                      <Icon name="search" size={14} color={C.fg3} />
                      <Text style={s.recentTxt} numberOfLines={1}>{r}</Text>
                      <Icon name="arrow-right" size={13} color={C.fg4} />
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {trending.length > 0 && (
              <>
                <View style={s.trendingHeader}>
                  <Text style={s.trendingFire}>🔥</Text>
                  <Eyebrow>Trending now</Eyebrow>
                </View>
                <View style={{ gap: 8, marginTop: 8 }}>
                  {trending.map((item, i) => (
                    <TouchableOpacity key={item._id} onPress={() => navigateTrending(item)} activeOpacity={0.85} style={s.trendRow}>
                      <View style={[s.trendRankBadge, i === 0 && s.trendRankFirst]}>
                        <Text style={[s.trendRank, i === 0 && s.trendRankFirstTxt]}>{i + 1}</Text>
                      </View>
                      {item.albumArt
                        ? <Image source={{ uri: item.albumArt }} style={s.trendArt} />
                        : <View style={[s.trendArt, { backgroundColor: C.glass }]} />}
                      <View style={{ flex: 1 }}>
                        <Text style={s.trendName} numberOfLines={1}>{item.trackName}</Text>
                        <Text style={s.trendArtist} numberOfLines={1}>{item.artistName}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[s.trendScore, { color: scoreColor(item.score) }]}>{item.score.toFixed(1)}</Text>
                        <Text style={s.trendDenom}>/10</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </>
        )}

        {!loading && !q && isPeople && (
          <View style={s.emptyWrap}>
            <Icon name="search" size={32} color={C.fg3} />
            <Text style={s.emptyTxt}>Find people to follow.</Text>
          </View>
        )}

        {!loading && !!q && !hasSpotifyResults && !isPeople && (
          <View style={s.emptyWrap}>
            <Text style={s.emptyTxt}>No results for &quot;{q}&quot;</Text>
          </View>
        )}

        {!loading && !!q && isPeople && users.length === 0 && (
          <View style={s.emptyWrap}>
            <Text style={s.emptyTxt}>No users found for &quot;{q}&quot;</Text>
          </View>
        )}

        {/* People results */}
        {!loading && isPeople && users.length > 0 && (
          <>
            <Eyebrow>People</Eyebrow>
            <View style={{ gap: 6, marginTop: 8 }}>
              {users.map(u => <UserRow key={u._id} user={u} token={token!} myId={spotifyId!} />)}
            </View>
          </>
        )}

        {/* Songs */}
        {!loading && !isPeople && tracks.length > 0 && (scope === 0 || scope === 1) && (
          <>
            <Eyebrow>Songs</Eyebrow>
            <View style={{ gap: 6, marginTop: 8, marginBottom: 20 }}>
              {tracks.map(t => {
                const reviewed = reviewedTrackIds.has(t.id);
                return (
                  <TouchableOpacity key={t.id} activeOpacity={0.85} style={s.row} onPress={() => selectTrack(t)}>
                    {t.album?.images?.[2]?.url
                      ? <Image source={{ uri: t.album.images[2].url }} style={s.thumb} />
                      : <View style={[s.thumb, { backgroundColor: C.glass }]} />}
                    <View style={{ flex: 1 }}>
                      <Text style={s.rowTitle} numberOfLines={1}>{t.name}</Text>
                      <Text style={s.rowSub} numberOfLines={1}>{t.artists.map(a => a.name).join(', ')}</Text>
                    </View>
                    {reviewed && <ReviewedBadge />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* Albums */}
        {!loading && !isPeople && albums.length > 0 && (scope === 0 || scope === 2) && (
          <>
            <Eyebrow>Albums</Eyebrow>
            <View style={{ gap: 6, marginTop: 8, marginBottom: 20 }}>
              {albums.map(a => {
                const reviewed = reviewedAlbumIds.has(a.id);
                return (
                  <TouchableOpacity key={a.id} activeOpacity={0.85} style={s.row} onPress={() => selectAlbum(a)}>
                    {a.images?.[2]?.url
                      ? <Image source={{ uri: a.images[2].url }} style={s.thumb} />
                      : <View style={[s.thumb, { backgroundColor: C.glass }]} />}
                    <View style={{ flex: 1 }}>
                      <Text style={s.rowTitle} numberOfLines={1}>{a.name}</Text>
                      <Text style={s.rowSub} numberOfLines={1}>{a.artists?.map(ar => ar.name).join(', ')}</Text>
                    </View>
                    {reviewed && <ReviewedBadge />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* Artists */}
        {!loading && !isPeople && artists.length > 0 && (scope === 0 || scope === 3) && (
          <>
            <Eyebrow>Artists</Eyebrow>
            <View style={{ gap: 6, marginTop: 8, marginBottom: 20 }}>
              {artists.map(a => {
                const reviewed = reviewedArtistIds.has(a.id);
                return (
                  <TouchableOpacity
                    key={a.id}
                    activeOpacity={0.85}
                    style={s.row}
                    onPress={() => router.push(`/artist/${a.id}` as any)}
                  >
                    {a.images?.[2]?.url
                      ? <Image source={{ uri: a.images[2].url }} style={[s.thumb, { borderRadius: 20 }]} />
                      : <View style={[s.thumb, { borderRadius: 20, backgroundColor: C.glass }]} />}
                    <View style={{ flex: 1 }}>
                      <Text style={s.rowTitle} numberOfLines={1}>{a.name}</Text>
                      {a.genres?.[0] && <Text style={s.rowSub} numberOfLines={1}>{a.genres[0]}</Text>}
                    </View>
                    {reviewed && <ReviewedBadge />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },

  header: {
    backgroundColor: 'rgba(11,8,22,0.45)',
    borderBottomWidth: 1, borderBottomColor: C.stroke,
    paddingBottom: 12, paddingHorizontal: 16,
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: R.r3,
    backgroundColor: C.glass, borderWidth: 1, borderColor: C.strokeBright,
  },
  input:      { flex: 1, fontSize: 14, color: C.fg, height: 20 },
  scopeChip:  { paddingVertical: 6, paddingHorizontal: 10, borderRadius: R.pill, backgroundColor: C.glassThin, borderWidth: 1, borderColor: C.stroke },
  scopeActive:{ backgroundColor: 'rgba(177,78,255,0.12)', borderColor: 'rgba(177,78,255,0.4)' },
  scopeTxt:   { fontSize: 11, fontWeight: '600', letterSpacing: 1.0, textTransform: 'uppercase' },
  scroll:     { flex: 1 },
  emptyWrap:  { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 12 },
  emptyTxt:   { fontSize: 13, color: C.fg3, textAlign: 'center' },

  trendingHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 0 },
  trendingFire:   { fontSize: 13 },

  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.stroke },
  recentTxt: { flex: 1, fontSize: 13, color: C.fg2 },

  trendRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: R.r3, backgroundColor: C.glass, borderWidth: 1, borderColor: C.strokeBright },
  trendRankBadge: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(177,78,255,0.18)', borderWidth: 1, borderColor: 'rgba(177,78,255,0.4)', alignItems: 'center', justifyContent: 'center' },
  trendRankFirst: { backgroundColor: 'rgba(177,78,255,0.35)', borderColor: C.violet },
  trendRank:      { fontSize: 12, fontWeight: '700', color: C.violet, textAlign: 'center' },
  trendRankFirstTxt: { fontSize: 13, color: C.violet },
  trendArt:       { width: 48, height: 48, borderRadius: R.r2 },
  trendName:   { fontSize: 14, fontWeight: '600', color: C.fg },
  trendArtist: { fontSize: 12, color: C.fg3, marginTop: 2 },
  trendScore:  { fontSize: 18, fontWeight: '700', letterSpacing: -0.5 },
  trendDenom:  { fontSize: 11, color: C.fg4 },

  row:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: R.r3, backgroundColor: C.glass, borderWidth: 1, borderColor: C.strokeBright },
  thumb:    { width: 44, height: 44, borderRadius: 6 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: C.fg },
  rowSub:   { fontSize: 12, color: C.fg3, marginTop: 2 },

  reviewedBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill, backgroundColor: 'rgba(177,78,255,0.15)', borderWidth: 1, borderColor: 'rgba(177,78,255,0.4)' },
  reviewedTxt:   { fontSize: 10, fontWeight: '600', color: C.violet, letterSpacing: 0.4 },

  userRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: R.r3, backgroundColor: C.glass, borderWidth: 1, borderColor: C.strokeBright },
  userAvatar: { width: 44, height: 44, borderRadius: 22 },

  followBtn:     { paddingHorizontal: 14, paddingVertical: 7, borderRadius: R.pill, backgroundColor: C.violet },
  followingBtn:  { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.violet },
  followTxt:     { fontSize: 12, fontWeight: '600', color: C.ink900 },
  followingTxt:  { color: C.violet },
});
