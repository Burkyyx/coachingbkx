import { QueryClient } from '@tanstack/react-query';

import { isNetworkError } from './errors';

/**
 * Cache des données serveur (TanStack Query).
 * `offlineFirst` : on affiche d'abord ce qui est en cache, puis on rafraîchit.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 24 * 60 * 60 * 1000,
      networkMode: 'offlineFirst',
      retry: (failureCount, error) => !isNetworkError(error) && failureCount < 2,
      refetchOnWindowFocus: true,
    },
    mutations: {
      networkMode: 'offlineFirst',
      retry: false,
    },
  },
});
