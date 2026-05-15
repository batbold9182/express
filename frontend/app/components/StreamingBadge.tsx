import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C, R } from '../theme';

export function StreamingBadge({ platform = 'spotify' }: { platform?: 'spotify' | 'apple' | 'rotation' }) {
  const cfg = {
    spotify:  { c: C.spotify, label: 'Play on Spotify' },
    apple:    { c: C.apple,   label: 'Apple Music' },
    rotation: { c: C.pink,    label: 'In your rotation' },
  }[platform];
  return (
    <View style={[s.badge, { backgroundColor: cfg.c + '1f', borderColor: cfg.c + '55' }]}>
      <View style={[s.dot, { backgroundColor: cfg.c }]} />
      <Text style={[s.text, { color: cfg.c }]}>{cfg.label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 10, borderRadius: R.pill, borderWidth: 1 },
  dot:   { width: 7, height: 7, borderRadius: 4 },
  text:  { fontSize: 11, fontWeight: '500' },
});
