'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { Suspense, useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Align with HTTP cache headers - consider data fresh for 30s
            staleTime: 30 * 1000, // 30 seconds
            // Keep inactive data in cache for 10 minutes (longer than stale-while-revalidate)
            gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
            // Enable refetch on window focus for real-time updates
            refetchOnWindowFocus: true,
            // Only retry failed requests once
            retry: 1,
            // Exponential backoff for retries
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
            // Don't refetch on component mount if data is fresh
            refetchOnMount: false,
            // Enable network mode to handle offline scenarios
            networkMode: 'online',
          },
          mutations: {
            // Retry mutations once on failure
            retry: 1,
            // Use network-first approach for mutations
            networkMode: 'online',
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={null}>
        <NuqsAdapter>
          {children}
        </NuqsAdapter>
      </Suspense>
      {/* Only show devtools in development */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
