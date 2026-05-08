import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar, Eyebrow, Icon } from '../components';
import { C } from '../theme';
export default function HomeFeed() {
  const insets = useSafeAreaInsets();

  return (
    <View style={s.screen}>
      <View style={s.glow} pointerEvents="none" />
      <TopBar
        pt={insets.top + 12}
        title={<Text style={s.wordmark}>rotation</Text>}
        large
        leading={
          <TouchableOpacity activeOpacity={0.7}>
            <Icon name="flame" size={22} color={C.fg2} />
          </TouchableOpacity>
        }
        trailing={<Icon name="bookmark" size={22} color={C.fg2} />}
      />
      <View style={s.center}>
        <Eyebrow>Your feed</Eyebrow>
        <Text style={s.empty}>Follow people to see their reviews here.</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: C.bg },
  glow:     { position: 'absolute', top: 0, left: 0, right: 0, height: 280, backgroundColor: 'rgba(177,78,255,0.08)' },
  wordmark: { fontSize: 22, fontWeight: '700', color: C.violet, letterSpacing: -0.5 },
  center:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  empty:    { fontSize: 14, color: C.fg3, textAlign: 'center', lineHeight: 21 },
});
