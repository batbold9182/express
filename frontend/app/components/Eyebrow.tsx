import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C } from '../theme';

export function Eyebrow({ children, color }: { children: string; color?: string }) {
  return (
    <View style={s.wrap}>
      <View style={[s.accent, { backgroundColor: color ?? C.violet }]} />
      <Text style={[s.text, { color: color ?? C.fg3 }]}>{children}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  accent: { width: 3, height: 11, borderRadius: 2 },
  text:   { fontSize: 11, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', color: C.fg3 },
});
