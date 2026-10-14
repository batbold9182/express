import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { asArray } from './asArray';
import { qk } from './keys';

export type Track  = { id: string; name: string; artists: { name: string }[]; album: { id: string; images: { url: string }[] } };
export type Album  = { id: string; name: string; artists: { name: string }[]; images: { url: string }[] };
export type Artist = { id: string; name: string; images: { url: string }[]; genres: string[] };
export type UserResult = { _id: string; spotifyId: string; displayName: string; avatarUrl: string; isFollowing: boolean };

export type CatalogResults = {
  tracks?:  { items?: Track[] };
  albums?:  { items?: Album[] };
  artists?: { items?: Artist[] };
};

/**
 * Spotify catalog search. `q` is the already-debounced text, so a key only exists for text the user
 * paused on. While a new term loads, the previous results stay available as placeholder data — the
 * list is replaced when the answer arrives instead of vanishing first. Spotify's catalog barely
 * changes, so a result is trusted for five minutes: re-searching a name is instant.
 */
export function useCatalogSearch(types: string, q: string, enabled: boolean) {
  return useQuery({
    queryKey: qk.search(types, q),
    queryFn: async ({ signal }): Promise<CatalogResults> => {
      const d = await api.get<CatalogResults>(`/search?q=${encodeURIComponent(q)}&type=${types}`, signal);
      // Same shape as the API, with each list guaranteed to be an array.
      return {
        tracks:  { items: asArray<Track>(d?.tracks?.items) },
        albums:  { items: asArray<Album>(d?.albums?.items) },
        artists: { items: asArray<Artist>(d?.artists?.items) },
      };
    },
    enabled: enabled && q !== '',
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
}

/** People search. Carries each user's `isFollowing`, so following someone marks it stale (`afterFollowChange`). */
export function useUserSearch(q: string, enabled: boolean) {
  return useQuery({
    queryKey: qk.userSearch(q),
    queryFn: async ({ signal }) => asArray<UserResult>(await api.get(`/users/search?q=${encodeURIComponent(q)}`, signal)),
    enabled: enabled && q !== '',
    placeholderData: keepPreviousData,
  });
}
