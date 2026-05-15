import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { C, COVER_GRAD } from '../theme';

export function Cover({ name, size = 80, radius }: {
  name: string; size?: number; radius?: number;
}) {
  const r = radius ?? Math.max(8, Math.round(size * 0.16));
  const colors = COVER_GRAD[name] ?? ['#221A35', '#0B0816'];
  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: r, borderWidth: 1, borderColor: C.stroke, flexShrink: 0 }}
    />
  );
}
