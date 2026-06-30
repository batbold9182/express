export const C = {
  ink950: '#07050D',
  ink900: '#000000',
  ink850: '#121010',
  ink800: '#181227',
  ink700: '#221A35',
  ink300: '#978A74',
  ink200: '#C9BCA6',
  ink100: '#FFFFFF',

  bg:      '#000000',
  fg:      '#FFFFFF',
  fg2:     '#C9BCA6',
  fg3:     '#978A74',
  fg4:     '#5C5142',

  violet:      '#FFFFFF',
  violetDeep:  '#7E22CE',
  pink:        '#E0685C',
  pinkBright:  '#FF6FBA',
  cyan:        '#4FA3D1',
  cyanBright:  '#5BE9FF',
  lime:        '#4B4E53',
  amber:       '#EDA63E',
  red:         '#FFFFFF',

  glass:        'rgba(255,255,255,0.06)',
  glassThin:    'rgba(255,255,255,0.04)',
  glassThick:   'rgba(255,255,255,0.10)',
  stroke:       'rgba(255,255,255,0.08)',
  strokeBright: 'rgba(255,255,255,0.16)',

  spotify: '#1DB954',
  apple:   '#FA243C',
} as const;

export const GRAD = {
  violetPink: ['#FFFFFF', '#E0685C'] as [string, string],
  rotation:   ['#4FA3D1', '#FFFFFF', '#E0685C'] as [string, string, string],
  cyanViolet: ['#4FA3D1', '#FFFFFF'] as [string, string],
};

export const COVER_GRAD: Record<string, [string, string]> = {
  'cyan-drift':     ['#004D5C', '#4FA3D1'],
  'heat-wave':      ['#8B1A00', '#FFFFFF'],
  'lime-pulse':     ['#2D5A00', '#4B4E53'],
  'violet-static':  ['#2D0050', '#FFFFFF'],
  'midnight-orbit': ['#06040C', '#221A35'],
  'pink-noise':     ['#5C0030', '#E0685C'],
  'chrome-rain':    ['#1E1A2E', '#5C5142'],
  'solar-gold':     ['#5C2800', '#EDA63E'],
};

export const AVATAR_COLORS: Record<string, [string, string]> = {
  mira:  ['#5C1A8C', '#FFFFFF'],
  jules: ['#004D5C', '#4FA3D1'],
  kai:   ['#2D5A00', '#4B4E53'],
  sora:  ['#8C0044', '#E0685C'],
  devon: ['#5C2800', '#EDA63E'],
  zain:  ['#004D5C', '#5BE9FF'],
};

export const R = {
  r1: 6, r2: 10, r3: 14, r4: 20, r5: 28, r6: 36, pill: 999,
} as const;

export function scoreColor(s: number | null): string {
  if (s == null)  return C.fg3;
  if (s < 5)      return '#7A5230';
  if (s < 7)      return C.amber;
  if (s < 8.5)    return C.violet;
  return '#E5484D';
}
