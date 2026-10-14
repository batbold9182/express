import { useInfiniteQuery, type InfiniteData, type QueryClient } from '@tanstack/react-query';
import type { FeedItem } from '@tunelog/shared';
import { api } from '../lib/api';
import { asArray } from './asArray';
import { qk } from './keys';
import { mapItem, nextOffset, removeItem } from './pagination';

export type FeedTab = 'foryou' | 'following';
export type FeedPage = { items: FeedItem[]; myId: string; hasMore: boolean };

const ENDPOINT: Record<FeedTab, string> = {
  foryou:    '/reviews/trending',
  following: '/users/feed/me',
};
const PAGE_SIZE = 15;

/**
 * The Home feed — one infinite query per tab. Each page is `?offset=&limit=`; the next offset is the
 * number of items already held, and `hasMore` says whether there is a next page. A tab you have
 * already opened is cached, so switching back is instant. A like or comment elsewhere marks the feed
 * stale without refetching (`afterLikeOrComment`), so coming back refreshes it without the screen
 * jumping.
 */
export function useFeed(tab: FeedTab, opts: { enabled?: boolean } = {}) {
  return useInfiniteQuery({
    queryKey: qk.feed(tab),
    queryFn: async ({ pageParam, signal }): Promise<FeedPage> => {
      const d = await api.get<{ items?: unknown; myId?: string; hasMore?: boolean }>(
        `${ENDPOINT[tab]}?offset=${pageParam}&limit=${PAGE_SIZE}`, signal,
      );
      return { items: asArray<FeedItem>(d?.items), myId: d?.myId ?? '', hasMore: d?.hasMore ?? false };
    },
    initialPageParam: 0,
    getNextPageParam: nextOffset<FeedPage>(page => page.items.length),
    enabled: opts.enabled ?? true,
  });
}

/**
 * Edits one review in every cached feed, in place — the optimistic half of a like, a comment or an
 * edit. The feed cache is the single source of truth for what a card shows, so the UI follows the
 * edit at once with no copy of it in component state. Returns `rollback()`, which puts every cache
 * back exactly as it was: call it if the request fails.
 */
export function patchReviewInFeeds(client: QueryClient, reviewId: string, patch: (review: FeedItem) => FeedItem): () => void {
  const before = client.getQueriesData<InfiniteData<FeedPage>>({ queryKey: qk.feedAll() });
  client.setQueriesData<InfiniteData<FeedPage>>({ queryKey: qk.feedAll() }, old => mapItem(old, reviewId, patch));
  return () => { for (const [key, data] of before) client.setQueryData(key, data); };
}

/** Drops a deleted review from every cached feed so it disappears at once, without waiting for a refetch. */
export function removeReviewFromFeeds(client: QueryClient, reviewId: string) {
  client.setQueriesData<InfiniteData<FeedPage>>({ queryKey: qk.feedAll() }, old => removeItem(old, reviewId));
}
