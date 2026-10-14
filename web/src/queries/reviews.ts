import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { asArray } from './asArray';
import { qk } from './keys';
import type { ReviewIdRef } from './reviewedIds';

/**
 * `GET /reviews/mine` — the caller's own reviews, and the single source for every "Reviewed" /
 * "Already reviewed" badge. Search, Song, Album and Artist used to fetch it separately on every
 * visit; one key means one shared request. Posting, editing or deleting a review invalidates it
 * (`afterReviewChange`), so a badge never lags behind what you just did.
 */
export function useMyReviews() {
  return useQuery({
    queryKey: qk.myReviews(),
    queryFn: async ({ signal }) => asArray<ReviewIdRef>(await api.get('/reviews/mine', signal)),
    staleTime: 60_000,
  });
}
