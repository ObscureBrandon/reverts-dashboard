'use client';

import { NavigationHeader } from '@/app/components/navigation-header';
import { PageHeader } from '@/app/components/page-header';
import { Badge } from '@/components/ui/badge';
import { useUserPanel } from '@/lib/contexts/user-panel-context';
import { usePanels } from '@/lib/hooks/queries/usePanels';
import { usePrefetchTicketDetail, usePrefetchTickets, useTickets } from '@/lib/hooks/queries/useTickets';
import { usePrefetchUserDetails } from '@/lib/hooks/queries/useUserDetails';
import { useUserRole } from '@/lib/hooks/queries/useUserRole';
import { useUser } from '@/lib/hooks/queries/useUsers';
import { SortingState } from '@tanstack/react-table';
import { useDebouncedCallback } from '@tanstack/react-pacer';
import { useRouter } from 'next/navigation';
import { parseAsArrayOf, parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { TicketListItem, ticketColumns } from './components/columns';
import { TicketsDataTable } from './components/data-table';
import { TicketFilterState, TicketsToolbar } from './components/data-table-toolbar';
import TicketsListSkeleton from './skeleton';

const ticketStatusOptions = ['all', 'OPEN', 'CLOSED', 'DELETED'] as const;
const ticketSortOptions = ['ticket', 'createdAt', 'messageCount'] as const;
const ticketSortOrderOptions = ['asc', 'desc'] as const;

const searchParamsSchema = {
  page: parseAsInteger.withDefault(1),
  q: parseAsString.withDefault(''),
  status: parseAsStringLiteral(ticketStatusOptions).withDefault('all'),
  panel: parseAsArrayOf(parseAsInteger).withDefault([]),
  author: parseAsString.withDefault(''),
  sort: parseAsStringLiteral(ticketSortOptions).withDefault('createdAt'),
  order: parseAsStringLiteral(ticketSortOrderOptions).withDefault('desc'),
};

function normalizePanelIds(panelIds: number[]) {
  return [...new Set(panelIds)].sort((left, right) => left - right);
}

function TicketsContent() {
  const router = useRouter();
  const { isMod, isLoading: roleLoading } = useUserRole();
  const [params, setParams] = useQueryStates(searchParamsSchema, {
    history: 'replace',
    shallow: true,
    throttleMs: 50,
  });
  const authorParam = params.author || null;
  
  // Global panel context
  const { openUserPanel } = useUserPanel();
  const [searchInput, setSearchInput] = useState(params.q);
  
  const limit = 50;
  
  // Fetch panels list
  const { data: panelsData } = usePanels();
  const panels = panelsData || [];
  const panelIds = useMemo(() => normalizePanelIds(params.panel), [params.panel]);
  const sorting: SortingState = [{ id: params.sort, desc: params.order === 'desc' }];
  const ticketSortBy = params.sort === 'ticket'
    ? 'sequence'
    : params.sort === 'messageCount'
      ? 'messageCount'
      : 'createdAt';
  
  // Use TanStack Query hooks for data fetching
  const { data, isLoading, isFetching, error } = useTickets({
    page: params.page,
    limit,
    sortBy: ticketSortBy,
    sortOrder: params.order,
    status: params.status !== 'all' ? params.status : undefined,
    author: authorParam || undefined,
    panels: panelIds.length > 0 ? panelIds : undefined,
    search: params.q || undefined,
  });
  
  // Prefetch adjacent pages for instant navigation
  const { prefetchPage } = usePrefetchTickets({
    page: params.page,
    limit,
    sortBy: ticketSortBy,
    sortOrder: params.order,
    status: params.status !== 'all' ? params.status : undefined,
    author: authorParam || undefined,
    panels: panelIds.length > 0 ? panelIds : undefined,
    search: params.q || undefined,
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
    setParams({ author: null, page: 1 });
  }, [setParams]);

  const debouncedSearch = useDebouncedCallback(
    (query: string) => {
      setParams({ q: query || null, page: 1 });
    },
    { wait: 180 }
  );

  const handleSearch = useCallback((query: string) => {
    setSearchInput(query);
    debouncedSearch(query);
  }, [debouncedSearch]);

  const filters = useMemo<TicketFilterState>(() => ({
    query: searchInput,
    status: params.status,
    panelIds,
  }), [panelIds, params.status, searchInput]);

  const handleFiltersChange = useCallback((newFilters: TicketFilterState) => {
    if (newFilters.query !== searchInput) {
      setSearchInput(newFilters.query);
      debouncedSearch(newFilters.query);
    }

    const nextPanelIds = normalizePanelIds(newFilters.panelIds);

    setParams({
      status: newFilters.status === 'all' ? null : newFilters.status,
      panel: nextPanelIds.length > 0 ? nextPanelIds : null,
      page: 1,
    });
  }, [debouncedSearch, searchInput, setParams]);

  const handlePageChange = useCallback((newPage: number) => {
    setParams({ page: newPage === 1 ? null : newPage });
  }, [setParams]);

  const handleSortingChange = useCallback((newSorting: SortingState) => {
    if (newSorting.length === 0) {
      setParams({ sort: null, order: null, page: 1 });
      return;
    }

    const { id, desc } = newSorting[0];
    const nextSort = id === 'createdAt' ? null : id;
    const nextOrder = desc ? null : 'asc';

    setParams({
      sort: nextSort as (typeof ticketSortOptions)[number] | null,
      order: nextOrder,
      page: 1,
    });
  }, [setParams]);

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
  
  // Redirect to my-tickets if not a mod
  useEffect(() => {
    if (!roleLoading && !isMod) {
      router.replace('/my-tickets');
    }
  }, [isMod, roleLoading, router]);

  // Don't render content if redirecting
  if (!roleLoading && !isMod) {
    return <TicketsListSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      <NavigationHeader />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <PageHeader
          title="Tickets"
          context={authorInfo ? <Badge tone="info" kind="meta" emphasis="soft">Author Filter</Badge> : undefined}
          utility={
            <TicketsToolbar
              filters={filters}
              onFiltersChange={handleFiltersChange}
              onSearch={handleSearch}
              panels={panels}
              authorInfo={authorInfo}
              onClearAuthorFilter={handleClearAuthorFilter}
            />
          }
          className="mb-0"
        />
        
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
          sorting={sorting}
          onSortingChange={handleSortingChange}
          onRowHoverStart={handleRowHover}
          onUserClick={handleUserClick}
          onUserHover={handleUserHover}
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
