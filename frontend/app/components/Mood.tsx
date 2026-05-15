import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { C, R } from '../theme';

export function Mood({ children, color, selected, onPress }: {
  children: string; color?: string; selected?: boolean; onPress?: () => void;
}) {
  const bc = color ?? C.violet;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        s.base,
        { borderColor: selected ? bc : bc + '55', backgroundColor: selected ? bc : C.glassThin },
        selected && { shadowColor: bc, shadowOpacity: 0.55, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
      ]}
    >
      <Text style={[s.text, { color: selected ? C.ink900 : bc, fontWeight: selected ? '600' : '500' }]}>
        {children}
      </Text>
    </TouchableOpacity>
  );
}

export function MoodTag({ label }: { label: string }) {
  return (
    <View style={s.tag}>
      <Text style={s.tagTxt}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  base:   { paddingVertical: 6, paddingHorizontal: 14, borderRadius: R.pill, borderWidth: 1 },
  text:   { fontSize: 12 },
  tag:    { paddingVertical: 3, paddingHorizontal: 8, borderRadius: R.pill, backgroundColor: C.glassThin, borderWidth: 1, borderColor: C.stroke },
  tagTxt: { fontSize: 11, fontWeight: '500', color: C.fg3 },
});
