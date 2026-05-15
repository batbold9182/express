import React from 'react';
import { Text, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AVATAR_COLORS } from '../theme';

const COLOR_KEYS = Object.keys(AVATAR_COLORS) as (keyof typeof AVATAR_COLORS)[];

function pickColors(name: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[COLOR_KEYS[hash % COLOR_KEYS.length]];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function Avatar({ name, size = 36, style }: {
  name: string; size?: number; style?: ViewStyle;
}) {
  const colors = pickColors(name);
  const fontSize = Math.round(size * 0.38);
  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{ width: size, height: size, borderRadius: size / 2, flexShrink: 0, alignItems: 'center', justifyContent: 'center' }, style]}
    >
      <Text style={{ color: '#fff', fontSize, fontWeight: '700', letterSpacing: 0.5 }}>
        {initials(name)}
      </Text>
    </LinearGradient>
  );
}
