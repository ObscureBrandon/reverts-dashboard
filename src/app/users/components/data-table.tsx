'use client';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState
} from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useState } from 'react';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  isFetching?: boolean; // True when refetching with existing data
  pagination?: {
    page: number;
    totalPages: number;
    total: number;
    limit: number;
  };
  onPageChange?: (page: number) => void;
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: (visibility: VisibilityState) => void;
  sorting?: SortingState;
  onSortingChange?: (sorting: SortingState) => void;
  onRowClick?: (row: TData) => void;
  onRowHoverStart?: (row: TData) => void;
}

const columnLabels: Record<string, string> = {
  user: 'User',
  relationToIslam: 'Relation to Islam',
  status: 'Status',
  currentAssignmentStatus: 'Assignment',
  topRoles: 'Roles',
  createdAt: 'Joined',
};

export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading,
  isFetching,
  pagination,
  onPageChange,
  columnVisibility: externalVisibility,
  onColumnVisibilityChange,
  sorting: externalSorting,
  onSortingChange,
  renderToolbar,
  onRowClick,
  onRowHoverStart,
}: DataTableProps<TData, TValue> & {
  renderToolbar?: (table: any) => React.ReactNode;
}) {
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const [internalVisibility, setInternalVisibility] = useState<VisibilityState>({});
  
  const sorting = externalSorting ?? internalSorting;
  const columnVisibility = externalVisibility ?? internalVisibility;

  // Wrap handlers to match TanStack Table's expected signature
  const handleSortingChange = (updater: SortingState | ((old: SortingState) => SortingState)) => {
    const newValue = typeof updater === 'function' ? updater(sorting) : updater;
    if (onSortingChange) {
      onSortingChange(newValue);
    } else {
      setInternalSorting(newValue);
    }
  };

  const handleVisibilityChange = (updater: VisibilityState | ((old: VisibilityState) => VisibilityState)) => {
    const newValue = typeof updater === 'function' ? updater(columnVisibility) : updater;
    if (onColumnVisibilityChange) {
      onColumnVisibilityChange(newValue);
    } else {
      setInternalVisibility(newValue);
    }
  };

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: handleSortingChange,
    onColumnVisibilityChange: handleVisibilityChange,
    state: {
      sorting,
      columnVisibility,
    },
  });

  // Only show skeleton on initial load (no data yet)
  const showSkeleton = isLoading && data.length === 0;
  // Show subtle opacity when refetching with existing data
  const isRefetching = isFetching && data.length > 0;

  if (showSkeleton) {
    return (
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border bg-muted/30">
              {columns.map((column, i) => (
                <TableHead key={i} className="h-11 text-muted-foreground font-medium">
                  {typeof column.header === 'string' ? column.header : ''}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 10 }).map((_, i) => (
              <TableRow key={i} className="border-border">
                {columns.map((_, j) => (
                  <TableCell key={j} className="py-3.5">
                    <Skeleton className="h-5 w-full max-w-[180px]" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {renderToolbar && renderToolbar(table)}

      <div className="relative">
        {/* Refetch indicator overlay */}
        {isRefetching && (
          <div className="absolute top-2 right-2 z-10">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
          </div>
        )}
        
        <div className={`rounded-lg border border-border bg-card overflow-hidden transition-opacity ${isRefetching ? 'opacity-70' : ''}`}>
          <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent border-border bg-muted/30">
                {headerGroup.headers.map((header) => (
                  <TableHead 
                    key={header.id}
                    className="h-11 text-muted-foreground font-medium text-sm"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="border-border hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-colors group cursor-pointer"
                  onClick={() => onRowClick?.(row.original)}
                  onMouseEnter={() => onRowHoverStart?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell 
                      key={cell.id} 
                      className="py-3.5 first:border-l-2 first:border-l-transparent group-hover:first:border-l-emerald-500 transition-colors"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-[400px] text-center text-muted-foreground align-middle"
                >
                  No users found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium text-foreground">{((pagination.page - 1) * pagination.limit) + 1}</span> to{' '}
            <span className="font-medium text-foreground">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of{' '}
            <span className="font-medium text-foreground">{pagination.total.toLocaleString()}</span> users
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => onPageChange?.(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1 px-2 text-sm">
              <span className="font-medium">{pagination.page}</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-muted-foreground">{pagination.totalPages}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => onPageChange?.(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
