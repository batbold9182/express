import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { C, R, COVER_GRAD, AVATAR_COLORS, scoreColor } from './theme';

// ── Score numeral ─────────────────────────────────────────────────────────────
export function Score({ value, size = 'md', glow = true }: {
  value: number; size?: 'sm' | 'md' | 'lg' | 'xl'; glow?: boolean;
}) {
  const color = scoreColor(value);
  const fz = { sm: 16, md: 22, lg: 32, xl: 84 }[size];
  const glowStyle: TextStyle = glow && size === 'xl'
    ? { textShadowColor: color, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 20 }
    : {};
  return (
    <Text style={[s.scoreBase, { color, fontSize: fz }, glowStyle]}>
      {value.toFixed(1)}
      <Text style={[s.denom, { fontSize: Math.max(10, fz! * 0.28) }]}>/10</Text>
    </Text>
  );
}

// ── Album cover (gradient placeholder) ───────────────────────────────────────
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

// ── Avatar (gradient circle) ──────────────────────────────────────────────────
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

// ── Mood pill ─────────────────────────────────────────────────────────────────
export function Mood({ children, color, selected, onPress }: {
  children: string; color?: string; selected?: boolean; onPress?: () => void;
}) {
  const bc = color ?? C.violet;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        s.moodBase,
        { borderColor: selected ? bc : bc + '55', backgroundColor: selected ? bc : C.glassThin },
        selected && { shadowColor: bc, shadowOpacity: 0.55, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
      ]}
    >
      <Text style={[s.moodText, { color: selected ? C.ink900 : bc, fontWeight: selected ? '600' : '500' }]}>
        {children}
      </Text>
    </TouchableOpacity>
  );
}

// ── Eyebrow label ─────────────────────────────────────────────────────────────
export function Eyebrow({ children, color }: { children: string; color?: string }) {
  return <Text style={[s.eyebrow, { color: color ?? C.fg3 }]}>{children}</Text>;
}

// ── Top bar ───────────────────────────────────────────────────────────────────
export function TopBar({ title, leading, trailing, large, pt = 52 }: {
  title?: React.ReactNode; leading?: React.ReactNode; trailing?: React.ReactNode;
  large?: boolean; pt?: number;
}) {
  return (
    <View style={[s.topBar, { paddingTop: pt }]}>
      <View style={{ width: 32 }}>{leading}</View>
      <View style={{ flex: 1, alignItems: 'center' }}>
        {typeof title === 'string'
          ? <Text style={[s.topBarTitle, large && s.topBarLarge]}>{title}</Text>
          : title}
      </View>
      <View style={{ width: 32, alignItems: 'flex-end' }}>{trailing}</View>
    </View>
  );
}

