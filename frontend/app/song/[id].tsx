import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, ActivityIndicator, Linking, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Score, Eyebrow, GCard, StreamingBadge, BtnPrimary, BtnGlass, Icon, MoodTag } from '../components';
import { C, R } from '../theme';
import { useAuth } from '../context/auth';
import { useRate } from '../context/rate';
import { api } from '../lib/api';
import { shareUrl } from '../lib/share';
import { MOOD_COLOR, msToMin } from '@tunelog/shared';

type SpotifyTrack = {
  id: string;
  name: string;
  duration_ms: number;
  artists: { id: string; name: string }[];
  album: { id: string; name: string; images: { url: string }[]; release_date: string };
  external_urls: { spotify: string };
};

type TrackReview = {
  _id: string;
  userId: { _id: string; displayName: string; avatarUrl?: string; spotifyId: string };
  score: number;
  text?: string;
  moods?: string[];
  createdAt: string;
};

export default function SongDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const { setItem } = useRate();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [track, setTrack]               = useState<SpotifyTrack | null>(null);
  const [reviews, setReviews]           = useState<TrackReview[]>([]);
  const [avgScore, setAvgScore]         = useState<number | null>(null);
  const [distribution, setDistribution] = useState<number[]>(Array(10).fill(0));
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [error, setError]               = useState(false);
  const [hasMore, setHasMore]           = useState(true);
  const [loadingMore, setLoadingMore]   = useState(false);
  const offsetRef                        = useRef(0);
  const loadingMoreRef                   = useRef(false);

  function load(isRefresh = false) {
    if (!token || !id) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(false);
    offsetRef.current = 0;
    Promise.allSettled([
      api.get(`/tracks/${id}`, token),
      api.get(`/tracks/${id}/reviews?offset=0&limit=20`, token),
      api.get('/reviews/mine', token),
    ]).then((results) => {
      if (results[0].status === 'rejected') { setError(true); return; }
      const ok = (r: PromiseSettledResult<any>) => r.status === 'fulfilled' ? r.value : null;
      const t   = ok(results[0]);
      const rd  = ok(results[1]);
      const mine: any[] = ok(results[2]) ?? [];
      if (t) setTrack(t);
      if (rd) {
        setReviews(rd.reviews ?? []);
        setAvgScore(rd.avgScore ?? null);
        setDistribution(rd.distribution ?? Array(10).fill(0));
        setHasMore(rd.hasMore ?? false);
        offsetRef.current = (rd.reviews ?? []).length;
      }
      setAlreadyReviewed(mine.some((r: any) =>
        (r.type === 'track' || !r.type) && r.spotifyTrackId === id
      ));
    }).finally(() => { setLoading(false); setRefreshing(false); });
  }

  async function loadMore() {
    if (!token || !id || !hasMore || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const rd = await api.get(`/tracks/${id}/reviews?offset=${offsetRef.current}&limit=20`, token);
      setReviews(prev => [...prev, ...(rd.reviews ?? [])]);
      setHasMore(rd.hasMore ?? false);
      offsetRef.current += (rd.reviews ?? []).length;
    } catch {} finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }

  useEffect(() => { load(); }, [id, token]); // eslint-disable-line react-hooks/exhaustive-deps

  function rateTrack() {
    if (!track || alreadyReviewed) return;
    setItem({
      type: 'track',
      spotifyTrackId: track.id,
      spotifyAlbumId: track.album.id,
      spotifyArtistId: track.artists[0]?.id,
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

  if (error || !track) {
    return (
      <View style={[s.screen, { alignItems: 'center', justifyContent: 'center', gap: 12 }]}>
        <Icon name="wifi-off" size={32} color={C.fg3} />
        <Text style={{ color: C.fg, fontWeight: '600', fontSize: 16 }}>Something went wrong</Text>
        <TouchableOpacity onPress={() => load()} activeOpacity={0.7} style={s.retryBtn}>
          <Text style={s.retryTxt}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const albumArt  = track.album.images[0]?.url;
  const year      = track.album.release_date?.slice(0, 4) ?? '';
  const artistStr = track.artists.map(a => a.name).join(', ');
  const maxDist   = Math.max(...distribution, 1);

  return (
    <View style={s.screen}>
      {albumArt && (
        <View style={s.hero} pointerEvents="none">
          <Image source={{ uri: albumArt }} style={{ width: '100%', height: '100%' }} blurRadius={20} />
          <View style={s.heroOverlay} />
        </View>
      )}

      <View style={[s.navRow, { top: insets.top + 8, justifyContent: 'space-between' }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8} style={s.circleBtn}>
          <Icon name="arrow-left" size={16} color={C.fg} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => shareUrl(`https://open.spotify.com/track/${track!.id}`, `${track!.name} by ${artistStr}`)} activeOpacity={0.8} style={s.circleBtn}>
          <Icon name="share" size={16} color={C.fg} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={{ paddingTop: 60, paddingHorizontal: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.violet} />}
        onScroll={({ nativeEvent: e }) => {
          if (e.contentOffset.y + e.layoutMeasurement.height >= e.contentSize.height - 300) loadMore();
        }}
        scrollEventThrottle={100}
      >
        {/* Hero */}
        <View style={s.heroContent}>
          {albumArt
            ? <Image source={{ uri: albumArt }} style={s.cover} />
            : <View style={[s.cover, { backgroundColor: C.glass }]} />}
          <Text style={s.songTitle}>{track.name}</Text>
          <Text style={s.songArtist}>{artistStr}</Text>
          <Text style={s.songMeta}>{year} · {msToMin(track.duration_ms)}</Text>

          {avgScore !== null && (
            <View style={{ alignItems: 'center', gap: 4, marginTop: 8 }}>
              <Score value={avgScore} size="xl" />
              <Text style={s.ratingsMeta}>
                {reviews.length} {reviews.length === 1 ? 'rating' : 'ratings'}
              </Text>
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            {alreadyReviewed
              ? <BtnGlass onPress={undefined}>Already reviewed</BtnGlass>
              : <BtnPrimary onPress={rateTrack}>Rate it</BtnPrimary>}
            <TouchableOpacity
              onPress={() => Linking.openURL(track.external_urls.spotify)}
              activeOpacity={0.85}
              style={s.spotBtn}
            >
              <View style={s.spotDot} />
              <Text style={s.spotTxt}>Play on Spotify</Text>
            </TouchableOpacity>
          </View>

          <View style={{ marginTop: 6 }}>
            <StreamingBadge platform="spotify" />
          </View>
        </View>

        {/* Distribution */}
        {reviews.length > 0 && (
          <GCard style={{ padding: 14, marginBottom: 16 }}>
            <Eyebrow>Distribution</Eyebrow>
            <View style={s.distBar}>
              {distribution.map((v, i) => (
                <View
                  key={i}
                  style={[s.distCol, {
                    height: Math.max(2, (v / maxDist) * 44),
                    backgroundColor: i >= 7 ? C.lime : i >= 5 ? C.violet : i >= 3 ? C.amber : C.red,
                  }]}
                />
              ))}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              {['1', '5', '10'].map(l => <Text key={l} style={s.distLbl}>{l}</Text>)}
            </View>
          </GCard>
        )}

        {/* Reviews */}
        <View style={{ marginBottom: 10 }}><Eyebrow>Reviews</Eyebrow></View>
        {reviews.length === 0 ? (
          <View style={s.empty}>
            <Icon name="activity" size={28} color={C.fg3} />
            <Text style={s.emptyTxt}>No reviews yet — be the first!</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {reviews.map(r => (
              <GCard key={r._id} style={{ padding: 12, flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity onPress={() => router.push(`/profile/${r.userId.spotifyId}` as any)} activeOpacity={0.7}>
                  {r.userId.avatarUrl
                    ? <Image source={{ uri: r.userId.avatarUrl }} style={s.avatar} />
                    : <Avatar name={r.userId.displayName || '?'} size={36} style={{ borderWidth: 1, borderColor: C.stroke }} />}
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity onPress={() => router.push(`/profile/${r.userId.spotifyId}` as any)} activeOpacity={0.7}>
                      <Text style={s.revUser}>{r.userId.displayName}</Text>
                    </TouchableOpacity>
                    <Score value={r.score} size="sm" glow={r.score >= 8.5} />
                  </View>
                  {!!r.text && <Text style={s.revText}>{r.text}</Text>}
                  {(r.moods?.length ?? 0) > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {r.moods!.map(m => <MoodTag key={m} label={m} color={MOOD_COLOR[m]} />)}
                    </View>
                  )}
                </View>
              </GCard>
            ))}
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

  hero: { position: 'absolute', top: 0, left: 0, right: 0, height: 380, overflow: 'hidden', opacity: 0.35 },
  heroOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(11,8,22,0.7)' },

  navRow:    { position: 'absolute', left: 16, right: 16, flexDirection: 'row', zIndex: 10 },
  circleBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: C.stroke,
    alignItems: 'center', justifyContent: 'center',
  },

  scroll: { flex: 1 },

  heroContent: { alignItems: 'center', gap: 4, paddingBottom: 24 },
  cover:       { width: 240, height: 240, borderRadius: R.r6, borderWidth: 1, borderColor: C.stroke, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
  songTitle:   { fontSize: 26, fontWeight: '700', color: C.fg, letterSpacing: -0.5, textAlign: 'center', marginTop: 8 },
  songArtist:  { fontSize: 15, color: C.fg2 },
  songMeta:    { fontSize: 10, color: C.fg3, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 2 },
  ratingsMeta: { fontSize: 12, color: C.fg3 },

  spotBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.spotify, paddingVertical: 10, paddingHorizontal: 16, borderRadius: R.pill,
  },
  spotDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#000' },
  spotTxt: { color: '#000', fontSize: 13, fontWeight: '600' },

  distBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 44, marginTop: 10 },
  distCol: { flex: 1, borderRadius: 2, minHeight: 2 },
  distLbl: { fontSize: 9, color: C.fg3 },

  avatar:   { width: 36, height: 36, borderRadius: 18 },
  revUser:  { fontSize: 13, fontWeight: '600', color: C.fg },
  revText:  { fontSize: 13, color: C.fg2, lineHeight: 19, marginTop: 4 },

  empty:    { alignItems: 'center', gap: 10, paddingTop: 24 },
  emptyTxt: { fontSize: 13, color: C.fg3 },
  endTxt:   { fontSize: 11, color: C.fg4, textAlign: 'center', marginTop: 16, marginBottom: 8 },

  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: R.pill, backgroundColor: C.violet },
  retryTxt: { fontSize: 14, fontWeight: '700', color: C.ink900 },
});
