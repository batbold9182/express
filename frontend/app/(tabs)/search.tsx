import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Eyebrow, Icon } from '../components';
import { C, R } from '../theme';
import { useAuth } from '../context/auth';
import { api } from '../lib/api';

type Track  = { id: string; name: string; artists: { name: string }[]; album: { images: { url: string }[] } };
type Album  = { id: string; name: string; artists: { name: string }[]; images: { url: string }[] };
type Artist = { id: string; name: string; images: { url: string }[]; genres: string[] };

const SCOPES = ['All', 'Songs', 'Albums', 'Artists'];
const TYPE_MAP = ['track,album,artist', 'track', 'album', 'artist'];

export default function Search() {
  const [q, setQ]               = useState('');
  const [scope, setScope]       = useState(0);
  const [loading, setLoading]   = useState(false);
  const [tracks, setTracks]     = useState<Track[]>([]);
  const [albums, setAlbums]     = useState<Album[]>([]);
  const [artists, setArtists]   = useState<Artist[]>([]);
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!q.trim() || !token) { setTracks([]); setAlbums([]); setArtists([]); return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.get(`/search?q=${encodeURIComponent(q)}&type=${TYPE_MAP[scope]}`, token);
        setTracks(data.tracks?.items ?? []);
        setAlbums(data.albums?.items ?? []);
        setArtists(data.artists?.items ?? []);
      } finally {
        setLoading(false);
      }
    }, 400);
  }, [q, scope, token]);

  const hasResults = tracks.length > 0 || albums.length > 0 || artists.length > 0;

  return (
    <View style={s.screen}>
      <View style={s.glow} pointerEvents="none" />

      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View style={s.searchBox}>
          <Icon name="search" size={18} color={C.fg3} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search songs, albums, artists"
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
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {loading && <ActivityIndicator color={C.violet} style={{ marginTop: 40 }} />}

        {!loading && !q && (
          <View style={s.emptyWrap}>
            <Icon name="search" size={32} color={C.fg4} />
            <Text style={s.emptyTxt}>Search Spotify to find something to rate.</Text>
          </View>
        )}

        {!loading && !!q && !hasResults && (
          <View style={s.emptyWrap}>
            <Text style={s.emptyTxt}>No results for &quot;{q}&quot;</Text>
          </View>
        )}

        {!loading && tracks.length > 0 && (scope === 0 || scope === 1) && (
          <>
            <Eyebrow>Songs</Eyebrow>
            <View style={{ gap: 6, marginTop: 8, marginBottom: 20 }}>
              {tracks.map(t => (
                <TouchableOpacity key={t.id} activeOpacity={0.85} style={s.row}>
                  {t.album.images[2]?.url
                    ? <Image source={{ uri: t.album.images[2].url }} style={s.thumb} />
                    : <View style={[s.thumb, { backgroundColor: C.glass }]} />}
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowTitle} numberOfLines={1}>{t.name}</Text>
                    <Text style={s.rowSub} numberOfLines={1}>{t.artists.map(a => a.name).join(', ')}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {!loading && albums.length > 0 && (scope === 0 || scope === 2) && (
          <>
            <Eyebrow>Albums</Eyebrow>
            <View style={{ gap: 6, marginTop: 8, marginBottom: 20 }}>
              {albums.map(a => (
                <TouchableOpacity key={a.id} activeOpacity={0.85} style={s.row}>
                  {a.images[2]?.url
                    ? <Image source={{ uri: a.images[2].url }} style={s.thumb} />
                    : <View style={[s.thumb, { backgroundColor: C.glass }]} />}
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowTitle} numberOfLines={1}>{a.name}</Text>
                    <Text style={s.rowSub} numberOfLines={1}>{a.artists.map(ar => ar.name).join(', ')}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {!loading && artists.length > 0 && (scope === 0 || scope === 3) && (
          <>
            <Eyebrow>Artists</Eyebrow>
            <View style={{ gap: 6, marginTop: 8, marginBottom: 20 }}>
              {artists.map(a => (
                <TouchableOpacity key={a.id} activeOpacity={0.85} style={s.row}>
                  {a.images[2]?.url
                    ? <Image source={{ uri: a.images[2].url }} style={[s.thumb, { borderRadius: 20 }]} />
                    : <View style={[s.thumb, { borderRadius: 20, backgroundColor: C.glass }]} />}
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowTitle} numberOfLines={1}>{a.name}</Text>
                    {a.genres[0] && <Text style={s.rowSub} numberOfLines={1}>{a.genres[0]}</Text>}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  glow:   { position: 'absolute', top: 0, left: 0, right: 0, height: 240, backgroundColor: 'rgba(177,78,255,0.07)' },
  header: {
    backgroundColor: 'rgba(11,8,22,0.80)',
    borderBottomWidth: 1, borderBottomColor: C.stroke,
    paddingBottom: 12, paddingHorizontal: 16,
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: R.r3,
    backgroundColor: C.glass, borderWidth: 1, borderColor: C.stroke,
  },
  input: { flex: 1, fontSize: 14, color: C.fg, height: 20 },
  scopeChip: {
    paddingVertical: 6, paddingHorizontal: 10, borderRadius: R.pill,
    backgroundColor: C.glassThin, borderWidth: 1, borderColor: C.stroke,
  },
  scopeActive: { backgroundColor: 'rgba(177,78,255,0.12)', borderColor: 'rgba(177,78,255,0.4)' },
  scopeTxt: { fontSize: 10, fontWeight: '600', letterSpacing: 1.0, textTransform: 'uppercase' },
  scroll: { flex: 1 },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 12 },
  emptyTxt:  { fontSize: 13, color: C.fg3, textAlign: 'center' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10,
    borderRadius: R.r3, backgroundColor: C.glass, borderWidth: 1, borderColor: C.stroke,
  },
  thumb:    { width: 44, height: 44, borderRadius: 6 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: C.fg },
  rowSub:   { fontSize: 11, color: C.fg3, marginTop: 2 },
});
