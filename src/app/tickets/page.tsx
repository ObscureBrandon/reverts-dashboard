'use client';

import { NavigationHeader } from '@/app/components/navigation-header';
import { useUserPanel } from '@/lib/contexts/user-panel-context';
import { usePanels } from '@/lib/hooks/queries/usePanels';
import { usePrefetchTicketDetail, usePrefetchTickets, useTickets } from '@/lib/hooks/queries/useTickets';
import { usePrefetchUserDetails } from '@/lib/hooks/queries/useUserDetails';
import { useUser } from '@/lib/hooks/queries/useUsers';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { TicketListItem, ticketColumns } from './components/columns';
import { TicketsDataTable } from './components/data-table';
import { TicketFilterState, TicketsToolbar } from './components/data-table-toolbar';
import TicketsListSkeleton from './skeleton';

function TicketsContent() {
  const searchParams = useSearchParams();
  const authorParam = searchParams.get('author');
  
  // Global panel context
  const { openUserPanel } = useUserPanel();
  
  // Filter state
  const [filters, setFilters] = useState<TicketFilterState>({
    status: 'all',
    panelId: 'all',
  });
  const [page, setPage] = useState(1);
  
  // Track which action triggered the current fetch
  const [pendingAction, setPendingAction] = useState<'status' | 'panel' | 'page' | null>(null);
  
  const limit = 50;
  
  // Fetch panels list
  const { data: panelsData } = usePanels();
  const panels = panelsData || [];
  
  // Use TanStack Query hooks for data fetching
  const { data, isLoading, isFetching, isPlaceholderData, error } = useTickets({
    page,
    limit,
    status: filters.status !== 'all' ? filters.status : undefined,
    author: authorParam || undefined,
    panel: filters.panelId !== 'all' ? parseInt(filters.panelId) : undefined,
  });
  
  // Prefetch adjacent pages for instant navigation
  const { prefetchPage } = usePrefetchTickets({
    page,
    limit,
    status: filters.status !== 'all' ? filters.status : undefined,
    author: authorParam || undefined,
    panel: filters.panelId !== 'all' ? parseInt(filters.panelId) : undefined,
  });

  // Prefetch ticket details on hover
  const { prefetchTicket } = usePrefetchTicketDetail();

  // Prefetch user details on hover
  const { prefetch: prefetchUserDetails } = usePrefetchUserDetails();

  // Prefetch next/previous pages when data loads
  useEffect(() => {
    if (data?.pagination) {
      const { page: currentPage, totalPages } = data.pagination;
      
      if (currentPage < totalPages) {
        prefetchPage(currentPage + 1);
      }
      if (currentPage > 1) {
        prefetchPage(currentPage - 1);
      }
    }
  }, [data?.pagination, prefetchPage]);
  
  // Fetch author info when author param is present
  const { data: authorData } = useUser(authorParam || undefined, {
    enabled: !!authorParam,
  });
  
  // Extract data from hook responses
  const tickets: TicketListItem[] = data?.tickets || [];
  const authorInfo = authorData ? {
    id: authorData.id,
    name: authorData.name,
    displayName: authorData.displayName,
  } : null;
  
  const handleClearAuthorFilter = useCallback(() => {
    window.location.href = '/tickets';
  }, []);

  const handleFiltersChange = useCallback((newFilters: TicketFilterState) => {
    // Determine which filter changed
    if (newFilters.panelId !== filters.panelId) {
      setPendingAction('panel');
    }
    setFilters(newFilters);
    setPage(1); // Reset to first page when filters change
  }, [filters.panelId]);

  // Handler for status filter change (from column header)
  const handleStatusFilterChange = useCallback((status: string) => {
    setPendingAction('status');
    setFilters(prev => ({ ...prev, status: status as TicketFilterState['status'] }));
    setPage(1);
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setPendingAction('page');
    setPage(newPage);
  }, []);

  // Clear pending action when fetch completes (data is no longer placeholder)
  useEffect(() => {
    if (!isFetching && !isPlaceholderData && pendingAction) {
      setPendingAction(null);
    }
  }, [isFetching, isPlaceholderData, pendingAction]);

  // Handler for opening user panel (passed to table via meta)
  const handleUserClick = useCallback((
    e: React.MouseEvent,
    userId: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    openUserPanel(userId);
  }, [openUserPanel]);

  // Handler for row hover - prefetch ticket details
  const handleRowHover = useCallback((ticket: TicketListItem) => {
    prefetchTicket(ticket.id);
  }, [prefetchTicket]);

  // Handler for user hover - prefetch user details
  const handleUserHover = useCallback((userId: string) => {
    prefetchUserDetails(userId);
  }, [prefetchUserDetails]);
  
  return (
    <div className="min-h-screen bg-background">
      <NavigationHeader />
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">
            Support Tickets
          </h1>
          <div className="h-1 w-12 bg-emerald-500 rounded-full mt-2" />
          <p className="text-muted-foreground mt-2">
            Browse and manage all support tickets
          </p>
        </div>
        
        {/* Error Message */}
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 mb-6">
            <p className="text-destructive text-sm">
              Error: {error.message}
            </p>
          </div>
        )}
        
        {/* Data Table with Toolbar */}
        <TicketsDataTable
          columns={ticketColumns}
          data={tickets}
          isLoading={isLoading}
          isFetching={isFetching}
          pagination={data?.pagination}
          onPageChange={handlePageChange}
          onRowHoverStart={handleRowHover}
          onUserClick={handleUserClick}
          onUserHover={handleUserHover}
          statusFilter={filters.status}
          onStatusFilterChange={handleStatusFilterChange}
          pendingAction={pendingAction}
          renderToolbar={() => (
            <TicketsToolbar
              filters={filters}
              onFiltersChange={handleFiltersChange}
              panels={panels}
              authorInfo={authorInfo}
              onClearAuthorFilter={handleClearAuthorFilter}
              pendingAction={pendingAction}
            />
          )}
        />
      </div>
    </div>
  );
}

export default function TicketsPage() {
  return (
    <Suspense fallback={<TicketsListSkeleton />}>
      <TicketsContent />
    </Suspense>
  );
}
