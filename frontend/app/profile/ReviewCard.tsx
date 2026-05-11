import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Linking } from 'react-native';
import { GCard, Icon } from '../components';
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

export function ProfileReviewCard({ r }: { r: ProfileReview }) {
  return (
    <GCard style={{ padding: 12, gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        {r.albumArt
          ? <Image source={{ uri: r.albumArt }} style={s.art} />
          : <View style={[s.art, { backgroundColor: C.glass }]} />}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.track} numberOfLines={1}>{r.trackName}</Text>
          <Text style={s.artist} numberOfLines={1}>{r.artistName}</Text>
        </View>
        <Text style={[s.score, { color: scoreColor(r.score) }]}>{r.score.toFixed(1)}</Text>
      </View>
      {!!r.text && <Text style={s.reviewText}>{r.text}</Text>}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 }}>
          {r.moods?.map(m => (
            <View key={m} style={s.moodChip}>
              <Text style={s.moodTxt}>{m}</Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
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
              <Text style={{ fontSize: 11, color: C.fg4 }}>{r.likes!.length}</Text>
            </View>
          )}
        </View>
      </View>
    </GCard>
  );
}

export const s = StyleSheet.create({
  art:        { width: 48, height: 48, borderRadius: R.r2 },
  track:      { fontSize: 14, fontWeight: '600', color: C.fg },
  artist:     { fontSize: 11, color: C.fg2 },
  score:      { fontSize: 22, fontWeight: '600', letterSpacing: -0.5 },
  reviewText: { fontSize: 13, color: C.fg2, lineHeight: 19 },
  moodChip:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill, backgroundColor: C.glassThin, borderWidth: 1, borderColor: C.stroke },
  moodTxt:    { fontSize: 10, color: C.fg3 },
  spotifyBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: R.pill, backgroundColor: '#1DB954' },
  spotifyTxt: { fontSize: 10, fontWeight: '700', color: '#000', letterSpacing: 0.4 },
});
