import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { asArray } from './asArray';
import { qk } from './keys';

export type LeaderboardItem = {
  type: 'track' | 'album' | 'artist';
  trackName: string;
  artistName: string;
  albumArt?: string;
  spotifyTrackId?: string;
  spotifyAlbumId?: string;
  spotifyArtistId?: string;
  avgScore: number;
  reviewCount: number;
};

/**
 * `GET /reviews/leaderboard` — the ranked list for one `type` ('most-rated' | 'track' | 'album' |
 * 'artist' | 'top-scored'), capped at `limit`. The key includes both, so each filter is cached on its
 * own: switching back to a filter you have already seen is instant, and a request that is no longer
 * wanted is cancelled instead of landing late.
 */
export function useLeaderboard(type: string, limit: number, opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: qk.leaderboard(type, limit),
    queryFn: async ({ signal }) => {
      const d = await api.get<{ items?: unknown }>(`/reviews/leaderboard?type=${type}&limit=${limit}`, signal);
      return asArray<LeaderboardItem>(d?.items);
    },
    enabled: opts.enabled ?? true,
  });
}
