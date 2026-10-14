import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { asArray } from './asArray';
import { qk } from './keys';

export type SuggestedUser = {
  _id: string;
  spotifyId: string;
  displayName: string;
  avatarUrl?: string;
  followerCount: number;
};

/**
 * `GET /users/suggested` — "Who to follow". Following someone invalidates it (`afterFollowChange`),
 * so a cached list never keeps offering someone you already follow.
 */
export function useSuggestedUsers(limit: number) {
  return useQuery({
    queryKey: qk.suggestedUsersList(limit),
    queryFn: async ({ signal }) => asArray<SuggestedUser>(await api.get(`/users/suggested?limit=${limit}`, signal)),
  });
}
