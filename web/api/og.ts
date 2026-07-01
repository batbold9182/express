import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

// Server env var — Vercel exposes all env vars (incl. VITE_-prefixed) to functions.
const API_BASE = process.env.VITE_API_BASE || '';

type Review = {
  type?: 'track' | 'album' | 'artist';
  trackName: string;
  artistName: string;
  albumArt?: string;
  score: number;
  text?: string;
  moods?: string[];
  userId?: { displayName?: string; spotifyId?: string };
};

const TYPE_COLOR: Record<string, string> = { album: '#4FA3D1', artist: '#E0685C', track: '#978A74' };

function scoreColor(s: number): string {
  if (s < 5)   return '#7A5230';
  if (s < 7)   return '#EDA63E';
  if (s < 8.5) return '#FFFFFF';
  return '#E5484D';
}

function hexToRgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function clamp(str: string, n: number): string {
  const s = (str || '').trim();
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
}

// Minimal Satori VDOM helper (avoids JSX/build config in the functions dir).
function h(type: string, style: Record<string, unknown>, ...children: unknown[]): unknown {
  return { type, props: { style, children: children.length <= 1 ? children[0] : children } };
}
function img(src: string, size: number, radius: number): unknown {
  return { type: 'img', props: { src, width: size, height: size, style: { width: size, height: size, borderRadius: radius, objectFit: 'cover' } } };
}

function moodChip(m: string, fontSize: number): unknown {
  return h('div', {
    display: 'flex', fontSize, color: '#C9BCA6', fontWeight: 600,
    padding: `${Math.round(fontSize * 0.35)}px ${Math.round(fontSize * 0.7)}px`,
    borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.10)',
  }, m);
}

function fallback(width: number, height: number): ImageResponse {
  return new ImageResponse(
    h('div', {
      width, height, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#000000', color: '#FFFFFF', fontSize: 96, fontWeight: 700, letterSpacing: -2,
    }, 'express') as never,
    { width, height },
  );
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const id = url.searchParams.get('id') || '';
  const story = url.searchParams.get('format') === 'story';
  const width  = story ? 1080 : 1200;
  const height = story ? 1920 : 630;

  let review: Review | null = null;
  try {
    const res = await fetch(`${API_BASE}/reviews/${id}`);
    if (res.ok) review = (await res.json()) as Review;
  } catch { /* ignore — render fallback */ }

  if (!review) return fallback(width, height);

  const accent = TYPE_COLOR[review.type ?? 'track'] ?? '#978A74';
  const sc = scoreColor(review.score);
  const handle = review.userId?.displayName ? `@${review.userId.displayName}` : 'on express';
  const cover = review.albumArt || '';
  // Satori renders gradients via backgroundImage (not the `background` shorthand).
  const bgImage = `linear-gradient(160deg, #07060b 28%, ${hexToRgba(accent, 0.38)} 100%)`;

  const scoreBlock = h('div', { display: 'flex', alignItems: 'flex-end', gap: story ? 24 : 14 },
    h('div', { display: 'flex', fontSize: story ? 104 : 74, fontWeight: 800, color: sc, lineHeight: 1 }, review.score.toFixed(1)),
    h('div', { display: 'flex', fontSize: story ? 40 : 28, fontWeight: 700, color: '#5C5142', paddingBottom: story ? 14 : 8 }, '/10'),
  );

  const moods = (review.moods ?? []).slice(0, 3);
  const moodRow = moods.length
    ? h('div', { display: 'flex', gap: story ? 14 : 10 }, ...moods.map(m => moodChip(m, story ? 34 : 24)))
    : h('div', { display: 'flex' });

  const footer = h('div', { display: 'flex', alignItems: 'center', width: '100%', marginTop: story ? 12 : 6 },
    h('div', { display: 'flex', flex: 1, fontSize: story ? 36 : 26, color: '#978A74', fontWeight: 600 }, clamp(handle, 28)),
    h('div', { display: 'flex', fontSize: story ? 44 : 30, fontWeight: 800, color: '#FFFFFF', letterSpacing: -1 }, 'express'),
  );

  let element: unknown;

  if (story) {
    element = h('div', {
      width, height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      backgroundColor: '#07060b', backgroundImage: bgImage, padding: 72, fontFamily: 'sans-serif',
    },
      h('div', {
        display: 'flex', flexDirection: 'column', width: 936, gap: 28,
        backgroundColor: 'rgba(18,16,16,0.78)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 56, padding: 64,
      },
        cover ? img(cover, 808, 36) : h('div', { display: 'flex', width: 808, height: 808, borderRadius: 36, background: 'rgba(255,255,255,0.06)' }),
        h('div', { display: 'flex', fontSize: 76, fontWeight: 800, color: '#FFFFFF', marginTop: 24, lineHeight: 1.05 }, clamp(review.trackName, 40)),
        h('div', { display: 'flex', fontSize: 46, color: '#C9BCA6' }, clamp(review.artistName, 44)),
        h('div', { display: 'flex', alignItems: 'center', gap: 32, marginTop: 8 }, scoreBlock, moodRow),
        review.text ? h('div', { display: 'flex', fontSize: 42, color: '#E7DECB', lineHeight: 1.4, marginTop: 8 }, `"${clamp(review.text, 170)}"`) : h('div', { display: 'flex' }),
        footer,
      ),
    );
  } else {
    element = h('div', {
      width, height, display: 'flex', flexDirection: 'row', alignItems: 'center',
      backgroundColor: '#07060b', backgroundImage: bgImage, padding: 64, gap: 56, fontFamily: 'sans-serif',
    },
      cover ? img(cover, 500, 28) : h('div', { display: 'flex', width: 500, height: 500, borderRadius: 28, background: 'rgba(255,255,255,0.06)' }),
      h('div', { display: 'flex', flexDirection: 'column', flex: 1, gap: 18 },
        h('div', { display: 'flex', fontSize: 62, fontWeight: 800, color: '#FFFFFF', lineHeight: 1.05 }, clamp(review.trackName, 34)),
        h('div', { display: 'flex', fontSize: 36, color: '#C9BCA6' }, clamp(review.artistName, 38)),
        h('div', { display: 'flex', alignItems: 'center', gap: 24, marginTop: 6 }, scoreBlock, moodRow),
        review.text ? h('div', { display: 'flex', fontSize: 30, color: '#E7DECB', lineHeight: 1.35 }, `"${clamp(review.text, 120)}"`) : h('div', { display: 'flex' }),
        footer,
      ),
    );
  }

  return new ImageResponse(element as never, {
    width,
    height,
    headers: { 'cache-control': 'public, max-age=86400, s-maxage=86400' },
  });
}
