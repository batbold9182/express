/**
 * `getNextPageParam` for the app's offset-based lists. The backend pages with `?offset=&limit=` and
 * answers `hasMore`; the next offset is simply how many items we already hold.
 *
 *   getNextPageParam: nextOffset(page => page.items.length)
 *
 * `undefined` tells TanStack Query there is no next page.
 */
export function nextOffset<P extends { hasMore?: boolean }>(
  countOf: (page: P) => number,
): (lastPage: P, allPages: P[]) => number | undefined {
  return (lastPage, allPages) =>
    lastPage.hasMore ? allPages.reduce((n, page) => n + countOf(page), 0) : undefined;
}

type WithId = { _id: string };

/**
 * One list out of an infinite query's pages. Offset paging can repeat an item when something new is
 * inserted between two page fetches, and a repeated key makes React warn and mis-render, so the
 * first occurrence of each `_id` wins.
 */
export function flattenUnique<P, T extends WithId>(pages: P[] | undefined, itemsOf: (page: P) => T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const page of pages ?? []) {
    for (const item of itemsOf(page)) {
      if (seen.has(item._id)) continue;
      seen.add(item._id);
      out.push(item);
    }
  }
  return out;
}

/** The shape TanStack Query stores for an infinite query. */
export type PagedData<P> = { pages: P[]; pageParams: unknown[] };

/**
 * `data` with one item replaced by `patch(item)`, wherever it appears. Same reference back if the item
 * isn't there. Used to update a review in the cached feed in place (a like, a comment, an edit).
 */
export function mapItem<P extends { items: WithId[] }>(
  data: PagedData<P> | undefined,
  id: string,
  patch: (item: P['items'][number]) => P['items'][number],
): PagedData<P> | undefined {
  if (!data || !data.pages.some(p => p.items.some(i => i._id === id))) return data;
  return { ...data, pages: data.pages.map(p => ({ ...p, items: p.items.map(i => (i._id === id ? patch(i) : i)) })) };
}

/**
 * `data` with one item removed from every page — for dropping a deleted review from the cached feed
 * at once. Returns `data` untouched (same reference) if the item isn't there, so nothing re-renders.
 */
export function removeItem<P extends { items: WithId[] }>(data: PagedData<P> | undefined, id: string): PagedData<P> | undefined {
  if (!data || !data.pages.some(p => p.items.some(i => i._id === id))) return data;
  return { ...data, pages: data.pages.map(p => ({ ...p, items: p.items.filter(i => i._id !== id) })) };
}
