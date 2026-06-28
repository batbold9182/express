export const C = {
  ink950: '#07050D',
  ink900: '#0B0816',
  ink850: '#110D1F',
  ink800: '#181227',
  ink700: '#221A35',
  ink300: '#8A7FAC',
  ink200: '#B4ADCF',
  ink100: '#E6E2F2',

  bg:      '#0B0816',
  fg:      '#E6E2F2',
  fg2:     '#B4ADCF',
  fg3:     '#8A7FAC',
  fg4:     '#5A4F78',

  violet:      '#B14EFF',
  violetDeep:  '#7E22CE',
  pink:        '#FF3FA4',
  pinkBright:  '#FF6FBA',
  cyan:        '#00D9FF',
  cyanBright:  '#5BE9FF',
  lime:        '#C6FF3D',
  amber:       '#FFB547',
  red:         '#FF4D6D',

  glass:        'rgba(255,255,255,0.06)',
  glassThin:    'rgba(255,255,255,0.04)',
  glassThick:   'rgba(255,255,255,0.10)',
  stroke:       'rgba(255,255,255,0.08)',
  strokeBright: 'rgba(255,255,255,0.16)',

  spotify: '#1DB954',
  apple:   '#FA243C',
} as const;

export const GRAD = {
  violetPink: ['#B14EFF', '#FF3FA4'] as [string, string],
  rotation:   ['#00D9FF', '#B14EFF', '#FF3FA4'] as [string, string, string],
  cyanViolet: ['#00D9FF', '#B14EFF'] as [string, string],
};

export const COVER_GRAD: Record<string, [string, string]> = {
  'cyan-drift':     ['#004D5C', '#00D9FF'],
  'heat-wave':      ['#8B1A00', '#FF4D6D'],
  'lime-pulse':     ['#2D5A00', '#C6FF3D'],
  'violet-static':  ['#2D0050', '#B14EFF'],
  'midnight-orbit': ['#06040C', '#221A35'],
  'pink-noise':     ['#5C0030', '#FF3FA4'],
  'chrome-rain':    ['#1E1A2E', '#5A4F78'],
  'solar-gold':     ['#5C2800', '#FFB547'],
};

export const AVATAR_COLORS: Record<string, [string, string]> = {
  mira:  ['#5C1A8C', '#B14EFF'],
  jules: ['#004D5C', '#00D9FF'],
  kai:   ['#2D5A00', '#C6FF3D'],
  sora:  ['#8C0044', '#FF3FA4'],
  devon: ['#5C2800', '#FFB547'],
  zain:  ['#004D5C', '#5BE9FF'],
};

export const R = {
  r1: 6, r2: 10, r3: 14, r4: 20, r5: 28, r6: 36, pill: 999,
} as const;

export function scoreColor(s: number | null): string {
  if (s == null)  return C.fg3;
  if (s < 5)      return C.red;
  if (s < 7)      return C.amber;
  if (s < 8.5)    return C.violet;
  return C.lime;
}
