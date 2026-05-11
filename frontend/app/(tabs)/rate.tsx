import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Image, Alert, ActivityIndicator } from 'react-native';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar, Eyebrow, GCard, Mood, Icon, StreamingBadge } from '../components';
import { C, R, scoreColor } from '../theme';
import { useRate } from '../context/rate';
import { useAuth } from '../context/auth';
import { api } from '../lib/api';

const MOOD_LIST: [string, string][] = [
  ['nostalgic', '#B14EFF'], ['hype', '#FF3FA4'],   ['sad', '#00D9FF'],
  ['banger', '#C6FF3D'],    ['grower', '#FFB547'],  ['late night', '#7E22CE'],
  ['driving', '#5BE9FF'],   ['heartbreak', '#FF6FBA'], ['rage', '#FF4D6D'],
  ['chill', '#5BE9FF'],
];

export default function ReviewCreate() {
  const { item, setItem } = useRate();
  const { token } = useAuth();
  const [score, setScore]       = useState(8.0);
  const [text, setText]         = useState('');
  const [moods, setMoods]       = useState(new Set<string>());
  const [share, setShare]       = useState(true);
  const [posting, setPosting]   = useState(false);
  const insets = useSafeAreaInsets();

  async function handlePost() {
    if (!item || !token) return;
    setPosting(true);
    try {
      await api.post('/reviews', token, {
        type:            item.type ?? 'track',
        spotifyTrackId:  item.spotifyTrackId ?? '',
        spotifyAlbumId:  item.spotifyAlbumId ?? '',
        spotifyArtistId: item.spotifyArtistId ?? '',
        trackName:  item.trackName,
        artistName: item.artistName,
        albumArt:   item.albumArt,
        score,
        text,
        moods: [...moods],
        shareToFeed: share,
      });
      setItem(null);
      setText('');
      setMoods(new Set());
      setScore(8.0);
    } catch (err: any) {
      if (err?.message?.startsWith('409')) {
        const label = item?.type === 'album' ? 'album' : item?.type === 'artist' ? 'artist' : 'track';
        Alert.alert('Already reviewed', `You've already rated this ${label}. Delete your existing review to post a new one.`);
      } else {
        Alert.alert('Failed to post', 'Check your connection and try again.');
      }
    } finally {
      setPosting(false);
    }
  }

  const toggleMood = (m: string) => {
    setMoods(prev => {
      const next = new Set(prev);
      if (next.has(m)) { next.delete(m); } else if (next.size < 3) { next.add(m); }
      return next;
    });
  };

  const color = scoreColor(score);

  if (!item) {
    return (
      <View style={s.screen}>
        <View style={s.glow} pointerEvents="none" />
        <TopBar pt={insets.top + 12} title="Write a review" />
        <View style={s.emptyWrap}>
          <Icon name="search" size={32} color={C.fg4} />
          <Text style={s.emptyTitle}>Pick something to rate</Text>
          <Text style={s.emptyTxt}>Search for a song or album in the Search tab, then tap it to rate.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <View style={s.glow} pointerEvents="none" />
      <TopBar
        pt={insets.top + 12}
        title="Write a review"
        leading={
          <TouchableOpacity activeOpacity={0.7} onPress={() => setItem(null)}>
            <Icon name="x" size={22} color={C.fg2} />
          </TouchableOpacity>
        }
        trailing={
          <TouchableOpacity activeOpacity={0.7} onPress={handlePost} disabled={posting}>
            {posting
              ? <ActivityIndicator size="small" color={C.violet} />
              : <Text style={s.postBtn}>Post</Text>}
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Selected item */}
        <GCard style={{ padding: 12, flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 20 }}>
          {item.albumArt
            ? <Image source={{ uri: item.albumArt }} style={s.albumArt} />
            : <View style={[s.albumArt, { backgroundColor: C.glass }]} />}
          <View style={{ flex: 1 }}>
            <Text style={s.songTitle} numberOfLines={1}>{item.trackName}</Text>
            <Text style={s.songArtist} numberOfLines={1}>{item.artistName}</Text>
          </View>
          <StreamingBadge platform="spotify" />
        </GCard>

        {/* Score */}
        <Eyebrow>Your score</Eyebrow>
        <View style={s.scoreBlock}>
          <Text style={[s.scoreNum, { color }]}>
            {score.toFixed(1)}
            <Text style={s.scoreDenom}>/10</Text>
          </Text>
          <Slider
            style={{ width: '100%', height: 40 }}
            minimumValue={0}
            maximumValue={10}
            step={0.1}
            value={score}
            onValueChange={setScore}
            minimumTrackTintColor={color}
            maximumTrackTintColor={C.glass}
            thumbTintColor={C.ink900}
          />
          <View style={s.scaleRow}>
            <Text style={s.scaleTxt}>0 · skip</Text>
            <Text style={s.scaleTxt}>5 · fine</Text>
            <Text style={s.scaleTxt}>10 · classic</Text>
          </View>
        </View>

        {/* Text */}
        <Eyebrow>Your take</Eyebrow>
        <GCard style={{ padding: 12, marginTop: 8, marginBottom: 20 }}>
          <TextInput
            value={text}
            onChangeText={t => setText(t.slice(0, 280))}
            placeholder="Say it in a sentence."
            placeholderTextColor={C.fg3}
            multiline
            style={s.textArea}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
            <Text style={s.charCount}>{text.length}/280</Text>
            <Icon name="mic" size={16} color={C.fg3} />
          </View>
        </GCard>

        {/* Moods */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Eyebrow>Mood · pick up to 3</Eyebrow>
          <Text style={s.moodCount}>{moods.size}/3</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {MOOD_LIST.map(([m, mc]) => (
            <Mood key={m} color={mc} selected={moods.has(m)} onPress={() => toggleMood(m)}>{m}</Mood>
          ))}
        </View>

        {/* Share toggle */}
        <GCard style={{ padding: 12, marginTop: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={s.shareTitle}>Share to feed</Text>
            <Text style={s.shareSub}>Followers will see this in their rotation.</Text>
          </View>
          <TouchableOpacity onPress={() => setShare(v => !v)} activeOpacity={0.8}>
            <View style={[s.toggle, { backgroundColor: share ? C.violet : C.glassThin, borderColor: share ? C.violet : C.stroke }]}>
              <View style={[s.toggleThumb, { right: share ? 2 : undefined, left: share ? undefined : 2 }]} />
            </View>
          </TouchableOpacity>
        </GCard>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  glow:   { position: 'absolute', top: 0, left: 0, right: 0, height: 240, backgroundColor: 'rgba(177,78,255,0.07)' },
  scroll: { flex: 1 },

  emptyWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: C.fg },
  emptyTxt:   { fontSize: 13, color: C.fg3, textAlign: 'center', lineHeight: 20 },

  postBtn:    { fontSize: 13, fontWeight: '600', color: C.violet },
  albumArt:   { width: 60, height: 60, borderRadius: R.r2 },
  songTitle:  { fontSize: 17, fontWeight: '600', color: C.fg, letterSpacing: -0.2 },
  songArtist: { fontSize: 12, color: C.fg2, marginTop: 2 },

  scoreBlock: { alignItems: 'center', gap: 14, paddingVertical: 14, marginBottom: 24 },
  scoreNum:   { fontSize: 84, fontWeight: '600', letterSpacing: -2, lineHeight: 88 },
  scoreDenom: { fontSize: 24, fontWeight: '500', color: C.fg3, letterSpacing: 0 },

  scaleRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  scaleTxt: { fontSize: 10, color: C.fg3, letterSpacing: 0.5 },

  textArea:  { fontSize: 14, color: C.fg, lineHeight: 21, minHeight: 90, textAlignVertical: 'top' },
  charCount: { fontSize: 10, color: C.fg3 },
  moodCount: { fontSize: 10, color: C.fg3 },

  shareTitle: { fontSize: 13, fontWeight: '600', color: C.fg },
  shareSub:   { fontSize: 11, color: C.fg3, marginTop: 2 },

  toggle: {
    width: 44, height: 26, borderRadius: 13, borderWidth: 1, justifyContent: 'center',
    shadowColor: C.violet, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 8,
  },
  toggleThumb: {
    position: 'absolute', width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF', top: 1,
  },
});
