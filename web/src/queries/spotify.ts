import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { qk } from './keys';
import { playableTrack, type NowPlayingData } from './nowPlaying';

/**
 * What the signed-in user is playing, polled every 30 seconds while the tab is visible. The desktop
 * sidebar card and the mobile bar both call this and share one request. An account with no Spotify
 * linked gets `null` (nothing playing); a Spotify error is not retried — the next poll tries again.
 */
export function useNowPlaying() {
  return useQuery({
    queryKey: qk.nowPlaying(),
    queryFn: ({ signal }) => api.get<NowPlayingData | null>('/me/player/currently-playing', signal),
    select: playableTrack,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    retry: false,
    staleTime: 15_000,
  });
}
