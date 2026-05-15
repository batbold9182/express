import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { C, R } from '../theme';

export function GCard({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
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
});
