'use client';

import { NavigationHeader } from '@/app/components/navigation-header';
import { UserPopover } from '@/app/components/popovers/UserPopover';
import { usePanels } from '@/lib/hooks/queries/usePanels';
import { usePrefetchTicketDetail, usePrefetchTickets, useTickets } from '@/lib/hooks/queries/useTickets';
import { usePrefetchUser, useUser, useUserPopoverData } from '@/lib/hooks/queries/useUsers';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { TicketListItem, ticketColumns } from './components/columns';
import { TicketsDataTable } from './components/data-table';
import { TicketFilterState, TicketsToolbar } from './components/data-table-toolbar';
import TicketsListSkeleton from './skeleton';

type UserModalData = { 
  type: 'user'; 
  id: string; 
  data: { name: string; displayName: string | null; displayAvatar: string | null }; 
  position: { x: number; y: number; triggerWidth?: number; triggerHeight?: number };
  popoverData?: {
    user: {
      id: string;
      name: string;
      displayName: string | null;
      displayAvatar: string | null;
      nick: string | null;
      inGuild: boolean | null;
      isVerified: boolean | null;
      isVoiceVerified: boolean | null;
    };
    roles: Array<{
      id: string;
      name: string;
      color: number;
      position: number;
    }>;
    ticketStats: {
      open: number;
      closed: number;
    };
    recentTickets: Array<{
      id: number;
      sequence: number | null;
      status: string | null;
      createdAt: string;
    }>;
  };
};

function TicketsContent() {
  const searchParams = useSearchParams();
  const authorParam = searchParams.get('author');
  
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

  // Prefetch user data on hover
  const { prefetchUser } = usePrefetchUser();

  // Modal state for user popover
  const [modalData, setModalData] = useState<UserModalData | null>(null);
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);
  const [loadingElementKey, setLoadingElementKey] = useState<string | null>(null);

  // Fetch popover data when loading
  const { data: popoverData, isFetching: isPopoverFetching } = useUserPopoverData(loadingUserId || undefined, {
    enabled: !!loadingUserId,
  });

  // When popover data is loaded, show the popover
  useEffect(() => {
    if (loadingUserId && popoverData && modalData?.id === loadingUserId) {
      setModalData(prev => prev ? { ...prev, popoverData } : null);
      setLoadingUserId(null);
      setLoadingElementKey(null);
    }
  }, [popoverData, loadingUserId, modalData?.id]);

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
  const total = data?.pagination.total || 0;
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

  // Handler for opening user popover (passed to table via meta)
  const handleUserClick = useCallback((
    e: React.MouseEvent,
    userId: string,
    userName: string,
    displayName: string | null,
    displayAvatar: string | null,
    elementKey: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    
    const container = e.currentTarget as HTMLElement;
    const avatarElement = container.querySelector('img, div[class*="rounded-full"]') as HTMLElement;
    const rect = avatarElement ? avatarElement.getBoundingClientRect() : container.getBoundingClientRect();
    
    setLoadingUserId(userId);
    setLoadingElementKey(elementKey);
    setModalData({
      type: 'user',
      id: userId,
      data: {
        name: userName,
        displayName: displayName,
        displayAvatar: displayAvatar,
      },
      position: {
        x: rect.left,
        y: rect.top,
        triggerWidth: rect.width,
        triggerHeight: rect.height,
      },
    });
  }, []);

  // Handler for row hover - prefetch ticket details
  const handleRowHover = useCallback((ticket: TicketListItem) => {
    prefetchTicket(ticket.id);
  }, [prefetchTicket]);

  // Handler for user hover - prefetch user data
  const handleUserHover = useCallback((userId: string) => {
    prefetchUser(userId);
  }, [prefetchUser]);

  // Handler for closing popover
  const handleCloseModal = useCallback(() => {
    setModalData(null);
    setLoadingUserId(null);
    setLoadingElementKey(null);
  }, []);
  
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
          loadingUserId={loadingUserId}
          loadingElementKey={loadingElementKey}
          isPopoverFetching={isPopoverFetching}
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

      {/* User Popover */}
      {modalData && modalData.popoverData && (
        <UserPopover 
          isOpen={true}
          onClose={handleCloseModal}
          triggerPosition={modalData.position}
          userData={{
            id: modalData.id,
            name: modalData.data.name,
            displayName: modalData.data.displayName,
            displayAvatar: modalData.data.displayAvatar,
          }}
          popoverData={modalData.popoverData}
        />
      )}
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
