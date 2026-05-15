import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C } from '../theme';

export function TopBar({ title, leading, trailing, large, pt = 52 }: {
  title?: React.ReactNode; leading?: React.ReactNode; trailing?: React.ReactNode;
  large?: boolean; pt?: number;
}) {
  return (
    <View style={[s.bar, { paddingTop: pt }]}>
      <View style={{ width: 32 }}>{leading}</View>
      <View style={{ flex: 1, alignItems: 'center' }}>
        {typeof title === 'string'
          ? <Text style={[s.title, large && s.titleLarge]}>{title}</Text>
          : title}
      </View>
      <View style={{ width: 32, alignItems: 'flex-end' }}>{trailing}</View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 12, paddingHorizontal: 16,
    backgroundColor: 'rgba(11,8,22,0.80)',
    borderBottomWidth: 1, borderBottomColor: C.stroke,
  },
  title:      { fontSize: 16, fontWeight: '700', color: C.fg, textAlign: 'center' },
  titleLarge: { fontSize: 22, fontWeight: '600', letterSpacing: -0.5 },
});
