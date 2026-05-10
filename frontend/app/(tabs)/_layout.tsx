import { Tabs } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { NavIcon } from '../components';
import { C, R } from '../theme';

const TAB_ORDER = ['index', 'search', 'rate', 'feed/index', 'me'];

const TAB_ITEMS: Record<string, { label: string; icon: string; special?: boolean }> = {
  index:        { label: 'Home',    icon: 'home' },
  search:       { label: 'Search',  icon: 'search' },
  rate:         { label: 'Rate',    icon: 'plus', special: true },
  'feed/index': { label: 'Feed',    icon: 'activity' },
  me:           { label: 'Profile', icon: 'user' },
};

function RotationTabBar({ state, navigation }: BottomTabBarProps) {
  return (
    <View style={s.bar}>
      {[...state.routes].sort((a, b) => TAB_ORDER.indexOf(a.name) - TAB_ORDER.indexOf(b.name)).map((route) => {
        const item = TAB_ITEMS[route.name];
        const originalIndex = state.routes.findIndex(r => r.key === route.key);
        const active = state.index === originalIndex;
        const color = active ? C.violet : C.fg3;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!active && !event.defaultPrevented) navigation.navigate(route.name);
        };

        return (
          <TouchableOpacity key={route.key} onPress={onPress} activeOpacity={0.7} style={s.item}>
            {item?.special ? (
              <LinearGradient
                colors={['#B14EFF', '#FF3FA4']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.rateBtn}
              >
                <Text style={s.ratePlus}>+</Text>
              </LinearGradient>
            ) : (
              <NavIcon name={item?.icon ?? 'home'} color={color} />
            )}
            <Text style={[s.label, { color }]}>{item?.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs tabBar={props => <RotationTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="rate" />
      <Tabs.Screen name="feed/index" />
      <Tabs.Screen name="me" />
    </Tabs>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 32,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(11,8,22,0.92)',
    borderTopWidth: 1,
    borderTopColor: C.stroke,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  rateBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -8,
    shadowColor: C.violet,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 6,
  },
  ratePlus: { color: C.ink900, fontWeight: '700', fontSize: 22, lineHeight: 24 },
  label: { fontSize: 9, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },
});
