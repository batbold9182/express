import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar, Eyebrow } from '../components';
import { C } from '../theme';

export default function Feed() {
  const insets = useSafeAreaInsets();
  return (
    <View style={s.screen}>
      <TopBar title="Feed" pt={insets.top + 12} />
      <View style={s.center}>
        <Eyebrow>Your activity feed</Eyebrow>
        <Text style={s.empty}>Quiet in here. Follow some people, or rate a song.</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  empty:  { fontSize: 14, color: C.fg3, textAlign: 'center', lineHeight: 21 },
});
