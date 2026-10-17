import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { asArray } from './asArray';
import { qk } from './keys';
import { joinSpotifyPages, nextSpotifyOffset, toSpotifyPage, SPOTIFY_PAGE, type SpotifyPage } from './spotifyPaging';

export type Track  = { id: string; name: string; artists: { id?: string; name: string }[]; album: { id: string; images: { url: string }[] } };
export type Album  = { id: string; name: string; artists: { name: string }[]; images: { url: string }[] };
export type Artist = { id: string; name: string; images: { url: string }[]; genres: string[] };
export type UserResult = { _id: string; spotifyId: string; displayName: string; avatarUrl: string; isFollowing: boolean };

/** The first page of each type, as Spotify's paging object (so "Show more" knows where to continue). */
type CatalogResults = {
  tracks:  SpotifyPage<Track>;
  albums:  SpotifyPage<Album>;
  artists: SpotifyPage<Artist>;
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
      const d = await api.get<Record<string, unknown> | null>(`/search?q=${encodeURIComponent(q)}&type=${types}&limit=${SPOTIFY_PAGE}`, signal);
      // Same shape as the API, each paging object normalised (a type not asked for is an empty last page).
      return {
        tracks:  toSpotifyPage<Track>(d?.tracks),
        albums:  toSpotifyPage<Album>(d?.albums),
        artists: toSpotifyPage<Artist>(d?.artists),
      };
    },
    enabled: enabled && q !== '',
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
}

export type SearchType = 'track' | 'album' | 'artist';

/**
 * "Show more" for one type of a catalog search. The first page is the one `useCatalogSearch` already
 * holds; this query starts right after it, fetches that type alone, and stays off until `open` (the
 * user asked for more). `data` joins the first page and every later one, de-duplicated by id —
 * Search's window can shift between calls, so pages may overlap. No total is shown for Search: it is
 * Spotify's estimate.
 */
export function useSearchMore<T extends { id: string }>(type: SearchType, q: string, first: SpotifyPage<T> | undefined, open: boolean) {
  const start = first ? nextSpotifyOffset(first) : undefined;
  return useInfiniteQuery({
    queryKey: qk.searchMore(type, q),
    queryFn: async ({ pageParam, signal }) => toSpotifyPage<T>(
      (await api.get<Record<string, unknown> | null>(
        `/search?q=${encodeURIComponent(q)}&type=${type}&offset=${pageParam}&limit=${SPOTIFY_PAGE}`, signal,
      ))?.[`${type}s`],
    ),
    initialPageParam: start ?? 0,
    getNextPageParam: nextSpotifyOffset,
    select: data => joinSpotifyPages({ pages: first ? [first, ...data.pages] : data.pages }).items,
    enabled: open && start !== undefined && q !== '',
    staleTime: 5 * 60_000,
    retry: false,
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
