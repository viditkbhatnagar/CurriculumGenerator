'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            // Revalidate when the author comes back to the tab. Generation runs
            // for minutes and people switch away while it works; with this off,
            // returning to the tab re-rendered whatever was cached before they
            // left, so a finished regeneration still showed the previous
            // modules and looked as though nothing had happened. staleTime
            // still applies, so flicking between tabs does not refetch.
            refetchOnWindowFocus: true,
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
