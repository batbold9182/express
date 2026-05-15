import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { AVATAR_COLORS } from '../theme';

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const colors = AVATAR_COLORS[name] ?? ['#3D3358', '#0B0816'];
  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size / 2, flexShrink: 0 }}
    />
  );
}
