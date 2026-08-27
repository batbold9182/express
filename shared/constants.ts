import { C } from './theme';

export const MOOD_LIST: [string, string][] = [
  ['nostalgic', '#B14EFF'], ['hype', '#FF3FA4'],   ['sad', '#00D9FF'],
  ['banger', '#C6FF3D'],    ['grower', '#FFB547'],  ['late night', '#7E22CE'],
  ['driving', '#5BE9FF'],   ['heartbreak', '#FF6FBA'], ['rage', '#FF4D6D'],
  ['chill', '#5BE9FF'],
];

/** Mood name -> accent colour. Derived from MOOD_LIST, which stays the source of truth. */
export const MOOD_COLOR: Record<string, string> = Object.fromEntries(MOOD_LIST.map(([m, c]) => [m, c]));

/**
 * Review type -> pill label + accent colour. Cyan = album, coral = artist, warm grey = track.
 * Reads from `C` rather than repeating hex: the web copy had these hardcoded, which is how the
 * two platforms would have drifted apart at the next recolor.
 */
export const TYPE_CFG: Record<string, { label: string; color: string }> = {
  album:  { label: 'Album',  color: C.cyan },
  artist: { label: 'Artist', color: C.pink },
  track:  { label: 'Track',  color: C.fg3 },
};
