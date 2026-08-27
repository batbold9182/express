import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { GCard, Icon, MoodTag, Score } from '../components';
import { C, R, scoreColor } from '../theme';
import { MOOD_COLOR, TYPE_CFG, subjectPath } from '@tunelog/shared';
import type { ProfileReview } from '../lib/types';

export type { ProfileReview };

export function ProfileReviewCard({ r }: { r: ProfileReview }) {
  const router = useRouter();
  const typeCfg = TYPE_CFG[r.type ?? 'track'];

  function navigateToSubject() {
    const path = subjectPath(r);
    if (path) router.push(path as any);
  }

  return (
    <GCard style={{ padding: 12, gap: 8 }} accentColor={typeCfg.color} glowColor={r.score >= 8.5 ? scoreColor(r.score) : undefined}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <TouchableOpacity activeOpacity={0.7} onPress={navigateToSubject}>
          {r.albumArt
            ? <Image source={{ uri: r.albumArt }} style={s.art} />
            : <View style={[s.art, { backgroundColor: C.glass }]} />}
        </TouchableOpacity>
        <View style={{ flex: 1, gap: 2 }}>
          <TouchableOpacity activeOpacity={0.7} onPress={navigateToSubject} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[s.track, { flex: 1 }]} numberOfLines={1}>{r.trackName}</Text>
            <View style={[s.typePill, { backgroundColor: typeCfg.color + '30' }]}>
              <Text style={[s.typeTxt, { color: typeCfg.color }]}>{typeCfg.label}</Text>
            </View>
          </TouchableOpacity>
          {r.spotifyArtistId
            ? <TouchableOpacity onPress={() => router.push(`/artist/${r.spotifyArtistId}` as any)} activeOpacity={0.7}>
                <Text style={[s.artist, { color: C.violet }]} numberOfLines={1}>{r.artistName} ›</Text>
              </TouchableOpacity>
            : <Text style={s.artist} numberOfLines={1}>{r.artistName}</Text>}
        </View>
        <TouchableOpacity activeOpacity={0.7} onPress={navigateToSubject}>
          <View style={[s.scorePill, { backgroundColor: scoreColor(r.score) + '1A' }]}>
            <Score value={r.score} size="md" glow={false} />
          </View>
        </TouchableOpacity>
      </View>

      {!!r.text && <Text style={s.reviewText}>{r.text}</Text>}

      {(r.moods?.length ?? 0) > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {r.moods!.map(m => <MoodTag key={m} label={m} color={MOOD_COLOR[m]} />)}
        </View>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
        {(r.spotifyTrackId || r.spotifyAlbumId || r.spotifyArtistId) && (
          <TouchableOpacity
            onPress={() => {
              const url = r.type === 'artist' && r.spotifyArtistId
                ? `https://open.spotify.com/artist/${r.spotifyArtistId}`
                : r.type === 'album' && r.spotifyAlbumId
                  ? `https://open.spotify.com/album/${r.spotifyAlbumId}`
                  : `https://open.spotify.com/track/${r.spotifyTrackId}`;
              Linking.openURL(url);
            }}
            activeOpacity={0.7}
            style={s.spotifyBtn}
          >
            <Text style={s.spotifyTxt}>▶ Spotify</Text>
          </TouchableOpacity>
        )}
        {(r.likes?.length ?? 0) > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Icon name="heart" size={13} color={C.fg4} />
            <Text style={{ fontSize: 12, color: C.fg4 }}>{r.likes!.length}</Text>
          </View>
        )}
      </View>
    </GCard>
  );
}

export const s = StyleSheet.create({
  art:        { width: 56, height: 56, borderRadius: R.r2, borderWidth: 1, borderColor: C.stroke },
  track:      { fontSize: 14, fontWeight: '600', color: C.fg },
  artist:     { fontSize: 12, color: C.fg2 },
  scorePill:  { paddingHorizontal: 8, paddingVertical: 4, borderRadius: R.pill },
  reviewText: { fontSize: 13, color: C.fg2, lineHeight: 19 },
  spotifyBtn: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: R.pill, borderWidth: 1, borderColor: '#1DB954' },
  spotifyTxt: { fontSize: 10, fontWeight: '700', color: '#1DB954', letterSpacing: 0.4 },
  typePill:   { paddingHorizontal: 7, paddingVertical: 3, borderRadius: R.pill },
  typeTxt:    { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
});
