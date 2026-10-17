import type { UseInfiniteQueryResult } from '@tanstack/react-query';

type NextPageQuery = Pick<UseInfiniteQueryResult, 'hasNextPage' | 'isFetchingNextPage' | 'isFetchNextPageError' | 'fetchNextPage'>;

/**
 * `onScroll` for a page's scroll container: fetches the query's next page within ~400px of the
 * bottom. A page that failed is not retried from here (that would loop); the list offers a retry.
 */
export function loadMoreNearBottom(q: NextPageQuery) {
  return (e: React.UIEvent<HTMLElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 400 && q.hasNextPage && !q.isFetchingNextPage && !q.isFetchNextPageError) {
      void q.fetchNextPage();
    }
  };
}
