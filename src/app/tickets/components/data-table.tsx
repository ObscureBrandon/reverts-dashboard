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
} from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, Ticket } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface TicketsDataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  isFetching?: boolean;
  pagination?: {
    page: number;
    totalPages: number;
    total: number;
    limit: number;
  };
  onPageChange?: (page: number) => void;
  sorting?: SortingState;
  onSortingChange?: (sorting: SortingState) => void;
  onRowHoverStart?: (row: TData) => void;
  // Meta props for popover handling
  onUserClick?: (e: React.MouseEvent, userId: string, userName: string, displayName: string | null, displayAvatar: string | null, elementKey: string) => void;
  onUserHover?: (userId: string) => void;
  loadingUserId?: string | null;
  loadingElementKey?: string | null;
  isPopoverFetching?: boolean;
  // Status filter props (for column header)
  statusFilter?: string;
  onStatusFilterChange?: (status: string) => void;
  // Pending action for contextual loading
  pendingAction?: 'status' | 'panel' | 'page' | null;
}

export function TicketsDataTable<TData extends { id: number }, TValue>({
  columns,
  data,
  isLoading,
  isFetching,
  pagination,
  onPageChange,
  sorting: externalSorting,
  onSortingChange,
  renderToolbar,
  onRowHoverStart,
  onUserClick,
  onUserHover,
  loadingUserId,
  loadingElementKey,
  isPopoverFetching,
  statusFilter,
  onStatusFilterChange,
  pendingAction,
}: TicketsDataTableProps<TData, TValue> & {
  renderToolbar?: (table: ReturnType<typeof useReactTable<TData>>) => React.ReactNode;
}) {
  const router = useRouter();
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  
  const sorting = externalSorting ?? internalSorting;

  const handleSortingChange = (updater: SortingState | ((old: SortingState) => SortingState)) => {
    const newValue = typeof updater === 'function' ? updater(sorting) : updater;
    if (onSortingChange) {
      onSortingChange(newValue);
    } else {
      setInternalSorting(newValue);
    }
  };

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: handleSortingChange,
    state: {
      sorting,
    },
    meta: {
      onUserClick,
      onUserHover,
      loadingUserId,
      loadingElementKey,
      isPopoverFetching,
      statusFilter,
      onStatusFilterChange,
      pendingAction,
    },
  });

  // Column labels for skeleton (since column headers are functions)
  const columnLabels: Record<string, string> = {
    ticket: 'Ticket',
    author: 'Author',
    status: 'Status',
    messageCount: 'Messages',
    createdAt: 'Created',
    closedAt: 'Closed',
  };

  // Only show skeleton on initial load (no data yet)
  const showSkeleton = isLoading && data.length === 0;
  // Show subtle indicator when refetching with existing data
  const isRefetching = isFetching && data.length > 0;

  if (showSkeleton) {
    return (
      <div className="space-y-4">
        {renderToolbar && renderToolbar(table)}
        <div className="rounded-lg border border-border bg-card overflow-hidden relative">
          {/* Accent gradient at top */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500/30 via-emerald-500 to-emerald-500/30" />
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border bg-muted/30">
                {columns.map((column, i) => (
                  <TableHead key={i} className="h-11 text-muted-foreground font-medium text-sm">
                    {columnLabels[(column as any).id] || (typeof column.header === 'string' ? column.header : '')}
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
        <div className="rounded-lg border border-border bg-card overflow-hidden relative">
          {/* Accent gradient at top */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500/30 via-emerald-500 to-emerald-500/30" />
          
          {/* Desktop Table View */}
          <div className="hidden md:block">
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
                      className={cn(
                        "border-border transition-colors group cursor-pointer",
                        "hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20"
                      )}
                      onClick={() => router.push(`/tickets/${row.original.id}`)}
                      onMouseEnter={() => onRowHoverStart?.(row.original)}
                    >
                      {row.getVisibleCells().map((cell, cellIndex) => (
                        <TableCell 
                          key={cell.id} 
                          className={cn(
                            "py-3.5 transition-colors",
                            cellIndex === 0 && "border-l-2 border-l-transparent group-hover:border-l-emerald-500"
                          )}
                          onClick={(e) => {
                            // Stop propagation for author cell to allow popover
                            if (cell.column.id === 'author') {
                              e.stopPropagation();
                            }
                          }}
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
                      className="h-[400px] text-center align-middle"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <div className="p-4 rounded-full bg-emerald-50 dark:bg-emerald-950/50">
                          <Ticket className="h-8 w-8 text-emerald-500" />
                        </div>
                        <p className="text-muted-foreground font-medium">No tickets found</p>
                        <p className="text-sm text-muted-foreground/70">Try adjusting your filters</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-border">
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => {
                const ticket = row.original as any;
                return (
                  <div
                    key={row.id}
                    className="p-4 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-colors cursor-pointer"
                    onClick={() => router.push(`/tickets/${ticket.id}`)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                          #{ticket.sequence !== null ? ticket.sequence : ticket.id}
                        </span>
                        <span className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                          ticket.status === 'OPEN' 
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                            : ticket.status === 'CLOSED'
                            ? 'bg-muted text-muted-foreground'
                            : 'bg-destructive/10 text-destructive'
                        )}>
                          {ticket.status}
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {ticket.messageCount} msgs
                      </span>
                    </div>
                    
                    {ticket.channel && (
                      <div className="text-sm text-muted-foreground mb-2">
                        #{ticket.channel.name}
                      </div>
                    )}
                    
                    {ticket.author && (
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full bg-muted overflow-hidden">
                          {ticket.author.displayAvatar ? (
                            <img src={ticket.author.displayAvatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                              {(ticket.author.displayName || ticket.author.name || '?')[0].toUpperCase()}
                            </div>
                          )}
                        </div>
                        <span className="text-sm text-foreground">
                          {ticket.author.displayName || ticket.author.name}
                        </span>
                      </div>
                    )}
                    
                    <div className="text-xs text-muted-foreground">
                      Created {new Date(ticket.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                      {ticket.closedAt && (
                        <> • Closed {new Date(ticket.closedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}</>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-12 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="p-4 rounded-full bg-emerald-50 dark:bg-emerald-950/50">
                    <Ticket className="h-8 w-8 text-emerald-500" />
                  </div>
                  <p className="text-muted-foreground font-medium">No tickets found</p>
                  <p className="text-sm text-muted-foreground/70">Try adjusting your filters</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium text-foreground">{((pagination.page - 1) * pagination.limit) + 1}</span> to{' '}
            <span className="font-medium text-foreground">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of{' '}
            <span className="font-medium text-foreground">{pagination.total.toLocaleString()}</span> tickets
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
              <span className="font-medium px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
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
