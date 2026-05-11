import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GCard, Eyebrow, Icon } from '../components';
import { C, R, scoreColor } from '../theme';
import { useAuth } from '../context/auth';
import { useRate } from '../context/rate';
import { api } from '../lib/api';
import { ProfileReviewCard, type ProfileReview } from '../profile/ReviewCard';

type SpotifyArtist = {
  id: string;
  name: string;
  images: { url: string }[];
  genres: string[];
  followers?: { total: number };
};

type SpotifyTrack = {
  id: string;
  name: string;
  duration_ms: number;
  album: { id: string; images: { url: string }[] };
  artists: { name: string }[];
};

type ArtistReview = ProfileReview & { type?: string };

function msToMin(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function formatFollowers(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

export default function ArtistDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const { setItem } = useRate();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [artist, setArtist]     = useState<SpotifyArtist | null>(null);
  const [topTracks, setTopTracks] = useState<SpotifyTrack[]>([]);
  const [reviews, setReviews]   = useState<ArtistReview[]>([]);
  const [avgScore, setAvgScore] = useState<number | null>(null);
  const [loading, setLoading]   = useState(true);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [reviewedTrackIds, setReviewedTrackIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!token || !id) return;
    Promise.all([
      api.get(`/artists/${id}`, token),
      api.get(`/artists/${id}/top-tracks`, token),
      api.get(`/artists/${id}/reviews`, token),
      api.get('/reviews/mine', token),
    ]).then(([art, tracksData, revData, mine]) => {
      setArtist(art);
      setTopTracks(tracksData.tracks ?? []);
      setReviews(revData.reviews ?? []);
      setAvgScore(revData.avgScore ?? null);
      const trackIds = new Set<string>();
      (mine as any[]).forEach(r => {
        if (r.type !== 'album' && r.type !== 'artist' && r.spotifyTrackId) trackIds.add(r.spotifyTrackId);
      });
      setReviewedTrackIds(trackIds);
      setAlreadyReviewed(
        (mine as any[]).some(r => r.type === 'artist' && r.spotifyArtistId === id)
      );
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id, token]);

  function rateArtist() {
    if (!artist) return;
    if (alreadyReviewed) {
      Alert.alert('Already reviewed', "You've already rated this artist. Delete your existing review to post a new one.");
      return;
    }
    setItem({
      type: 'artist',
      spotifyArtistId: artist.id,
      trackName: artist.name,
      artistName: artist.genres?.[0] ?? 'Artist',
      albumArt: artist.images[0]?.url ?? '',
    });
    router.push('/(tabs)/rate');
  }

  function rateTrack(track: SpotifyTrack) {
    if (!artist) return;
    if (reviewedTrackIds.has(track.id)) {
      Alert.alert('Already reviewed', "You've already rated this track. Delete your existing review to post a new one.");
      return;
    }
    setItem({
      type: 'track',
      spotifyTrackId: track.id,
      spotifyAlbumId: track.album.id,
      spotifyArtistId: artist.id,
      trackName: track.name,
      artistName: track.artists.map(a => a.name).join(', '),
      albumArt: track.album.images[0]?.url ?? '',
    });
    router.push('/(tabs)/rate');
  }

  if (loading) {
    return (
      <View style={[s.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={C.violet} size="large" />
      </View>
    );
  }

  if (!artist) {
    return (
      <View style={[s.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: C.fg3 }}>Artist not found.</Text>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <View style={s.glow} pointerEvents="none" />

      <View style={[s.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={s.backBtn}>
          <Icon name="arrow-left" size={22} color={C.fg} />
        </TouchableOpacity>
        <Text style={s.topBarTitle} numberOfLines={1}>{artist.name}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={s.hero}>
          {artist.images[0]?.url
            ? <Image source={{ uri: artist.images[0].url }} style={s.cover} />
            : <View style={[s.cover, { backgroundColor: C.glass }]} />}
          <Text style={s.artistName}>{artist.name}</Text>
          {artist.genres?.[0] && (
            <Text style={s.genre}>{artist.genres.slice(0, 2).join(' · ')}</Text>
          )}
          {(artist.followers?.total ?? 0) > 0 && (
            <Text style={s.followers}>{formatFollowers(artist.followers!.total)} followers</Text>
          )}

          {avgScore !== null && (
            <View style={s.scoreRow}>
              <Text style={[s.avgScore, { color: scoreColor(avgScore) }]}>{avgScore.toFixed(1)}</Text>
              <Text style={s.avgLabel}>avg from {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}</Text>
            </View>
          )}
        </View>

        {/* Rate button */}
        <TouchableOpacity
          onPress={rateArtist}
          activeOpacity={0.85}
          style={[s.rateBtn, alreadyReviewed && s.rateBtnReviewed]}
        >
          <Icon name="star" size={16} color={alreadyReviewed ? C.violet : C.ink900} />
          <Text style={[s.rateTxt, alreadyReviewed && s.rateTxtReviewed]}>
            {alreadyReviewed ? 'Already reviewed' : 'Rate this artist'}
          </Text>
        </TouchableOpacity>

        {/* Top tracks */}
        {topTracks.length > 0 && (
          <>
            <View style={{ marginTop: 24, marginBottom: 8 }}><Eyebrow>Top tracks</Eyebrow></View>
            <GCard style={{ padding: 4 }}>
              {topTracks.map((track, i) => {
                const reviewed = reviewedTrackIds.has(track.id);
                return (
                  <TouchableOpacity
                    key={track.id}
                    activeOpacity={0.75}
                    onPress={() => rateTrack(track)}
                    style={[s.trackRow, i > 0 && s.trackRowBorder]}
                  >
                    <Text style={s.trackNum}>{i + 1}</Text>
                    {track.album.images?.[2]?.url
                      ? <Image source={{ uri: track.album.images[2].url }} style={s.trackArt} />
                      : <View style={[s.trackArt, { backgroundColor: C.glass }]} />}
                    <View style={{ flex: 1 }}>
                      <Text style={s.trackName} numberOfLines={1}>{track.name}</Text>
                    </View>
                    {reviewed
                      ? <View style={s.reviewedBadge}><Text style={s.reviewedTxt}>Reviewed</Text></View>
                      : <Text style={s.trackDur}>{msToMin(track.duration_ms)}</Text>}
                  </TouchableOpacity>
                );
              })}
            </GCard>
          </>
        )}

        {/* Reviews */}
        <View style={{ marginTop: 24, marginBottom: 8 }}><Eyebrow>Reviews</Eyebrow></View>
        {reviews.length === 0 ? (
          <View style={s.empty}>
            <Icon name="activity" size={28} color={C.fg4} />
            <Text style={s.emptyTxt}>No reviews yet — be the first!</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {reviews.map(r => <ProfileReviewCard key={r._id} r={r} />)}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  glow:   { position: 'absolute', top: 0, left: 0, right: 0, height: 300, backgroundColor: 'rgba(177,78,255,0.08)' },
  scroll: { flex: 1 },

  topBar:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  topBarTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: C.fg, textAlign: 'center' },
  backBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  hero:       { alignItems: 'center', gap: 6, paddingBottom: 20 },
  cover:      { width: 180, height: 180, borderRadius: 90, borderWidth: 2, borderColor: C.violet, marginBottom: 8 },
  artistName: { fontSize: 24, fontWeight: '700', color: C.fg, letterSpacing: -0.5, textAlign: 'center' },
  genre:      { fontSize: 12, color: C.violet, fontWeight: '500', letterSpacing: 0.4 },
  followers:  { fontSize: 11, color: C.fg3 },

  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6 },
  avgScore: { fontSize: 36, fontWeight: '700', letterSpacing: -1 },
  avgLabel: { fontSize: 12, color: C.fg3 },

  rateBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: R.pill, backgroundColor: C.violet },
  rateBtnReviewed: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.violet },
  rateTxt:         { fontSize: 15, fontWeight: '700', color: C.ink900 },
  rateTxtReviewed: { color: C.violet },

  trackRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
  trackRowBorder: { borderTopWidth: 1, borderTopColor: C.stroke },
  trackNum:       { width: 20, fontSize: 13, color: C.fg3, textAlign: 'right' },
  trackArt:       { width: 40, height: 40, borderRadius: R.r2 },
  trackName:      { fontSize: 14, fontWeight: '500', color: C.fg },
  trackDur:       { fontSize: 12, color: C.fg3 },

  reviewedBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill, backgroundColor: 'rgba(177,78,255,0.15)', borderWidth: 1, borderColor: 'rgba(177,78,255,0.4)' },
  reviewedTxt:   { fontSize: 10, fontWeight: '600', color: C.violet, letterSpacing: 0.4 },

  empty:    { alignItems: 'center', gap: 10, paddingTop: 24 },
  emptyTxt: { fontSize: 13, color: C.fg3 },
});
