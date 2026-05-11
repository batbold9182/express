import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TextInput,
  TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GCard, Icon } from '../components';
import { C, R } from '../theme';
import { useAuth } from '../context/auth';
import { api } from '../lib/api';

type ListItem = {
  rank: number;
  type: 'track' | 'album';
  spotifyTrackId?: string;
  spotifyAlbumId?: string;
  trackName: string;
  artistName: string;
  albumArt?: string;
};

type SearchResult = {
  id: string;
  name: string;
  artists: { name: string }[];
  album?: { images: { url: string }[]; id: string };
  images?: { url: string }[];
  resultType: 'track' | 'album';
};

export default function ListCreate() {
  const { id: editId } = useLocalSearchParams<{ id?: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [title, setTitle]     = useState('');
  const [items, setItems]     = useState<ListItem[]>([]);
  const [q, setQ]             = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving]   = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isEdit = !!editId;

  // Load existing list when editing
  useEffect(() => {
    if (!editId || !token) return;
    api.get(`/lists/${editId}`, token).then((data: any) => {
      setTitle(data.title);
      setItems(data.items.sort((a: ListItem, b: ListItem) => a.rank - b.rank));
    }).catch(() => {});
  }, [editId, token]);

  // Debounced search
  useEffect(() => {
    if (!q.trim() || !token) { setResults([]); return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await api.get(`/search?q=${encodeURIComponent(q)}&type=track,album`, token);
        const tracks: SearchResult[] = (data.tracks?.items ?? []).map((t: any) => ({
          id: t.id, name: t.name, artists: t.artists, album: t.album, resultType: 'track' as const,
        }));
        const albums: SearchResult[] = (data.albums?.items ?? []).map((a: any) => ({
          id: a.id, name: a.name, artists: a.artists, images: a.images, resultType: 'album' as const,
        }));
        setResults([...tracks.slice(0, 5), ...albums.slice(0, 5)]);
      } catch {} finally { setSearching(false); }
    }, 400);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q, token]);

  function addItem(r: SearchResult) {
    const alreadyIn = items.some(it =>
      r.resultType === 'track' ? it.spotifyTrackId === r.id : it.spotifyAlbumId === r.id
    );
    if (alreadyIn) { Alert.alert('Already added', 'This item is already in your list.'); return; }
    if (items.length >= 50) { Alert.alert('Limit reached', 'A list can have at most 50 items.'); return; }

    const art = r.resultType === 'track'
      ? r.album?.images?.[0]?.url
      : r.images?.[0]?.url;

    const newItem: ListItem = {
      rank: items.length + 1,
      type: r.resultType,
      spotifyTrackId: r.resultType === 'track' ? r.id : undefined,
      spotifyAlbumId: r.resultType === 'album' ? r.id : (r.album?.id),
      trackName: r.name,
      artistName: r.artists.map(a => a.name).join(', '),
      albumArt: art,
    };
    setItems(prev => [...prev, newItem]);
    setQ('');
    setResults([]);
  }

  function removeItem(index: number) {
    setItems(prev => {
      const next = prev.filter((_, i) => i !== index);
      return next.map((it, i) => ({ ...it, rank: i + 1 }));
    });
  }

  function moveUp(index: number) {
    if (index === 0) return;
    setItems(prev => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next.map((it, i) => ({ ...it, rank: i + 1 }));
    });
  }

  function moveDown(index: number) {
    setItems(prev => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next.map((it, i) => ({ ...it, rank: i + 1 }));
    });
  }

  async function handleSave() {
    if (!title.trim()) { Alert.alert('Title required', 'Give your list a name.'); return; }
    setSaving(true);
    try {
      const payload = { title: title.trim(), items };
      if (isEdit) {
        await api.put(`/lists/${editId}`, token!, payload);
      } else {
        const created = await api.post('/lists', token!, payload);
        router.replace(`/list/${created._id}` as any);
        return;
      }
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to save list.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.glow} pointerEvents="none" />

      <View style={[s.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={s.iconBtn}>
          <Icon name="arrow-left" size={22} color={C.fg} />
        </TouchableOpacity>
        <Text style={s.topBarTitle}>{isEdit ? 'Edit list' : 'New list'}</Text>
        <TouchableOpacity onPress={handleSave} activeOpacity={0.7} disabled={saving} style={s.iconBtn}>
          {saving
            ? <ActivityIndicator size="small" color={C.violet} />
            : <Text style={s.saveBtn}>Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title */}
        <GCard style={{ padding: 12, marginBottom: 20 }}>
          <TextInput
            value={title}
            onChangeText={t => setTitle(t.slice(0, 80))}
            placeholder="List title (e.g. Top 10 of 2025)"
            placeholderTextColor={C.fg3}
            style={s.titleInput}
            maxLength={80}
          />
        </GCard>

        {/* Search to add */}
        <GCard style={{ padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon name="search" size={16} color={C.fg3} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search tracks or albums to add"
            placeholderTextColor={C.fg3}
            style={[s.titleInput, { flex: 1 }]}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {!!q && (
            <TouchableOpacity onPress={() => { setQ(''); setResults([]); }} activeOpacity={0.7}>
              <Icon name="x" size={14} color={C.fg3} />
            </TouchableOpacity>
          )}
        </GCard>

        {/* Search results */}
        {searching && <ActivityIndicator color={C.violet} style={{ marginVertical: 8 }} />}
        {results.length > 0 && (
          <GCard style={{ padding: 4, marginBottom: 20 }}>
            {results.map((r, i) => {
              const art = r.resultType === 'track' ? r.album?.images?.[2]?.url : r.images?.[2]?.url;
              return (
                <TouchableOpacity
                  key={`${r.resultType}-${r.id}`}
                  onPress={() => addItem(r)}
                  activeOpacity={0.75}
                  style={[s.resultRow, i > 0 && s.resultBorder]}
                >
                  {art
                    ? <Image source={{ uri: art }} style={s.resultArt} />
                    : <View style={[s.resultArt, { backgroundColor: C.glass }]} />}
                  <View style={{ flex: 1 }}>
                    <Text style={s.resultName} numberOfLines={1}>{r.name}</Text>
                    <Text style={s.resultSub} numberOfLines={1}>{r.artists.map(a => a.name).join(', ')}</Text>
                  </View>
                  <View style={s.typeBadge}>
                    <Text style={s.typeTxt}>{r.resultType === 'album' ? 'Album' : 'Track'}</Text>
                  </View>
                  <Icon name="plus" size={18} color={C.violet} />
                </TouchableOpacity>
              );
            })}
          </GCard>
        )}

        {/* Current items */}
        {items.length > 0 && (
          <>
            <Text style={s.sectionLabel}>Your list · {items.length} {items.length === 1 ? 'item' : 'items'}</Text>
            <View style={{ gap: 6 }}>
              {items.map((item, i) => (
                <GCard key={`${i}-${item.trackName}`} style={{ padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={s.rank}>#{item.rank}</Text>
                  {item.albumArt
                    ? <Image source={{ uri: item.albumArt }} style={s.art} />
                    : <View style={[s.art, { backgroundColor: C.glass }]} />}
                  <View style={{ flex: 1 }}>
                    <Text style={s.trackName} numberOfLines={1}>{item.trackName}</Text>
                    <Text style={s.artistName} numberOfLines={1}>{item.artistName}</Text>
                  </View>
                  <View style={s.controls}>
                    <TouchableOpacity onPress={() => moveUp(i)} activeOpacity={0.6} disabled={i === 0}>
                      <Icon name="chevron-up" size={18} color={i === 0 ? C.fg4 : C.fg2} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => moveDown(i)} activeOpacity={0.6} disabled={i === items.length - 1}>
                      <Icon name="chevron-down" size={18} color={i === items.length - 1 ? C.fg4 : C.fg2} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removeItem(i)} activeOpacity={0.6}>
                      <Icon name="x" size={16} color={C.red} />
                    </TouchableOpacity>
                  </View>
                </GCard>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  glow:   { position: 'absolute', top: 0, left: 0, right: 0, height: 240, backgroundColor: 'rgba(177,78,255,0.07)' },
  scroll: { flex: 1 },

  topBar:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  topBarTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: C.fg, textAlign: 'center' },
  iconBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  saveBtn:     { fontSize: 14, fontWeight: '600', color: C.violet },

  titleInput: { fontSize: 15, color: C.fg },

  resultRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
  resultBorder: { borderTopWidth: 1, borderTopColor: C.stroke },
  resultArt:    { width: 40, height: 40, borderRadius: R.r2 },
  resultName:   { fontSize: 13, fontWeight: '600', color: C.fg },
  resultSub:    { fontSize: 11, color: C.fg3, marginTop: 1 },

  typeBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: R.pill, backgroundColor: C.glassThin, borderWidth: 1, borderColor: C.stroke },
  typeTxt:   { fontSize: 9, fontWeight: '600', color: C.fg3, letterSpacing: 0.6, textTransform: 'uppercase' },

  sectionLabel: { fontSize: 10, fontWeight: '600', color: C.fg3, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 },

  rank:       { width: 28, fontSize: 16, fontWeight: '700', color: C.fg3, textAlign: 'center' },
  art:        { width: 40, height: 40, borderRadius: R.r2 },
  trackName:  { fontSize: 13, fontWeight: '600', color: C.fg },
  artistName: { fontSize: 11, color: C.fg3, marginTop: 1 },
  controls:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
