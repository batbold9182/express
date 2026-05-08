import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar, Icon } from '../components';
import { C } from '../theme';

export default function ReviewCreate() {
  const insets = useSafeAreaInsets();

  return (
    <View style={s.screen}>
      <View style={s.glow} pointerEvents="none" />
      <TopBar
        pt={insets.top + 12}
        title="Write a review"
        leading={
          <TouchableOpacity activeOpacity={0.7}>
            <Icon name="x" size={22} color={C.fg2} />
          </TouchableOpacity>
        }
        trailing={
          <TouchableOpacity activeOpacity={0.7}>
            <Text style={s.postBtn}>Post</Text>
          </TouchableOpacity>
        }
      />

      <View style={s.emptyWrap}>
        <Icon name="search" size={32} color={C.fg4} />
        <Text style={s.emptyTitle}>Pick something to rate</Text>
        <Text style={s.emptyTxt}>Search for a song or album in the Search tab, then tap it to rate.</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  glow:   { position: 'absolute', top: 0, left: 0, right: 0, height: 240, backgroundColor: 'rgba(177,78,255,0.07)' },
  postBtn: { fontSize: 13, fontWeight: '600', color: C.fg3 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: C.fg },
  emptyTxt:   { fontSize: 13, color: C.fg3, textAlign: 'center', lineHeight: 20 },
});
