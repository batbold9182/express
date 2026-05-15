import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { GCard, Icon, MoodTag } from '../components';
import { C, R, scoreColor } from '../theme';

export type ProfileReview = {
  _id: string;
  type?: 'track' | 'album' | 'artist';
  spotifyTrackId?: string;
  spotifyAlbumId?: string;
  spotifyArtistId?: string;
  trackName: string;
  artistName: string;
  albumArt?: string;
  score: number;
  text?: string;
  moods?: string[];
  likes?: string[];
  createdAt: string;
};

const TYPE_LABEL: Record<string, { label: string; color: string }> = {
  album:  { label: 'Album',  color: C.cyan },
  artist: { label: 'Artist', color: C.pink },
  track:  { label: 'Track',  color: C.fg3 },
};

export function ProfileReviewCard({ r }: { r: ProfileReview }) {
  const router = useRouter();
  const typeCfg = TYPE_LABEL[r.type ?? 'track'];

  function navigateToSubject() {
    if (r.type === 'artist' && r.spotifyArtistId) router.push(`/artist/${r.spotifyArtistId}` as any);
    else if (r.type === 'album' && r.spotifyAlbumId) router.push(`/album/${r.spotifyAlbumId}` as any);
    else if (r.spotifyTrackId) router.push(`/song/${r.spotifyTrackId}` as any);
    else if (r.spotifyAlbumId) router.push(`/album/${r.spotifyAlbumId}` as any);
  }

  return (
    <GCard style={{ padding: 12, gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <TouchableOpacity activeOpacity={0.7} onPress={navigateToSubject}>
          {r.albumArt
            ? <Image source={{ uri: r.albumArt }} style={s.art} />
            : <View style={[s.art, { backgroundColor: C.glass }]} />}
        </TouchableOpacity>
        <View style={{ flex: 1, gap: 2 }}>
          <TouchableOpacity activeOpacity={0.7} onPress={navigateToSubject} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[s.track, { flex: 1 }]} numberOfLines={1}>{r.trackName}</Text>
            <View style={[s.typePill, { borderColor: typeCfg.color + '55', backgroundColor: typeCfg.color + '18' }]}>
              <Text style={[s.typeTxt, { color: typeCfg.color }]}>{typeCfg.label}</Text>
            </View>
          </TouchableOpacity>
          {r.spotifyArtistId
            ? <TouchableOpacity onPress={() => router.push(`/artist/${r.spotifyArtistId}` as any)} activeOpacity={0.7}>
                <Text style={[s.artist, { color: C.violet }]} numberOfLines={1}>{r.artistName}</Text>
              </TouchableOpacity>
            : <Text style={s.artist} numberOfLines={1}>{r.artistName}</Text>}
        </View>
        <TouchableOpacity activeOpacity={0.7} onPress={navigateToSubject}>
          <Text style={[s.score, { color: scoreColor(r.score) }]}>{r.score.toFixed(1)}</Text>
        </TouchableOpacity>
      </View>
      {!!r.text && <Text style={s.reviewText}>{r.text}</Text>}

      {(r.moods?.length ?? 0) > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {r.moods!.map(m => <MoodTag key={m} label={m} />)}
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
  art:        { width: 56, height: 56, borderRadius: R.r2 },
  track:      { fontSize: 14, fontWeight: '600', color: C.fg },
  artist:     { fontSize: 12, color: C.fg2 },
  score:      { fontSize: 22, fontWeight: '600', letterSpacing: -0.5 },
  reviewText: { fontSize: 13, color: C.fg2, lineHeight: 19 },
  spotifyBtn: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: R.pill, borderWidth: 1, borderColor: '#1DB954' },
  spotifyTxt: { fontSize: 10, fontWeight: '700', color: '#1DB954', letterSpacing: 0.4 },
  typePill:   { paddingHorizontal: 6, paddingVertical: 2, borderRadius: R.pill, borderWidth: 1 },
  typeTxt:    { fontSize: 9, fontWeight: '600', letterSpacing: 0.4 },
});
