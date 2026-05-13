type Entry = { data: unknown; expiresAt: number };
const store = new Map<string, Entry>();

export function cacheGet(key: string): unknown | null {
  const e = store.get(key);
  if (!e) return null;
  if (Date.now() > e.expiresAt) { store.delete(key); return null; }
  return e.data;
}

export function cacheSet(key: string, data: unknown, ttlMs: number): void {
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export const TTL = {
  DAY:  24 * 60 * 60 * 1000,
  SIX_HOURS: 6 * 60 * 60 * 1000,
} as const;
