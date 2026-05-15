import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, ViewStyle, Animated } from 'react-native';
import { C, R } from '../theme';

export function GCard({ children, style, accentColor, glowColor }: {
  children: React.ReactNode;
  style?: ViewStyle;
  accentColor?: string;
  glowColor?: string;
}) {
  const opacity = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    if (!glowColor) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.25, duration: 1000, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [glowColor]);

  if (glowColor) {
    return (
      <View style={s.wrapper}>
        <Animated.View style={[s.glowRing, { opacity }]} pointerEvents="none" />
        <View style={[s.card, accentColor && { borderLeftWidth: 3, borderLeftColor: accentColor }, style]}>
          {children}
        </View>
      </View>
    );
  }

  return (
    <View style={[
      s.card,
      accentColor && { borderLeftWidth: 3, borderLeftColor: accentColor },
      style,
    ]}>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: C.glass,
    borderWidth: 1,
    borderColor: C.strokeBright,
    borderRadius: R.r4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  wrapper: {},
  glowRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: R.r4,
    borderWidth: 1.5,
    borderColor: '#C6FF3D',
    shadowColor: '#C6FF3D',
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
});
