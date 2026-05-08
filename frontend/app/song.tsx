import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Score, Cover, Avatar, Eyebrow, GCard, StreamingBadge, BtnPrimary, Icon, MoodTag } from './components';
import { C, R } from './theme';

const REVIEWS = [
  { user: 'sora',  score: 9.5, text: "Headphones only. Don't do this on a speaker.",                      time: '8h',  likes: 56,  moods: ['late night'] },
  { user: 'jules', score: 8.8, text: 'Builds a room around you and locks the door. Then opens a window.', time: '1d',  likes: 124, moods: ['nostalgic'] },
  { user: 'kai',   score: 9.2, text: 'Angel into Risingson is the best two-track segue in trip-hop.',      time: '2d',  likes: 41,  moods: ['banger'] },
];

const DIST = [2, 3, 5, 8, 12, 18, 28, 42, 56, 38];

export default function SongDetail() {
  const params = useLocalSearchParams<{ cover?: string; title?: string; artist?: string; score?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const cover  = params.cover  ?? 'violet-static';
  const title  = params.title  ?? 'Mezzanine';
  const artist = params.artist ?? 'Massive Attack';
  const score  = parseFloat(params.score ?? '9.1');

  return (
    <View style={s.screen}>
      {/* Blurred hero */}
      <View style={[s.hero, { height: 380 }]}>
        <Cover name={cover} size={600} radius={0} />
        <View style={s.heroOverlay} />
      </View>

      {/* Back / more buttons */}
      <View style={[s.navRow, { top: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8} style={s.circleBtn}>
          <Icon name="arrow-left" size={16} color={C.fg} />
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.8} style={s.circleBtn}>
          <Icon name="more" size={16} color={C.fg} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={{ paddingTop: 60, paddingHorizontal: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero cover + metadata */}
        <View style={s.heroContent}>
          <View>
            <Cover name={cover} size={200} radius={28} />
            <View style={s.coverGlow} pointerEvents="none" />
          </View>
          <Text style={s.songTitle}>{title}</Text>
          <Text style={s.songArtist}>{artist}</Text>
          <Text style={s.songMeta}>1998 · 01:02:39</Text>

          {/* Big score */}
          <View style={{ alignItems: 'center', gap: 4, marginTop: 8 }}>
            <Score value={score} size="xl" />
            <Text style={s.ratingsMeta}>
              1,247 ratings · <Text style={{ color: C.lime }}>↑ 0.2 this week</Text>
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            <BtnPrimary>Rate it</BtnPrimary>
            <TouchableOpacity activeOpacity={0.85} style={s.spotBtn}>
              <View style={s.spotDot} />
              <Text style={s.spotTxt}>Play on Spotify</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
            <StreamingBadge platform="spotify" />
            <StreamingBadge platform="apple" />
          </View>
        </View>

        {/* Score distribution */}
        <GCard style={{ padding: 14, marginBottom: 16 }}>
          <Eyebrow>Distribution</Eyebrow>
          <View style={s.distBar}>
            {DIST.map((v, i) => (
              <View
                key={i}
                style={[
                  s.distCol,
                  {
                    height: `${v * 1.4}%` as any,
                    backgroundColor:
                      i >= 7 ? C.lime : i >= 5 ? C.violet : i >= 3 ? C.amber : C.red,
                  },
                ]}
              />
            ))}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
            {['1', '5', '10'].map(l => <Text key={l} style={s.distLbl}>{l}</Text>)}
          </View>
        </GCard>

        {/* Reviews */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Eyebrow>Reviews</Eyebrow>
          <Text style={s.seeAll}>See all →</Text>
        </View>

        <View style={{ gap: 10 }}>
          {REVIEWS.map((r, i) => (
            <GCard key={i} style={{ padding: 12, flexDirection: 'row', gap: 10 }}>
              <Avatar name={r.user} size={32} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={s.revUser}>{r.user}</Text>
                  <Score value={r.score} size="sm" />
                  <Text style={[s.revTime, { marginLeft: 'auto' }]}>{r.time} ago</Text>
                </View>
                <Text style={s.revText}>{r.text}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {r.moods.map(m => <MoodTag key={m} label={m} />)}
                </View>
              </View>
            </GCard>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },

  hero: {
    position: 'absolute', top: 0, left: 0, right: 0,
    overflow: 'hidden', opacity: 0.35,
  },
  heroOverlay: {
    position: 'absolute', inset: 0, top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(11,8,22,0.7)',
  },

  navRow: {
    position: 'absolute', left: 16, right: 16,
    flexDirection: 'row', justifyContent: 'space-between', zIndex: 10,
  },
  circleBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: C.stroke,
    alignItems: 'center', justifyContent: 'center',
  },

  scroll: { flex: 1 },

  heroContent: { alignItems: 'center', gap: 4, paddingBottom: 20 },
  coverGlow: {
    position: 'absolute', top: -4, left: -4, right: -4, bottom: -4,
    borderRadius: 32,
    shadowColor: C.violet, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 40,
  },
  songTitle:  { fontSize: 28, fontWeight: '600', color: C.fg, letterSpacing: -0.5, textAlign: 'center', marginTop: 16 },
  songArtist: { fontSize: 15, color: C.fg2 },
  songMeta:   { fontSize: 10, color: C.fg3, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 2 },
  ratingsMeta:{ fontSize: 12, color: C.fg3, textAlign: 'center' },

  spotBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.spotify, paddingVertical: 10, paddingHorizontal: 16, borderRadius: R.pill,
  },
  spotDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: C.ink900 },
  spotTxt: { color: C.ink900, fontSize: 13, fontWeight: '600' },

  distBar:  { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 44, marginTop: 10 },
  distCol:  { flex: 1, borderRadius: 2, opacity: 0.85, minHeight: 2 },
  distLbl:  { fontSize: 9, color: C.fg3 },

  seeAll: { fontSize: 10, color: C.cyan, letterSpacing: 0.8, textTransform: 'uppercase' },

  revUser: { fontSize: 13, fontWeight: '600', color: C.fg },
  revTime: { fontSize: 10, color: C.fg3 },
  revText: { fontSize: 13, color: C.fg, lineHeight: 19, marginTop: 4 },
});
