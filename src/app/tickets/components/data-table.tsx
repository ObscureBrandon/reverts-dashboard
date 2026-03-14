'use client';

import { Badge } from '@/components/ui/badge';
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
import { getTicketStatusDescriptor } from '@/lib/status-system';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils';
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    SortingState,
    useReactTable,
} from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, Ticket } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

type MobileTicketRow = {
  id: number;
  sequence: number | null;
  status: string | null;
  messageCount: number;
  createdAt: string;
  closedAt: string | null;
  channel: {
    name: string;
  } | null;
  author: {
    id: string;
    name: string;
    displayName: string | null;
    displayAvatar: string | null;
  } | null;
  searchMatchedByParticipant?: boolean;
};

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
  // Simplified user click handler - opens global panel
  onUserClick?: (e: React.MouseEvent, userId: string) => void;
  onUserHover?: (userId: string) => void;
}

export function TicketsDataTable<TData extends MobileTicketRow, TValue>({
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
}: TicketsDataTableProps<TData, TValue> & {
  renderToolbar?: (table: ReturnType<typeof useReactTable<TData>>) => React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const currentQuery = searchParams.toString();
  const currentPathWithSearch = `${pathname}${currentQuery ? `?${currentQuery}` : ''}`;
  const getTicketHref = (ticketId: number) => `/tickets/${ticketId}?returnTo=${encodeURIComponent(currentPathWithSearch)}`;
  
  const sorting = externalSorting ?? internalSorting;
  const manualSorting = externalSorting !== undefined && onSortingChange !== undefined;

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
    getSortedRowModel: manualSorting ? undefined : getSortedRowModel(),
    manualSorting,
    onSortingChange: handleSortingChange,
    state: {
      sorting,
    },
    meta: {
      onUserClick,
      onUserHover,
      getTicketHref,
    },
  });

  // Column labels for skeleton (since column headers are functions)
  const columnLabels: Record<string, string> = {
    ticket: 'Ticket',
    author: 'Author',
    status: 'Ticket State',
    messageCount: 'Messages',
    createdAt: 'Created',
  };

  // Only show skeleton on initial load (no data yet)
  const showSkeleton = isLoading && data.length === 0;

  if (showSkeleton) {
    return (
      <div className="space-y-4">
        {renderToolbar && renderToolbar(table)}
        <div className="rounded-lg border border-border bg-card overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brand-accent-solid/30 via-brand-accent-solid to-brand-accent-solid/30" />
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border bg-muted/30">
                {columns.map((column, i) => (
                  <TableHead key={i} className="h-11 text-muted-foreground font-medium text-sm">
                    {columnLabels[(typeof column.id === 'string' ? column.id : '')] || (typeof column.header === 'string' ? column.header : '')}
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
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brand-accent-solid/30 via-brand-accent-solid to-brand-accent-solid/30" />
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
                        "hover:bg-muted/50"
                      )}
                      onClick={() => router.push(getTicketHref(row.original.id))}
                      onMouseEnter={() => onRowHoverStart?.(row.original)}
                    >
                      {row.getVisibleCells().map((cell, cellIndex) => (
                        <TableCell 
                          key={cell.id} 
                          className={cn(
                            "py-3.5 transition-colors",
                            cellIndex === 0 && "border-l-2 border-l-transparent group-hover:border-l-brand-accent-border"
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
                        <div className="p-4 rounded-full bg-muted">
                          <Ticket className="h-8 w-8 text-muted-foreground" />
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
                const ticket = row.original;
                const ticketAuthor = ticket.author;
                return (
                  <div
                    key={row.id}
                    className="p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => router.push(getTicketHref(ticket.id))}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-semibold text-foreground">
                          #{ticket.sequence !== null ? ticket.sequence : ticket.id}
                        </span>
                        <Badge
                          tone={ticket.status === 'DELETED' ? 'danger' : 'neutral'}
                          kind="status"
                          emphasis="soft"
                        >
                          {getTicketStatusDescriptor(ticket.status).label}
                        </Badge>
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
                    
                    {ticketAuthor && (
                      <div 
                        className="flex items-center gap-2 mb-2 cursor-pointer hover:opacity-80 active:opacity-60"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUserClick?.(e, ticketAuthor.id);
                        }}
                      >
                        <div className="w-6 h-6 rounded-full bg-muted overflow-hidden">
                          {ticketAuthor.displayAvatar ? (
                            <img src={ticketAuthor.displayAvatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                              {(ticketAuthor.displayName || ticketAuthor.name || '?')[0].toUpperCase()}
                            </div>
                          )}
                        </div>
                        <span className="text-sm text-foreground">
                          {ticketAuthor.displayName || ticketAuthor.name}
                        </span>
                      </div>
                    )}
                    
                    <div className="text-xs text-muted-foreground">
                      Created {formatRelativeTime(ticket.createdAt)}
                      {ticket.closedAt && (
                        <> • Closed {formatRelativeTime(ticket.closedAt)}</>
                      )}
                      {ticket.searchMatchedByParticipant ? <> • Participant match</> : null}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-12 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="p-4 rounded-full bg-muted">
                    <Ticket className="h-8 w-8 text-muted-foreground" />
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