// ── SVG Icon ──────────────────────────────────────────────────────────────────
export function Icon({ name, size = 20, color = C.fg, strokeWidth = 1.75, fill }: {
  name: string; size?: number; color?: string; strokeWidth?: number; fill?: string;
}) {
  const sp = {
    fill: fill ?? 'none',
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const wh = { width: size, height: size };
  switch (name) {
    case 'heart':      return <Svg viewBox="0 0 24 24" {...wh}><Path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z" {...sp} fill={fill ?? 'none'} /></Svg>;
    case 'comment':    return <Svg viewBox="0 0 24 24" {...wh}><Path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z" {...sp} /></Svg>;
    case 'share':      return <Svg viewBox="0 0 24 24" {...wh}><Path d="M4 12v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8" {...sp} /><Path d="M16 6l-4-4-4 4" {...sp} /><Path d="M12 2v14" {...sp} /></Svg>;
    case 'flame':      return <Svg viewBox="0 0 24 24" {...wh}><Path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3-1-3 0-6 1-9z" {...sp} /></Svg>;
    case 'arrow-left': return <Svg viewBox="0 0 24 24" {...wh}><Path d="M15 18l-6-6 6-6" {...sp} /></Svg>;
    case 'more':       return <Svg viewBox="0 0 24 24" {...wh}><Circle cx="5" cy="12" r="1.6" fill={color} stroke="none" /><Circle cx="12" cy="12" r="1.6" fill={color} stroke="none" /><Circle cx="19" cy="12" r="1.6" fill={color} stroke="none" /></Svg>;
    case 'x':          return <Svg viewBox="0 0 24 24" {...wh}><Path d="M18 6L6 18M6 6l12 12" {...sp} /></Svg>;
    case 'search':     return <Svg viewBox="0 0 24 24" {...wh}><Circle cx="11" cy="11" r="7" {...sp} /><Path d="M20 20l-3.5-3.5" {...sp} /></Svg>;
    case 'settings':   return <Svg viewBox="0 0 24 24" {...wh}><Circle cx="12" cy="12" r="3" {...sp} /><Path d="M19.4 15a1.6 1.6 0 0 0 .3 1.7l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.7-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.7.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.7 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.7l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.7.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.7-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.7V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" {...sp} /></Svg>;
    case 'mic':        return <Svg viewBox="0 0 24 24" {...wh}><Rect x="9" y="3" width="6" height="11" rx="3" {...sp} /><Path d="M5 11a7 7 0 0 0 14 0M12 18v3" {...sp} /></Svg>;
    case 'bookmark':   return <Svg viewBox="0 0 24 24" {...wh}><Path d="M6 3h12a1 1 0 0 1 1 1v18l-7-4-7 4V4a1 1 0 0 1 1-1z" {...sp} /></Svg>;
    default: return null;
  }
}

// ── Nav icon (bottom tab bar) ─────────────────────────────────────────────────
export function NavIcon({ name, color = C.fg }: { name: string; color?: string }) {
  const sp = { fill: 'none' as const, stroke: color, strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const wh = { width: 22, height: 22 };
  if (name === 'home')     return <Svg viewBox="0 0 24 24" {...wh}><Path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" {...sp} /></Svg>;
  if (name === 'search')   return <Svg viewBox="0 0 24 24" {...wh}><Circle cx="11" cy="11" r="7" {...sp} /><Path d="M20 20l-3.5-3.5" {...sp} /></Svg>;
  if (name === 'activity') return <Svg viewBox="0 0 24 24" {...wh}><Path d="M22 12h-4l-3 9-6-18-3 9H2" {...sp} /></Svg>;
  if (name === 'user')     return <Svg viewBox="0 0 24 24" {...wh}><Circle cx="12" cy="8" r="4" {...sp} /><Path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" {...sp} /></Svg>;
  if (name === 'plus')     return <Svg viewBox="0 0 24 24" {...wh}><Path d="M12 5v14M5 12h14" {...sp} /></Svg>;
  return null;
}

// ── Action row ────────────────────────────────────────────────────────────────
export function ActionRow({ likes, comments, liked, onLike, time }: {
  likes: number; comments: number; liked: boolean; onLike?: () => void; time?: string;
}) {
  return (
    <View style={s.actionRow}>
      <TouchableOpacity onPress={onLike} activeOpacity={0.7} style={s.actionBtn}>
        <Icon name="heart" fill={liked ? C.pink : 'none'} color={liked ? C.pink : C.fg2} size={18} />
        <Text style={[s.actionCount, { color: liked ? C.pink : C.fg2 }]}>{likes}</Text>
      </TouchableOpacity>
      <TouchableOpacity activeOpacity={0.7} style={s.actionBtn}>
        <Icon name="comment" size={18} color={C.fg2} />
        <Text style={[s.actionCount, { color: C.fg2 }]}>{comments}</Text>
      </TouchableOpacity>
      <TouchableOpacity activeOpacity={0.7} style={s.actionBtn}>
        <Icon name="share" size={18} color={C.fg2} />
      </TouchableOpacity>
      {time && <Text style={s.actionTime}>{time}</Text>}
    </View>
  );
}

// ── Streaming badge ───────────────────────────────────────────────────────────
export function StreamingBadge({ platform = 'spotify' }: { platform?: 'spotify' | 'apple' | 'rotation' }) {
  const cfg = {
    spotify:  { c: C.spotify, label: 'Play on Spotify' },
    apple:    { c: C.apple,   label: 'Apple Music' },
    rotation: { c: C.pink,    label: 'In your rotation' },
  }[platform];
  return (
    <View style={[s.badge, { backgroundColor: cfg.c + '1f', borderColor: cfg.c + '55' }]}>
      <View style={[s.badgeDot, { backgroundColor: cfg.c }]} />
      <Text style={[s.badgeText, { color: cfg.c }]}>{cfg.label}</Text>
    </View>
  );
}

// ── Glass card ────────────────────────────────────────────────────────────────
export function GCard({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.gcard, style]}>{children}</View>;
}

// ── Primary button (gradient) ─────────────────────────────────────────────────
export function BtnPrimary({ children, onPress, style }: {
  children: string; onPress?: () => void; style?: ViewStyle;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[{ borderRadius: R.pill }, style]}>
      <LinearGradient colors={['#B14EFF', '#FF3FA4']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.btnPrimary}>
        <Text style={s.btnPrimaryTxt}>{children}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ── Glass button ──────────────────────────────────────────────────────────────
export function BtnGlass({ children, onPress, style }: {
  children: string; onPress?: () => void; style?: ViewStyle;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={[s.btnGlass, style]}>
      <Text style={s.btnGlassTxt}>{children}</Text>
    </TouchableOpacity>
  );
}

// ── Mood tag (read-only chip) ─────────────────────────────────────────────────
export function MoodTag({ label }: { label: string }) {
  return (
    <View style={s.moodTag}>
      <Text style={s.moodTagTxt}>{label}</Text>
    </View>
  );
}

// ── StyleSheet ────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  scoreBase: { fontWeight: '600', letterSpacing: -0.5, lineHeight: undefined },
  denom:     { color: C.fg3, fontWeight: '500', letterSpacing: 0 },

  moodBase: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: R.pill, borderWidth: 1 },
  moodText: { fontSize: 12 },

  eyebrow: { fontSize: 10, fontWeight: '500', letterSpacing: 1.4, textTransform: 'uppercase', color: C.fg3 },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 12, paddingHorizontal: 16,
    backgroundColor: 'rgba(11,8,22,0.80)',
    borderBottomWidth: 1, borderBottomColor: C.stroke,
  },
  topBarTitle: { fontSize: 16, fontWeight: '700', color: C.fg, textAlign: 'center' },
  topBarLarge: { fontSize: 22, fontWeight: '600', letterSpacing: -0.5 },

  actionRow:   { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 4 },
  actionBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionCount: { fontSize: 13, fontWeight: '600' },
  actionTime:  { marginLeft: 'auto', fontSize: 10, color: C.fg3 },

  badge:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 10, borderRadius: R.pill, borderWidth: 1 },
  badgeDot:  { width: 7, height: 7, borderRadius: 4 },
  badgeText: { fontSize: 11, fontWeight: '500' },

  gcard: { backgroundColor: C.glass, borderWidth: 1, borderColor: C.stroke, borderRadius: R.r4 },

  btnPrimary: {
    paddingVertical: 12, paddingHorizontal: 22, borderRadius: R.pill,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.violet, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 8,
  },
  btnPrimaryTxt: { color: C.ink900, fontSize: 14, fontWeight: '600' },

  btnGlass: {
    paddingVertical: 12, paddingHorizontal: 22, borderRadius: R.pill,
    backgroundColor: C.glass, borderWidth: 1, borderColor: C.strokeBright,
    alignItems: 'center', justifyContent: 'center',
  },
  btnGlassTxt: { color: C.fg, fontSize: 14, fontWeight: '600' },

  moodTag:    { paddingVertical: 3, paddingHorizontal: 8, borderRadius: R.pill, backgroundColor: C.glassThin, borderWidth: 1, borderColor: C.stroke },
  moodTagTxt: { fontSize: 10, fontWeight: '500', color: C.fg3 },
});
