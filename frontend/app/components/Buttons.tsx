import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, R } from '../theme';

export function BtnPrimary({ children, onPress, style }: {
  children: string; onPress?: () => void; style?: ViewStyle;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[{ borderRadius: R.pill }, style]}>
      <LinearGradient colors={['#B14EFF', '#FF3FA4']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.primary}>
        <Text style={s.primaryTxt}>{children}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

export function BtnGlass({ children, onPress, style }: {
  children: string; onPress?: () => void; style?: ViewStyle;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={[s.glass, style]}>
      <Text style={s.glassTxt}>{children}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  primary: {
    paddingVertical: 12, paddingHorizontal: 22, borderRadius: R.pill,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.violet, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 8,
  },
  primaryTxt: { color: C.ink900, fontSize: 14, fontWeight: '600' },

  glass: {
    paddingVertical: 12, paddingHorizontal: 22, borderRadius: R.pill,
    backgroundColor: C.glass, borderWidth: 1, borderColor: C.strokeBright,
    alignItems: 'center', justifyContent: 'center',
  },
  glassTxt: { color: C.fg, fontSize: 14, fontWeight: '600' },
});
