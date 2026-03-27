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
import { cn } from '@/lib/utils';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState
} from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, Loader2, Users } from 'lucide-react';
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
  selectedRowId?: string | null;
  getRowId?: (row: TData) => string;
}

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
  selectedRowId,
  getRowId,
}: DataTableProps<TData, TValue> & {
  renderToolbar?: (table: ReturnType<typeof useReactTable<TData>>) => React.ReactNode;
}) {
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const [internalVisibility, setInternalVisibility] = useState<VisibilityState>({});
  
  const sorting = externalSorting ?? internalSorting;
  const columnVisibility = externalVisibility ?? internalVisibility;
  const manualSorting = externalSorting !== undefined && onSortingChange !== undefined;

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

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: manualSorting ? undefined : getSortedRowModel(),
    manualSorting,
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
      <div className="space-y-4">
        {renderToolbar && renderToolbar(table)}
        <div className="relative overflow-hidden rounded-lg border border-border bg-card">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brand-accent-solid/30 via-brand-accent-solid to-brand-accent-solid/30" />
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
            <Loader2 className="h-4 w-4 animate-spin text-brand-accent-text" />
          </div>
        )}
        
                <div className="relative overflow-hidden rounded-lg border border-border bg-card">
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brand-accent-solid/30 via-brand-accent-solid to-brand-accent-solid/30" />
          <div className="overflow-x-auto">
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
              table.getRowModel().rows.map((row) => {
                const rowId = getRowId ? getRowId(row.original) : row.id;
                const isSelected = selectedRowId === rowId;
                
                return (
                  <TableRow
                    key={row.id}
                    className={cn(
                      "border-border transition-colors group cursor-pointer",
                      isSelected 
                        ? "bg-brand-accent-soft/60" 
                        : "hover:bg-muted/60"
                    )}
                    onClick={() => onRowClick?.(row.original)}
                    onMouseEnter={() => onRowHoverStart?.(row.original)}
                  >
                    {row.getVisibleCells().map((cell, cellIndex) => (
                      <TableCell 
                        key={cell.id} 
                        className={cn(
                          "py-3.5 transition-colors",
                          cellIndex === 0 && "border-l-2",
                          cellIndex === 0 && (isSelected 
                            ? "border-l-brand-accent-solid" 
                            : "border-l-transparent group-hover:border-l-brand-accent-border")
                        )}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-[400px] text-center align-middle"
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="rounded-full bg-muted p-4">
                      <Users className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground font-medium">No users found</p>
                    <p className="text-sm text-muted-foreground/70">Try adjusting your search or filters</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          </Table>
          </div>
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
            <div className="flex items-center gap-1.5 px-2 text-sm">
              <span className="rounded-md bg-brand-accent-soft px-2 py-0.5 font-medium text-brand-accent-text">
                {pagination.page}
              </span>
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
