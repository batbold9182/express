import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { asArray } from './asArray';
import { invalidate, queryClient } from './client';
import { qk } from './keys';

type NotifEntity = { spotifyTrackId?: string; spotifyAlbumId?: string; spotifyArtistId?: string; type?: string };
export type Notif = {
  _id: string;
  type: 'like' | 'comment' | 'follow' | 'reply';
  read: boolean;
  createdAt: string;
  updatedAt: string;
  actorCount: number;
  actors: { _id: string; displayName: string; avatarUrl?: string; spotifyId: string }[];
  entityId?: NotifEntity;
  entitySnapshot?: NotifEntity & { trackName?: string; albumArt?: string };
};

/** The 50 most recent notifications. Always refetched when the page opens (cached copy shows meanwhile). */
export function useNotifications(enabled: boolean) {
  return useQuery({
    queryKey: qk.notifications(),
    queryFn: async ({ signal }) => asArray<Notif>((await api.get<{ notifications?: unknown }>('/notifications?limit=50', signal))?.notifications),
    enabled,
    staleTime: 0,
  });
}

/**
 * The unread badge. It used to be fetched once per page load, so a notification that arrived while the
 * tab sat open never showed; it now refreshes every minute while the tab is visible.
 */
export function useUnreadCount(enabled: boolean) {
  return useQuery({
    queryKey: qk.unreadCount(),
    queryFn: async ({ signal }) => {
      const n = Number((await api.get<{ count?: number }>('/notifications/unread-count', signal))?.count);
      return Number.isFinite(n) && n > 0 ? n : 0;
    },
    enabled,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}

/**
 * Mark everything read. On success the badge goes to 0 at once. A failure is not worth a toast — the
 * badge is simply re-read from the server so it never claims something that didn't happen.
 */
export function useMarkAllRead() {
  return useMutation({
    mutationFn: () => api.post('/notifications/read-all', {}),
    meta: { silent: true },
    onSuccess: () => { queryClient.setQueryData(qk.unreadCount(), 0); },
    onError: () => { void invalidate([{ key: qk.unreadCount() }]); },
  });
}
