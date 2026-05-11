import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar, Eyebrow, GCard, Icon } from '../components';
import { C, R } from '../theme';
import { useAuth } from '../context/auth';
import { api } from '../lib/api';
import { ProfileReviewCard, type ProfileReview } from '../profile/ReviewCard';

type SpotifyUser = {
  display_name: string;
  id: string;
  images: { url: string }[];
};

type SpotifyArtist = {
  id: string;
  name: string;
  images: { url: string }[];
  genres: string[];
};

type AppUser = {
  followerCount: number;
  followingCount: number;
};

export default function Profile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token, spotifyId, clearToken } = useAuth();
  const [user, setUser]           = useState<SpotifyUser | null>(null);
  const [appUser, setAppUser]     = useState<AppUser | null>(null);
  const [topArtists, setTopArtists] = useState<SpotifyArtist[]>([]);
  const [reviews, setReviews]     = useState<ProfileReview[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    if (!token || !spotifyId) return;
    Promise.all([
      api.get('/me', token),
      api.get('/me/top/artists', token),
      api.get(`/users/${spotifyId}`, token),
      api.get(`/users/${spotifyId}/reviews`, token),
    ]).then(([u, a, au, revs]) => {
      setUser(u);
      setTopArtists(a.items ?? []);
      setAppUser(au);
      setReviews(revs);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [token, spotifyId]);

  const genreMap: Record<string, number> = {};
  topArtists.forEach(a => (a.genres ?? []).slice(0, 2).forEach(g => { genreMap[g] = (genreMap[g] ?? 0) + 1; }));
  const topGenres = Object.entries(genreMap).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const maxCount = topGenres[0]?.[1] ?? 1;

  const GENRE_COLORS = [C.violet, C.pink, C.cyan, C.lime];

  if (loading) {
    return (
      <View style={[s.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={C.violet} size="large" />
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <View style={s.glow} pointerEvents="none" />
      <TopBar
        pt={insets.top + 12}
        leading={
          <TouchableOpacity activeOpacity={0.7} onPress={clearToken}>
            <Icon name="settings" size={22} color={C.fg2} />
          </TouchableOpacity>
        }
        trailing={
          <TouchableOpacity activeOpacity={0.7}>
            <Icon name="share" size={22} color={C.fg2} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Identity */}
        <View style={s.identity}>
          {user?.images?.[0]?.url ? (
            <Image source={{ uri: user.images[0].url }} style={s.avatar} />
          ) : (
            <View style={[s.avatar, { backgroundColor: C.glass }]} />
          )}
          <Text style={s.name}>{user?.display_name ?? '—'}</Text>
          <Text style={s.handle}>@{user?.id}</Text>
        </View>

        {/* Stats */}
        <GCard style={{ padding: 14, flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 }}>
          <View style={{ alignItems: 'center', gap: 2 }}>
            <Text style={s.statVal}>{reviews.length}</Text>
            <Text style={s.statLbl}>reviews</Text>
          </View>
          {(['followers', 'following'] as const).map(type => (
            <TouchableOpacity
              key={type}
              onPress={() => router.push({ pathname: '/profile/follow-list', params: { id: spotifyId, type } } as any)}
              activeOpacity={0.7}
              style={{ alignItems: 'center', gap: 2 }}
            >
              <Text style={s.statVal}>{type === 'followers' ? appUser?.followerCount ?? 0 : appUser?.followingCount ?? 0}</Text>
              <Text style={[s.statLbl, { color: C.violet }]}>{type}</Text>
            </TouchableOpacity>
          ))}
        </GCard>

        {/* Top genres */}
        {topGenres.length > 0 && (
          <>
            <Eyebrow>Top genres</Eyebrow>
            <GCard style={{ padding: 14, marginTop: 8, marginBottom: 20, gap: 10 }}>
              {topGenres.map(([name, count], i) => (
                <View key={name} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={s.genreName} numberOfLines={1}>{name}</Text>
                  <View style={s.barTrack}>
                    <View style={[s.barFill, { width: `${(count / maxCount) * 100}%` as any, backgroundColor: GENRE_COLORS[i] }]} />
                  </View>
                </View>
              ))}
            </GCard>
          </>
        )}

        {/* Top artists */}
        {topArtists.length > 0 && (
          <>
            <Eyebrow>Top artists</Eyebrow>
            <View style={{ gap: 8, marginTop: 8, marginBottom: 20 }}>
              {topArtists.map((a, i) => (
                <GCard key={a.id} style={{ padding: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Text style={s.artistRank}>{i + 1}</Text>
                  {a.images?.[2]?.url ? (
                    <Image source={{ uri: a.images[2].url }} style={s.artistImg} />
                  ) : (
                    <View style={[s.artistImg, { backgroundColor: C.glass }]} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={s.artistName}>{a.name}</Text>
                    {a.genres?.[0] && <Text style={s.artistGenre} numberOfLines={1}>{a.genres[0]}</Text>}
                  </View>
                </GCard>
              ))}
            </View>
          </>
        )}

        {/* Own reviews */}
        <Eyebrow>My reviews</Eyebrow>
        {reviews.length === 0 ? (
          <View style={s.empty}>
            <Icon name="activity" size={28} color={C.fg4} />
            <Text style={s.emptyTxt}>No reviews yet</Text>
          </View>
        ) : (
          <View style={{ gap: 10, marginTop: 8 }}>
            {reviews.map(r => <ProfileReviewCard key={r._id} r={r} />)}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 260, backgroundColor: 'rgba(177,78,255,0.08)' },
  scroll: { flex: 1 },

  identity: { alignItems: 'center', gap: 8, paddingBottom: 20 },
  avatar:   { width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: C.violet },
  name:     { fontSize: 24, fontWeight: '600', color: C.fg, letterSpacing: -0.5 },
  handle:   { fontSize: 11, color: C.cyan, letterSpacing: 0.8 },

  statVal: { fontSize: 22, fontWeight: '600', color: C.fg, letterSpacing: -0.5 },
  statLbl: { fontSize: 9, fontWeight: '500', color: C.fg3, letterSpacing: 1.2, textTransform: 'uppercase' },

  genreName: { width: 120, fontSize: 12, fontWeight: '500', color: C.fg },
  barTrack:  { flex: 1, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  barFill:   { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 4 },

  artistRank:  { width: 24, fontSize: 18, fontWeight: '600', color: C.fg3, letterSpacing: -0.5 },
  artistImg:   { width: 40, height: 40, borderRadius: 20 },
  artistName:  { fontSize: 14, fontWeight: '600', color: C.fg },
  artistGenre: { fontSize: 11, color: C.fg3, marginTop: 1 },

  art:        { width: 48, height: 48, borderRadius: R.r2 },
  track:      { fontSize: 14, fontWeight: '600', color: C.fg },
  artist:     { fontSize: 11, color: C.fg2 },
  score:      { fontSize: 22, fontWeight: '600', letterSpacing: -0.5 },
  reviewText: { fontSize: 13, color: C.fg2, lineHeight: 19 },
  moodChip:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill, backgroundColor: C.glassThin, borderWidth: 1, borderColor: C.stroke },
  moodTxt:    { fontSize: 10, color: C.fg3 },
  spotifyBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: R.pill, backgroundColor: '#1DB954' },
  spotifyTxt: { fontSize: 10, fontWeight: '700', color: '#000', letterSpacing: 0.4 },

  empty:    { alignItems: 'center', gap: 10, paddingTop: 24 },
  emptyTxt: { fontSize: 13, color: C.fg3 },
});
