import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { qk } from './keys';

export type PublicReview = {
  _id: string;
  type?: 'track' | 'album' | 'artist';
  spotifyTrackId?: string;
  spotifyAlbumId?: string;
  spotifyArtistId?: string;
  trackName: string;
  artistName: string;
  albumArt?: string;
  score: number;
  text?: string;
  moods?: string[];
  userId?: { displayName?: string; avatarUrl?: string };
};

/** One review for the public `/r/:id` page. Works signed out — the endpoint needs no auth. */
export function useSharedReview(id: string | undefined) {
  return useQuery({
    queryKey: qk.sharedReview(id ?? ''),
    queryFn: ({ signal }) => api.get<PublicReview>(`/reviews/${id}`, signal),
    enabled: !!id,
    staleTime: 60_000,
  });
}
