import { NavigationHeader } from '@/app/components/navigation-header';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

export default function TicketsListSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <NavigationHeader />
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header skeleton */}
        <div className="mb-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <div className="h-1 w-12 bg-emerald-500/30 rounded-full mt-2" />
          <Skeleton className="h-5 w-64 mt-2" />
        </div>
        
        {/* Toolbar skeleton */}
        <div className="space-y-4 mb-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center flex-1">
                <div>
                  <Skeleton className="h-4 w-12 mb-1.5" />
                  <Skeleton className="h-10 w-[140px]" />
                </div>
                <div>
                  <Skeleton className="h-4 w-12 mb-1.5" />
                  <Skeleton className="h-10 w-[160px]" />
                </div>
                <div>
                  <Skeleton className="h-4 w-14 mb-1.5" />
                  <Skeleton className="h-10 w-[150px]" />
                </div>
              </div>
              <Skeleton className="h-5 w-24" />
            </div>
          </div>
        </div>
        
        {/* Table skeleton */}
        <div className="rounded-lg border border-border bg-card overflow-hidden relative">
          {/* Accent gradient at top */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500/30 via-emerald-500 to-emerald-500/30" />
          
          {/* Desktop Table View */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border bg-muted/30">
                  <TableHead className="h-11 text-muted-foreground font-medium">
                    <Skeleton className="h-4 w-16" />
                  </TableHead>
                  <TableHead className="h-11 text-muted-foreground font-medium">
                    <Skeleton className="h-4 w-16" />
                  </TableHead>
                  <TableHead className="h-11 text-muted-foreground font-medium">
                    <Skeleton className="h-4 w-14" />
                  </TableHead>
                  <TableHead className="h-11 text-muted-foreground font-medium">
                    <Skeleton className="h-4 w-20" />
                  </TableHead>
                  <TableHead className="h-11 text-muted-foreground font-medium">
                    <Skeleton className="h-4 w-16" />
                  </TableHead>
                  <TableHead className="h-11 text-muted-foreground font-medium">
                    <Skeleton className="h-4 w-14" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i} className="border-border">
                    <TableCell className="py-3.5">
                      <div>
                        <Skeleton className="h-5 w-16 mb-1" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </TableCell>
                    <TableCell className="py-3.5">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div>
                          <Skeleton className="h-4 w-24 mb-1" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3.5">
                      <Skeleton className="h-6 w-16 rounded-full" />
                    </TableCell>
                    <TableCell className="py-3.5">
                      <Skeleton className="h-5 w-8" />
                    </TableCell>
                    <TableCell className="py-3.5">
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell className="py-3.5">
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-border">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-6 w-12" />
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
                
                <Skeleton className="h-4 w-24 mb-2" />
                
                <div className="flex items-center gap-2 mb-2">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <Skeleton className="h-4 w-28" />
                </div>
                
                <Skeleton className="h-3 w-40" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
