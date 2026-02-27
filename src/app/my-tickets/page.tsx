'use client';

import { NavigationHeader } from '@/app/components/navigation-header';
import { MyTicket, useMyTickets, usePrefetchMyTickets } from '@/lib/hooks/queries/useMyTickets';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

type StatusFilter = 'all' | 'OPEN' | 'CLOSED';

function StatusBadge({ status }: { status: string | null }) {
  const colorMap: Record<string, string> = {
    OPEN: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    CLOSED: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    DELETED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorMap[status || ''] || 'bg-gray-100 text-gray-800'}`}>
      {status || 'Unknown'}
    </span>
  );
}

function TicketRow({ ticket }: { ticket: MyTicket }) {
  return (
    <Link
      href={`/tickets/${ticket.id}`}
      className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors border-b border-border last:border-b-0 group"
    >
      <div className="flex items-center gap-4 min-w-0 flex-1">
        {/* Ticket number */}
        <div className="flex-shrink-0 w-16 text-sm font-mono text-muted-foreground">
          #{ticket.sequence ?? ticket.id}
        </div>

        {/* Panel / category */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground truncate">
              {ticket.panel?.title || 'General'}
            </span>
            <StatusBadge status={ticket.status} />
          </div>
          {ticket.channel && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              #{ticket.channel.name}
            </p>
          )}
        </div>
      </div>

      {/* Right side: message count and date */}
      <div className="flex items-center gap-6 flex-shrink-0 ml-4">
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          {ticket.messageCount}
        </div>
        <div className="text-xs text-muted-foreground w-24 text-right">
          {new Date(ticket.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </div>
        <svg
          className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}

function MyTicketsSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <NavigationHeader />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="h-8 w-40 bg-muted rounded animate-pulse" />
          <div className="h-1 w-12 bg-emerald-500 rounded-full mt-2" />
          <div className="h-4 w-60 bg-muted rounded animate-pulse mt-2" />
        </div>
        <div className="bg-card rounded-lg border border-border">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-4 border-b border-border last:border-b-0">
              <div className="flex items-center gap-4 flex-1">
                <div className="h-4 w-12 bg-muted rounded animate-pulse" />
                <div className="flex-1">
                  <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-20 bg-muted rounded animate-pulse mt-1" />
                </div>
              </div>
              <div className="h-4 w-20 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function MyTicketsPage() {
  const [status, setStatus] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const limit = 50;

  const { data, isLoading, isFetching, error } = useMyTickets({
    page,
    limit,
    status: status !== 'all' ? status : undefined,
  });

  const { prefetchPage } = usePrefetchMyTickets({
    page,
    limit,
    status: status !== 'all' ? status : undefined,
  });

  // Prefetch adjacent pages
  useEffect(() => {
    if (data?.pagination) {
      const { page: currentPage, totalPages } = data.pagination;
      if (currentPage < totalPages) prefetchPage(currentPage + 1);
      if (currentPage > 1) prefetchPage(currentPage - 1);
    }
  }, [data?.pagination, prefetchPage]);

  const handleStatusChange = useCallback((newStatus: StatusFilter) => {
    setStatus(newStatus);
    setPage(1);
  }, []);

  if (isLoading) {
    return <MyTicketsSkeleton />;
  }

  const tickets = data?.tickets || [];
  const pagination = data?.pagination;

  return (
    <div className="min-h-screen bg-background">
      <NavigationHeader />
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">
            My Tickets
          </h1>
          <div className="h-1 w-12 bg-emerald-500 rounded-full mt-2" />
          <p className="text-muted-foreground mt-2">
            Your support ticket history
          </p>
        </div>

        {/* Status filter tabs */}
        <div className="flex items-center gap-1 mb-6 p-1 bg-muted/50 rounded-lg w-fit">
          {(['all', 'OPEN', 'CLOSED'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => handleStatusChange(s)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                status === s
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {s === 'all' ? 'All' : s === 'OPEN' ? 'Open' : 'Closed'}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 mb-6">
            <p className="text-destructive text-sm">
              Error: {error.message}
            </p>
          </div>
        )}

        {/* Ticket list */}
        <div className={`bg-card rounded-lg border border-border overflow-hidden ${isFetching ? 'opacity-70' : ''} transition-opacity`}>
          {tickets.length === 0 ? (
            <div className="text-center py-16">
              <svg className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
              <p className="text-muted-foreground text-sm">
                {status === 'all'
                  ? 'You don\'t have any tickets yet'
                  : `No ${status.toLowerCase()} tickets found`}
              </p>
            </div>
          ) : (
            tickets.map((ticket) => (
              <TicketRow key={ticket.id} ticket={ticket} />
            ))
          )}
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <p className="text-sm text-muted-foreground">
              Showing {(pagination.page - 1) * pagination.limit + 1}–
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
              {pagination.total} tickets
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page <= 1}
                className="px-3 py-1.5 text-sm font-medium rounded-md border border-border bg-background hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-muted-foreground px-2">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1.5 text-sm font-medium rounded-md border border-border bg-background hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
