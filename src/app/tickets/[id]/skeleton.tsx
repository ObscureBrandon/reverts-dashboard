import { NavigationHeader } from '@/app/components/navigation-header';
import { Skeleton } from '@/components/ui/skeleton';

export default function TicketDetailSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <NavigationHeader />

      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="rounded-2xl bg-card/80 py-5 shadow-xs">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-28" />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-6">
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="px-6 py-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:flex xl:flex-nowrap xl:items-stretch xl:overflow-hidden">
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 xl:w-[220px] xl:shrink-0">
                  <Skeleton className="h-3 w-20" />
                  <div className="mt-1 flex items-center gap-2.5">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                </div>

                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 xl:w-[170px] xl:shrink-0">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="mt-2 h-4 w-28" />
                  </div>
                ))}

                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 xl:w-[220px] xl:shrink-0">
                  <Skeleton className="h-3 w-24" />
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <Skeleton className="h-4 w-24" />
                    <div className="flex -space-x-2">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <Skeleton key={index} className="h-8 w-8 rounded-full ring-2 ring-background" />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-6 py-4">
              <Skeleton className="h-5 w-24" />
            </div>
            <div className="px-6 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-32" />
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="absolute left-0 right-0 top-0 h-0.5 bg-gradient-to-r from-brand-accent-solid/30 via-brand-accent-solid to-brand-accent-solid/30" />

            <div className="border-b border-border px-6 py-5">
              <Skeleton className="h-6 w-28" />
            </div>

            <div className="px-6 py-6">
              <div className="flex items-center justify-center gap-3 py-2">
                <div className="h-px flex-1 bg-border" />
                <Skeleton className="h-6 w-32 rounded-full" />
                <div className="h-px flex-1 bg-border" />
              </div>

              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="mt-5 rounded-xl px-3 py-3">
                  <div className="flex gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-5 w-14 rounded-full" />
                        <Skeleton className="h-4 w-16" />
                      </div>
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-11/12" />
                        {index % 2 === 0 ? <Skeleton className="h-4 w-4/5" /> : null}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="sticky bottom-4 mt-6 rounded-2xl border border-border bg-background/95 p-3 shadow-lg backdrop-blur md:hidden">
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 flex-1" />
          </div>
        </div>
      </div>
    </div>
  );
}
