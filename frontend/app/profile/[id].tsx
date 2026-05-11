import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GCard, Eyebrow, Icon } from '../components';
import { C, R } from '../theme';
import { useAuth } from '../context/auth';
import { api } from '../lib/api';
import { ProfileReviewCard, type ProfileReview } from './ReviewCard';

type AppUser = {
  _id: string;
  spotifyId: string;
  displayName: string;
  avatarUrl: string;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
};

export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, spotifyId: myId } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<AppUser | null>(null);
  const [reviews, setReviews] = useState<ProfileReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  const isOwn = id === myId;

  useEffect(() => {
    if (!token || !id) return;
    Promise.all([
      api.get(`/users/${id}`, token),
      api.get(`/users/${id}/reviews`, token),
    ]).then(([user, revs]) => {
      setProfile(user);
      setFollowing(user.isFollowing);
      setReviews(revs);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id, token]);

  async function toggleFollow() {
    if (!token || busy || !id) return;
    setBusy(true);
    try {
      if (following) {
        await api.del(`/users/${id}/follow`, token);
        setFollowing(false);
        setProfile(p => p ? { ...p, followerCount: p.followerCount - 1 } : p);
      } else {
        await api.post(`/users/${id}/follow`, token, {});
        setFollowing(true);
        setProfile(p => p ? { ...p, followerCount: p.followerCount + 1 } : p);
      }
    } catch {} finally { setBusy(false); }
  }

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

      <View style={[s.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={s.backBtn}>
          <Icon name="arrow-left" size={22} color={C.fg} />
        </TouchableOpacity>
        <Text style={s.topBarTitle} numberOfLines={1}>{profile?.displayName ?? ''}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.identity}>
          {profile?.avatarUrl
            ? <Image source={{ uri: profile.avatarUrl }} style={s.avatar} />
            : <View style={[s.avatar, { backgroundColor: C.glass }]} />}
          <Text style={s.name}>{profile?.displayName ?? '—'}</Text>
          <Text style={s.handle}>@{profile?.spotifyId}</Text>
        </View>

        <GCard style={{ padding: 14, flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 }}>
          <View style={{ alignItems: 'center', gap: 2 }}>
            <Text style={s.statVal}>{reviews.length}</Text>
            <Text style={s.statLbl}>reviews</Text>
          </View>
          {(['followers', 'following'] as const).map(type => (
            <TouchableOpacity
              key={type}
              onPress={() => router.push({ pathname: '/profile/follow-list', params: { id, type } } as any)}
              activeOpacity={0.7}
              style={{ alignItems: 'center', gap: 2 }}
            >
              <Text style={s.statVal}>{type === 'followers' ? profile?.followerCount ?? 0 : profile?.followingCount ?? 0}</Text>
              <Text style={[s.statLbl, { color: C.violet }]}>{type}</Text>
            </TouchableOpacity>
          ))}
        </GCard>

        {!isOwn && (
          <TouchableOpacity
            onPress={toggleFollow}
            activeOpacity={0.7}
            disabled={busy}
            style={[s.followBtn, following && s.followingBtn]}
          >
            {busy
              ? <ActivityIndicator size="small" color={following ? C.violet : C.ink900} />
              : <Text style={[s.followTxt, following && s.followingTxt]}>
                  {following ? 'Following' : 'Follow'}
                </Text>}
          </TouchableOpacity>
        )}

        {reviews.length > 0 ? (
          <>
            <View style={{ marginTop: 20, marginBottom: 8 }}><Eyebrow>Reviews</Eyebrow></View>
            <View style={{ gap: 10 }}>
              {reviews.map(r => <ProfileReviewCard key={r._id} r={r} />)}
            </View>
          </>
        ) : (
          <View style={s.empty}>
            <Icon name="activity" size={28} color={C.fg4} />
            <Text style={s.emptyTxt}>No reviews yet</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  glow:   { position: 'absolute', top: 0, left: 0, right: 0, height: 240, backgroundColor: 'rgba(177,78,255,0.07)' },
  scroll: { flex: 1 },

  topBar:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  topBarTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: C.fg, textAlign: 'center' },
  backBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  identity: { alignItems: 'center', gap: 8, paddingBottom: 20 },
  avatar:   { width: 88, height: 88, borderRadius: 44, borderWidth: 2, borderColor: C.violet },
  name:     { fontSize: 22, fontWeight: '600', color: C.fg, letterSpacing: -0.5 },
  handle:   { fontSize: 11, color: C.cyan, letterSpacing: 0.8 },

  statVal: { fontSize: 20, fontWeight: '600', color: C.fg, letterSpacing: -0.5 },
  statLbl: { fontSize: 9, fontWeight: '500', color: C.fg3, letterSpacing: 1.2, textTransform: 'uppercase' },

  followBtn:    { alignSelf: 'center', paddingHorizontal: 36, paddingVertical: 10, borderRadius: R.pill, backgroundColor: C.violet },
  followingBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.violet },
  followTxt:    { fontSize: 14, fontWeight: '600', color: C.ink900 },
  followingTxt: { color: C.violet },

  empty:    { alignItems: 'center', gap: 10, paddingTop: 40 },
  emptyTxt: { fontSize: 14, color: C.fg3 },
});
