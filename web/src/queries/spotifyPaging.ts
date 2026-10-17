import { asArray } from './asArray';
import { flattenUniqueBy } from './pagination';

/**
 * Paging over Spotify's own paging object, which the proxy routes pass through unchanged
 * (`/artists/:id/albums`, and each type in `/search`). Pure — no React, no `import.meta` — so the
 * root Jest suite can load it.
 *
 * Spotify's rules this follows (plan.md, step 2b):
 *  - the next offset is `offset + items.length`, not `offset + limit`: Search can return a short page;
 *  - there is a next page only while Spotify gives a `next` link, the last page was not empty, and
 *    the next offset stays within Spotify's offset cap of 1000;
 *  - `total` is for display only ("10 of 54"); Search's total is an estimate, so it is not shown there;
 *  - Search's result window can shift between calls, so pages may overlap: items are de-duplicated
 *    by `id` when the pages are joined.
 */

export const SPOTIFY_MAX_OFFSET = 1000;

/** Spotify's largest page (decision D6); the backend clamps `limit` to 1-10. */
export const SPOTIFY_PAGE = 10;

/** Spotify's paging object, normalised: `items` is always an array, the numbers are always numbers. */
export type SpotifyPage<T> = { items: T[]; total: number; limit: number; offset: number; next: string | null };

/** Reads a Spotify paging object defensively (a missing or malformed one becomes an empty last page). */
export function toSpotifyPage<T>(raw: unknown): SpotifyPage<T> {
  const r = (raw ?? {}) as Partial<Record<keyof SpotifyPage<T>, unknown>>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const items = asArray<T>(r.items);
  return {
    items,
    total: num(r.total) || items.length,
    limit: num(r.limit),
    offset: num(r.offset),
    next: typeof r.next === 'string' ? r.next : null,
  };
}

/** The offset of the page after `page`, or `undefined` when there is none (TanStack Query's "no next page"). */
export function nextSpotifyOffset(page: SpotifyPage<unknown>): number | undefined {
  const next = page.offset + page.items.length;
  return page.next != null && page.items.length > 0 && next <= SPOTIFY_MAX_OFFSET ? next : undefined;
}

/** What a paged Spotify list renders: every loaded item once, and the total Spotify reports. */
export type SpotifyList<T> = { items: T[]; total: number };

/** Joins loaded pages into one list, first copy of each `id` wins. Use it as the query's `select`. */
export function joinSpotifyPages<T extends { id: string }>(data: { pages: SpotifyPage<T>[] }): SpotifyList<T> {
  return {
    items: flattenUniqueBy(data.pages, page => page.items, item => item.id),
    total: data.pages[0]?.total ?? 0,
  };
}

/**
 * The paging half of a `useInfiniteQuery` over a Spotify list; spread it next to `queryKey` and a
 * `queryFn` that fetches `offset = pageParam` and returns `toSpotifyPage(...)`. Pages are fetched on
 * a "Show more" click (`ShowMore`), never on scroll.
 */
export const spotifyPaging = {
  initialPageParam: 0,
  getNextPageParam: nextSpotifyOffset,
} as const;
