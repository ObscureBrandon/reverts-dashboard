'use client';

import { GlobalUserPanel } from '@/app/components/global-user-panel';
import { UserPanelProvider, useUserPanel } from '@/lib/contexts/user-panel-context';
import { cn } from '@/lib/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { Suspense, useState } from 'react';

/**
 * Wrapper component that applies margin when global panel is open.
 * This creates the "push" layout effect where content moves aside for the panel.
 * 
 * Note: Users page has its own panel state/margin - this wrapper only applies
 * when the GLOBAL panel is open from other pages (tickets, messages, etc.)
 */
function PageContentWrapper({ children }: { children: React.ReactNode }) {
  const { panelState } = useUserPanel();
  
  return (
    <div 
      className={cn(
        "transition-[margin] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
        panelState.isOpen && "lg:mr-[420px]"
      )}
    >
      {children}
    </div>
  );
}

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
          <UserPanelProvider>
            <PageContentWrapper>
              {children}
            </PageContentWrapper>
            <GlobalUserPanel />
          </UserPanelProvider>
        </NuqsAdapter>
      </Suspense>
      {/* Only show devtools in development */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
