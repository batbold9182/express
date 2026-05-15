import React from 'react';
import { Text, StyleSheet, TextStyle } from 'react-native';
import { C, scoreColor } from '../theme';

export function Score({ value, size = 'md', glow = true }: {
  value: number; size?: 'sm' | 'md' | 'lg' | 'xl'; glow?: boolean;
}) {
  const color = scoreColor(value);
  const fz = { sm: 16, md: 22, lg: 32, xl: 84 }[size];
  const isElite = value >= 8.5;
  const glowStyle: TextStyle = glow && (size === 'xl' || isElite)
    ? { textShadowColor: color, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: size === 'xl' ? 24 : 10 }
    : {};
  return (
    <Text style={[s.base, { color, fontSize: fz }, glowStyle]}>
      {value.toFixed(1)}
      <Text style={[s.denom, { fontSize: Math.max(10, fz! * 0.28) }]}>/10</Text>
    </Text>
  );
}

const s = StyleSheet.create({
  base:  { fontWeight: '600', letterSpacing: -0.5 },
  denom: { color: C.fg3, fontWeight: '500', letterSpacing: 0 },
});
