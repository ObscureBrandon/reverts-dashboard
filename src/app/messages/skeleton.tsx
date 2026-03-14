import { NavigationHeader } from '@/app/components/navigation-header';
import { Skeleton } from '@/components/ui/skeleton';

export function MessagesResultsSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="absolute left-0 right-0 top-0 h-0.5 bg-gradient-to-r from-brand-accent-solid/30 via-brand-accent-solid to-brand-accent-solid/30" />

      <div className="divide-y divide-border">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />

                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-2">
                        <Skeleton className="h-5 w-40" />
                        <Skeleton className="h-3 w-24" />
                      </div>

                      <div className="space-y-2 lg:text-right">
                        <Skeleton className="h-4 w-24 lg:ml-auto" />
                        <Skeleton className="h-4 w-36 lg:ml-auto" />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Skeleton className="h-6 w-24 rounded-full" />
                      <Skeleton className="h-6 w-20 rounded-full" />
                      <Skeleton className="h-6 w-28 rounded-full" />
                    </div>

                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-11/12" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Skeleton className="h-6 w-32 rounded-full" />
                      <Skeleton className="h-8 w-32" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-border p-4">
        <Skeleton className="h-4 w-28" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-5 w-14" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
    </div>
  );
}

export default function MessagesPageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <NavigationHeader />

      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="rounded-2xl bg-card/80 py-5 shadow-xs">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-8 w-40" />
            </div>
            <Skeleton className="h-10 w-full max-w-xl" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>

        <div className="mt-6">
          <MessagesResultsSkeleton />
        </div>
      </div>
    </div>
  );
}