import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity, ActivityIndicator, Linking, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GCard, Eyebrow, Icon } from '../components';
import { C, R, scoreColor } from '../theme';
import { useAuth } from '../context/auth';
import { useRate } from '../context/rate';
import { api } from '../lib/api';
import { ProfileReviewCard, type ProfileReview } from '../profile/ReviewCard';

type SpotifyTrack = {
  id: string;
  track_number: number;
  name: string;
  duration_ms: number;
  artists: { name: string }[];
};

type SpotifyAlbum = {
  id: string;
  name: string;
  artists: { name: string }[];
  images: { url: string }[];
  release_date: string;
  total_tracks: number;
  tracks: { items: SpotifyTrack[] };
};

type AlbumReview = ProfileReview & { type?: string };

function msToMin(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function AlbumDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const { setItem } = useRate();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [album, setAlbum]       = useState<SpotifyAlbum | null>(null);
  const [reviews, setReviews]   = useState<AlbumReview[]>([]);
  const [avgScore, setAvgScore] = useState<number | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [reviewedTrackIds, setReviewedTrackIds] = useState<Set<string>>(new Set());
  const [hasMore, setHasMore]   = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const offsetRef               = useRef(0);
  const loadingMoreRef          = useRef(false);

  function load() {
    if (!token || !id) return;
    setLoading(true);
    setError(false);
    offsetRef.current = 0;
    Promise.allSettled([
      api.get(`/albums/${id}`, token),
      api.get(`/albums/${id}/reviews?offset=0&limit=20`, token),
      api.get('/reviews/mine', token),
    ]).then(([alb, revData, mine]) => {
      if (alb.status === 'rejected') { setError(true); return; }
      const ok = (r: PromiseSettledResult<any>) => r.status === 'fulfilled' ? r.value : null;
      const a = ok(alb); const rd = ok(revData); const m: any[] = ok(mine) ?? [];
      if (a) setAlbum(a);
      setReviews(rd?.reviews ?? []);
      setAvgScore(rd?.avgScore ?? null);
      setHasMore(rd?.hasMore ?? false);
      offsetRef.current = (rd?.reviews ?? []).length;
      const trackIds = new Set<string>();
      m.forEach(r => { if (r.type !== 'album' && r.spotifyTrackId) trackIds.add(r.spotifyTrackId); });
      setReviewedTrackIds(trackIds);
      setAlreadyReviewed(m.some(r => r.type === 'album' && r.spotifyAlbumId === id));
    }).finally(() => setLoading(false));
  }

  async function loadMore() {
    if (!token || !id || !hasMore || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const rd = await api.get(`/albums/${id}/reviews?offset=${offsetRef.current}&limit=20`, token);
      setReviews(prev => [...prev, ...(rd.reviews ?? [])]);
      setHasMore(rd.hasMore ?? false);
      offsetRef.current += (rd.reviews ?? []).length;
    } catch {} finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }

  useEffect(() => { load(); }, [id, token]); // eslint-disable-line react-hooks/exhaustive-deps

  function rateAlbum() {
    if (!album) return;
    if (alreadyReviewed) {
      Alert.alert('Already reviewed', "You've already rated this album. Delete your existing review to post a new one.");
      return;
    }
    setItem({
      type: 'album',
      spotifyAlbumId: album.id,
      trackName: album.name,
      artistName: album.artists.map(a => a.name).join(', '),
      albumArt: album.images[0]?.url ?? '',
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

  if (error) {
    return (
      <View style={[s.screen, { alignItems: 'center', justifyContent: 'center', gap: 12 }]}>
        <Icon name="wifi-off" size={32} color={C.fg4} />
        <Text style={{ color: C.fg, fontWeight: '600', fontSize: 16 }}>Something went wrong</Text>
        <TouchableOpacity onPress={load} activeOpacity={0.7} style={s.retryBtn}>
          <Text style={s.retryTxt}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!album) {
    return (
      <View style={[s.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: C.fg3 }}>Album not found.</Text>
      </View>
    );
  }

  const year = album.release_date?.slice(0, 4) ?? '';
  const artistStr = album.artists.map(a => a.name).join(', ');

  return (
    <View style={s.screen}>
      <View style={s.glow} pointerEvents="none" />

      <View style={[s.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={s.backBtn}>
          <Icon name="arrow-left" size={22} color={C.fg} />
        </TouchableOpacity>
        <Text style={s.topBarTitle} numberOfLines={1}>{album.name}</Text>
        <TouchableOpacity
          onPress={() => Linking.openURL(`https://open.spotify.com/album/${album.id}`)}
          activeOpacity={0.7}
          style={s.spotifyBtn}
        >
          <Text style={s.spotifyTxt}>▶</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        onScroll={({ nativeEvent: e }) => {
          if (e.contentOffset.y + e.layoutMeasurement.height >= e.contentSize.height - 300) loadMore();
        }}
        scrollEventThrottle={100}
      >
        {/* Hero */}
        <View style={s.hero}>
          {album.images[0]?.url
            ? <Image source={{ uri: album.images[0].url }} style={s.cover} />
            : <View style={[s.cover, { backgroundColor: C.glass }]} />}
          <Text style={s.albumName}>{album.name}</Text>
          <Text style={s.albumArtist}>{artistStr}</Text>
          <Text style={s.albumMeta}>{year} · {album.total_tracks} tracks</Text>

          {avgScore !== null && (
            <View style={s.scoreRow}>
              <Text style={[s.avgScore, { color: scoreColor(avgScore) }]}>{avgScore.toFixed(1)}</Text>
              <Text style={s.avgLabel}>avg from {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}</Text>
            </View>
          )}
        </View>

        {/* Rate button */}
        <TouchableOpacity
          onPress={rateAlbum}
          activeOpacity={0.85}
          style={[s.rateBtn, alreadyReviewed && s.rateBtnReviewed]}
        >
          <Icon name="star" size={16} color={alreadyReviewed ? C.violet : C.ink900} />
          <Text style={[s.rateTxt, alreadyReviewed && s.rateTxtReviewed]}>
            {alreadyReviewed ? 'Already reviewed' : 'Rate this album'}
          </Text>
        </TouchableOpacity>

        {/* Tracklist */}
        {album.tracks.items.length > 0 && (
          <>
            <View style={{ marginTop: 24, marginBottom: 8 }}><Eyebrow>Tracklist</Eyebrow></View>
            <GCard style={{ padding: 4 }}>
              {album.tracks.items.map((track, i) => {
                const reviewed = reviewedTrackIds.has(track.id);
                return (
                  <TouchableOpacity
                    key={track.id}
                    activeOpacity={0.75}
                    onPress={() => router.push(`/song/${track.id}` as any)}
                    style={[s.trackRow, i > 0 && s.trackRowBorder]}
                  >
                    <Text style={s.trackNum}>{track.track_number}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.trackName} numberOfLines={1}>{track.name}</Text>
                      {track.artists.map(a => a.name).join(', ') !== artistStr && (
                        <Text style={s.trackArtist} numberOfLines={1}>{track.artists.map(a => a.name).join(', ')}</Text>
                      )}
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
        {loadingMore && <ActivityIndicator color={C.violet} style={{ marginTop: 16 }} />}
        {!hasMore && reviews.length > 0 && <Text style={s.endTxt}>All {reviews.length} reviews loaded</Text>}
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
  spotifyBtn:  { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1DB954', borderRadius: 18 },
  spotifyTxt:  { fontSize: 13, fontWeight: '700', color: '#000' },

  hero:        { alignItems: 'center', gap: 6, paddingBottom: 20 },
  cover:       { width: 200, height: 200, borderRadius: R.r3, borderWidth: 1, borderColor: C.stroke, marginBottom: 8 },
  albumName:   { fontSize: 22, fontWeight: '700', color: C.fg, letterSpacing: -0.5, textAlign: 'center' },
  albumArtist: { fontSize: 14, color: C.violet, fontWeight: '500' },
  albumMeta:   { fontSize: 11, color: C.fg3, letterSpacing: 0.4 },

  scoreRow:  { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6 },
  avgScore:  { fontSize: 36, fontWeight: '700', letterSpacing: -1 },
  avgLabel:  { fontSize: 12, color: C.fg3 },

  rateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: R.pill,
    backgroundColor: C.violet,
  },
  rateBtnReviewed: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.violet },
  rateTxt:         { fontSize: 15, fontWeight: '700', color: C.ink900 },
  rateTxtReviewed: { color: C.violet },

  trackRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 },
  trackRowBorder: { borderTopWidth: 1, borderTopColor: C.stroke },
  trackNum:       { width: 22, fontSize: 13, color: C.fg3, textAlign: 'right' },
  trackName:      { fontSize: 14, fontWeight: '500', color: C.fg },
  trackArtist:    { fontSize: 11, color: C.fg3, marginTop: 1 },
  trackDur:       { fontSize: 12, color: C.fg3 },

  reviewedBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill, backgroundColor: 'rgba(177,78,255,0.15)', borderWidth: 1, borderColor: 'rgba(177,78,255,0.4)' },
  reviewedTxt:   { fontSize: 10, fontWeight: '600', color: C.violet, letterSpacing: 0.4 },

  empty:    { alignItems: 'center', gap: 10, paddingTop: 24 },
  emptyTxt: { fontSize: 13, color: C.fg3 },
  endTxt:   { fontSize: 11, color: C.fg4, textAlign: 'center', marginTop: 16, marginBottom: 8 },

  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: R.pill, backgroundColor: C.violet },
  retryTxt: { fontSize: 14, fontWeight: '700', color: C.ink900 },
});
