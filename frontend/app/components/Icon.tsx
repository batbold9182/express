import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { C } from '../theme';

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
    case 'heart':        return <Svg viewBox="0 0 24 24" {...wh}><Path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z" {...sp} fill={fill ?? 'none'} /></Svg>;
    case 'comment':      return <Svg viewBox="0 0 24 24" {...wh}><Path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z" {...sp} /></Svg>;
    case 'share':        return <Svg viewBox="0 0 24 24" {...wh}><Path d="M4 12v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8" {...sp} /><Path d="M16 6l-4-4-4 4" {...sp} /><Path d="M12 2v14" {...sp} /></Svg>;
    case 'flame':        return <Svg viewBox="0 0 24 24" {...wh}><Path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3-1-3 0-6 1-9z" {...sp} /></Svg>;
    case 'arrow-left':   return <Svg viewBox="0 0 24 24" {...wh}><Path d="M15 18l-6-6 6-6" {...sp} /></Svg>;
    case 'arrow-right':  return <Svg viewBox="0 0 24 24" {...wh}><Path d="M9 18l6-6-6-6" {...sp} /></Svg>;
    case 'more':         return <Svg viewBox="0 0 24 24" {...wh}><Circle cx="5" cy="12" r="1.6" fill={color} stroke="none" /><Circle cx="12" cy="12" r="1.6" fill={color} stroke="none" /><Circle cx="19" cy="12" r="1.6" fill={color} stroke="none" /></Svg>;
    case 'x':            return <Svg viewBox="0 0 24 24" {...wh}><Path d="M18 6L6 18M6 6l12 12" {...sp} /></Svg>;
    case 'search':       return <Svg viewBox="0 0 24 24" {...wh}><Circle cx="11" cy="11" r="7" {...sp} /><Path d="M20 20l-3.5-3.5" {...sp} /></Svg>;
    case 'settings':     return <Svg viewBox="0 0 24 24" {...wh}><Circle cx="12" cy="12" r="3" {...sp} /><Path d="M19.4 15a1.6 1.6 0 0 0 .3 1.7l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.7-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.7.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.7 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.7l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.7.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.7-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.7V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" {...sp} /></Svg>;
    case 'mic':          return <Svg viewBox="0 0 24 24" {...wh}><Rect x="9" y="3" width="6" height="11" rx="3" {...sp} /><Path d="M5 11a7 7 0 0 0 14 0M12 18v3" {...sp} /></Svg>;
    case 'bookmark':     return <Svg viewBox="0 0 24 24" {...wh}><Path d="M6 3h12a1 1 0 0 1 1 1v18l-7-4-7 4V4a1 1 0 0 1 1-1z" {...sp} /></Svg>;
    case 'star':         return <Svg viewBox="0 0 24 24" {...wh}><Path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8l-6.2 3.2L7 14.2 2 9.3l6.9-1z" {...sp} /></Svg>;
    case 'edit':         return <Svg viewBox="0 0 24 24" {...wh}><Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" {...sp} /><Path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z" {...sp} /></Svg>;
    case 'chevron-up':   return <Svg viewBox="0 0 24 24" {...wh}><Path d="M18 15l-6-6-6 6" {...sp} /></Svg>;
    case 'chevron-down': return <Svg viewBox="0 0 24 24" {...wh}><Path d="M6 9l6 6 6-6" {...sp} /></Svg>;
    case 'list':         return <Svg viewBox="0 0 24 24" {...wh}><Path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" {...sp} /></Svg>;
    case 'activity':     return <Svg viewBox="0 0 24 24" {...wh}><Path d="M22 12h-4l-3 9-6-18-3 9H2" {...sp} /></Svg>;
    case 'plus':         return <Svg viewBox="0 0 24 24" {...wh}><Path d="M12 5v14M5 12h14" {...sp} /></Svg>;
    case 'bell':         return <Svg viewBox="0 0 24 24" {...wh}><Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" {...sp} /><Path d="M13.73 21a2 2 0 0 1-3.46 0" {...sp} /></Svg>;
    case 'user':         return <Svg viewBox="0 0 24 24" {...wh}><Circle cx="12" cy="8" r="4" {...sp} /><Path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" {...sp} /></Svg>;
    case 'wifi-off':     return <Svg viewBox="0 0 24 24" {...wh}><Path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" {...sp} /></Svg>;
    default: return null;
  }
}

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
