import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { C } from '../theme';

export function Eyebrow({ children, color }: { children: string; color?: string }) {
  return <Text style={[s.eyebrow, { color: color ?? C.fg3 }]}>{children}</Text>;
}

const s = StyleSheet.create({
  eyebrow: { fontSize: 11, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase', color: C.fg3, marginBottom: 8 },
});
