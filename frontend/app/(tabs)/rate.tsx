import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Image, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar ,Eyebrow, GCard , Mood, Icon , StreamingBadge}from '../components/';
import { C, R, scoreColor } from '../theme';
import { useRate } from '../context/rate';
import { useAuth } from '../context/auth';
import { api } from '../lib/api';
import { MOOD_LIST } from '../lib/constants';

export default function ReviewCreate() {
  const router = useRouter();
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
        <TopBar pt={insets.top + 12} title="Write a review" />
        <View style={s.emptyWrap}>
          <Icon name="search" size={32} color={C.fg3} />
          <Text style={s.emptyTitle}>Pick something to rate</Text>
          <Text style={s.emptyTxt}>Search for a song or album in the Search tab, then tap it to rate.</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/search' as any)} activeOpacity={0.8} style={s.emptyBtn}>
            <Text style={s.emptyBtnTxt}>Search music</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <TopBar
        pt={insets.top + 12}
        title="Write a review"
        leading={
          <TouchableOpacity activeOpacity={0.7} onPress={() => setItem(null)}>
            <Icon name="x" size={22} color={C.fg2} />
          </TouchableOpacity>
        }
        trailing={
          <TouchableOpacity activeOpacity={0.8} onPress={handlePost} disabled={posting} style={{ borderRadius: R.pill, overflow: 'hidden' }}>
            <LinearGradient colors={['#B14EFF', '#FF3FA4']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.postBtn}>
              {posting
                ? <ActivityIndicator size="small" color={C.ink900} />
                : <Text style={s.postBtnTxt}>Post</Text>}
            </LinearGradient>
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
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
          <View style={[s.scoreGlow, { shadowColor: color }]}>
            <Text style={[s.scoreNum, { color, textShadowColor: color, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 24 }]}>
              {score.toFixed(1)}
              <Text style={s.scoreDenom}>/10</Text>
            </Text>
          </View>
          <Slider
            style={{ width: '100%', height: 40 }}
            minimumValue={0}
            maximumValue={10}
            step={0.1}
            value={score}
            onValueChange={setScore}
            minimumTrackTintColor={color}
            maximumTrackTintColor={C.glass}
            thumbTintColor={color}
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
            <Text style={[s.charCount, text.length > 260 ? { color: C.red } : text.length > 200 ? { color: C.amber } : null]}>
            {text.length}/280
          </Text>
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

  scroll: { flex: 1 },

  emptyWrap:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyTitle:  { fontSize: 16, fontWeight: '600', color: C.fg },
  emptyTxt:    { fontSize: 13, color: C.fg3, textAlign: 'center', lineHeight: 20 },
  emptyBtn:    { backgroundColor: C.glass, borderWidth: 1, borderColor: C.stroke, paddingHorizontal: 20, paddingVertical: 9, borderRadius: R.pill },
  emptyBtnTxt: { fontSize: 13, fontWeight: '600', color: C.fg2 },

  postBtn:    { paddingHorizontal: 16, paddingVertical: 7, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center', minWidth: 58 },
  postBtnTxt: { fontSize: 13, fontWeight: '700', color: C.ink900 },
  albumArt:   { width: 60, height: 60, borderRadius: R.r2 },
  songTitle:  { fontSize: 17, fontWeight: '600', color: C.fg, letterSpacing: -0.2 },
  songArtist: { fontSize: 12, color: C.fg2, marginTop: 2 },

  scoreBlock: { alignItems: 'center', gap: 10, paddingVertical: 14, marginBottom: 24 },
  scoreGlow:  { shadowOpacity: 0.45, shadowRadius: 32, shadowOffset: { width: 0, height: 0 } },
  scoreNum:   { fontSize: 84, fontWeight: '700', letterSpacing: -2, lineHeight: 88 },
  scoreDenom: { fontSize: 24, fontWeight: '500', color: C.fg3, letterSpacing: 0 },

  scaleRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  scaleTxt: { fontSize: 11, color: C.fg3, letterSpacing: 0.5 },

  textArea:  { fontSize: 14, color: C.fg, lineHeight: 21, minHeight: 90, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: C.fg3 },
  moodCount: { fontSize: 11, color: C.fg3 },

  shareTitle: { fontSize: 13, fontWeight: '600', color: C.fg },
  shareSub:   { fontSize: 12, color: C.fg3, marginTop: 2 },

  toggle: {
    width: 44, height: 26, borderRadius: 13, borderWidth: 1, justifyContent: 'center',
    shadowColor: C.violet, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 8,
  },
  toggleThumb: {
    position: 'absolute', width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF', top: 1,
  },
});
