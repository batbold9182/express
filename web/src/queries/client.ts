import { MutationCache, QueryClient } from '@tanstack/react-query';
import { mutationMessage, type ApiError } from '../lib/errors';
import { toast } from '../lib/toast';
import { shouldRetry } from './retry';
import { toFilters, type Invalidation } from './invalidation';

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: {
      /** The component shows this mutation's error itself (a form, an inline message) — no toast. */
      inline?: boolean;
      /** Failure is expected or harmless — show nothing. */
      silent?: boolean;
    };
  }
}

export { mutationMessage };

/**
 * The one QueryClient. A module singleton (not created in a component) so `AuthProvider` can wipe it
 * on logout, and so a mutation can raise a toast with no component in scope.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetry,
      // Off: Render cold-starts and Spotify's 429 on the discography call make a focus-triggered
      // refetch costly. Unread count and now-playing refresh on an interval instead.
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
    mutations: { retry: false },
  },
  // Every mutation that fails shows a toast, unless it opts out with `meta`. This is what ends the
  // app's silent failures: a new mutation is visible by default.
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.meta?.inline || mutation.meta?.silent) return;
      if ((error as ApiError)?.status === 401) return; // the api layer is already sending them to /login
      toast(mutationMessage(error));
    },
  }),
});

/** Applies an invalidation map from `invalidation.ts`. */
export function invalidate(list: Invalidation[]) {
  return Promise.all(toFilters(list).map(f => queryClient.invalidateQueries(f)));
}

// Dev only (stripped from the production build): lets the browser console, and the checks run
// against it, inspect the cache and raise a toast.
if (import.meta.env.DEV) Object.assign(window, { __dev: { queryClient, toast } });
