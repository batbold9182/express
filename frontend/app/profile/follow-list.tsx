import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components';
import { C, R } from '../theme';
import { useAuth } from '../context/auth';
import { api } from '../lib/api';

type FollowUser = {
  _id: string;
  spotifyId: string;
  displayName: string;
  avatarUrl: string;
  isFollowing: boolean;
};

function UserRow({ user, myId, token }: { user: FollowUser; myId: string; token: string }) {
  const router = useRouter();
  const [following, setFollowing] = useState(user.isFollowing);
  const [busy, setBusy] = useState(false);
  const isOwn = user.spotifyId === myId;

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      if (following) {
        await api.del(`/users/${user.spotifyId}/follow`, token);
        setFollowing(false);
      } else {
        await api.post(`/users/${user.spotifyId}/follow`, token, {});
        setFollowing(true);
      }
    } catch {} finally { setBusy(false); }
  }

  return (
    <TouchableOpacity
      onPress={() => router.push(`/profile/${user.spotifyId}` as any)}
      activeOpacity={0.7}
      style={s.row}
    >
      {user.avatarUrl
        ? <Image source={{ uri: user.avatarUrl }} style={s.avatar} />
        : <View style={[s.avatar, { backgroundColor: C.glass }]} />}
      <View style={{ flex: 1 }}>
        <Text style={s.name}>{user.displayName}</Text>
        <Text style={s.handle}>@{user.spotifyId}</Text>
      </View>
      {!isOwn && (
        <TouchableOpacity
          onPress={toggle}
          activeOpacity={0.7}
          disabled={busy}
          style={[s.btn, following && s.btnFollowing]}
        >
          {busy
            ? <ActivityIndicator size="small" color={following ? C.violet : C.ink900} />
            : <Text style={[s.btnTxt, following && s.btnTxtFollowing]}>
                {following ? 'Following' : 'Follow'}
              </Text>}
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

export default function FollowList() {
  const { id, type } = useLocalSearchParams<{ id: string; type: 'followers' | 'following' }>();
  const { token, spotifyId: myId } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [users, setUsers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !id) return;
    api.get(`/users/${id}/${type}`, token)
      .then(setUsers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, type, token]);

  return (
    <View style={s.screen}>
      <View style={[s.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={s.backBtn}>
          <Icon name="arrow-left" size={22} color={C.fg} />
        </TouchableOpacity>
        <Text style={s.title}>{type === 'followers' ? 'Followers' : 'Following'}</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={C.violet} size="large" /></View>
      ) : users.length === 0 ? (
        <View style={s.center}>
          <Icon name="user" size={28} color={C.fg4} />
          <Text style={s.empty}>{type === 'followers' ? 'No followers yet' : 'Not following anyone'}</Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={u => u._id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          ItemSeparatorComponent={() => <View style={s.divider} />}
          renderItem={({ item }) => (
            <UserRow user={item} myId={myId!} token={token!} />
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: C.bg },
  topBar:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12 },
  title:   { flex: 1, fontSize: 16, fontWeight: '600', color: C.fg, textAlign: 'center' },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  empty:   { fontSize: 14, color: C.fg3 },

  row:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  name:   { fontSize: 14, fontWeight: '600', color: C.fg },
  handle: { fontSize: 11, color: C.fg3, marginTop: 1 },

  divider: { height: 1, backgroundColor: C.stroke },

  btn:            { paddingHorizontal: 16, paddingVertical: 7, borderRadius: R.pill, backgroundColor: C.violet },
  btnFollowing:   { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.violet },
  btnTxt:         { fontSize: 13, fontWeight: '600', color: C.ink900 },
  btnTxtFollowing:{ color: C.violet },
});
