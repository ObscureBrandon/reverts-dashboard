'use client';

import { useState, Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTickets, usePrefetchTickets, usePrefetchTicketDetail } from '@/lib/hooks/queries/useTickets';
import { useUser, usePrefetchUser, useUserPopoverData } from '@/lib/hooks/queries/useUsers';
import { usePanels } from '@/lib/hooks/queries/usePanels';
import TicketsListSkeleton from './skeleton';
import { Avatar } from '@/app/components/Avatar';
import { UserPopover } from '@/app/components/popovers/UserPopover';
import { LoadingSpinner } from '@/app/components/LoadingSpinner';

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
  
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [panelFilter, setPanelFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'messages'>('newest');
  const [page, setPage] = useState(1);
  
  const limit = 50;
  
  // Fetch panels list
  const { data: panelsData } = usePanels();
  const panels = panelsData || [];
  
  // Use TanStack Query hooks for data fetching
  const { data, isLoading, error } = useTickets({
    page,
    limit,
    sortBy,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    author: authorParam || undefined,
    panel: panelFilter !== 'all' ? parseInt(panelFilter) : undefined,
  });
  
  // Prefetch adjacent pages for instant navigation
  const { prefetchPage } = usePrefetchTickets({
    page,
    limit,
    sortBy,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    author: authorParam || undefined,
    panel: panelFilter !== 'all' ? parseInt(panelFilter) : undefined,
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
      
      // Prefetch next page if it exists
      if (currentPage < totalPages) {
        prefetchPage(currentPage + 1);
      }
      
      // Prefetch previous page if it exists
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
  const tickets = data?.tickets || [];
  const totalPages = data?.pagination.totalPages || 1;
  const total = data?.pagination.total || 0;
  const authorInfo = authorData ? {
    id: authorData.id,
    name: authorData.name,
    displayName: authorData.displayName,
  } : null;
  
  const filteredTickets = tickets;
  
  const handleClearAuthorFilter = () => {
    window.location.href = '/tickets';
  };

  // Handler for opening user popover
  const handleUserClick = (
    e: React.MouseEvent,
    userId: string,
    userName: string,
    displayName: string | null,
    displayAvatar: string | null,
    elementKey: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Find the avatar element (img or div) within the clicked container
    const container = e.currentTarget as HTMLElement;
    const avatarElement = container.querySelector('img, div[class*="rounded-full"]') as HTMLElement;
    const rect = avatarElement ? avatarElement.getBoundingClientRect() : container.getBoundingClientRect();
    
    // Set loading state and store unique key for spinner identification
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
  };

  // Handler for closing popover
  const handleCloseModal = () => {
    setModalData(null);
    setLoadingUserId(null);
    setLoadingElementKey(null);
  };
  
  // Show loading skeleton while data is being fetched
  if (isLoading) {
    return <TicketsListSkeleton />;
  }
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Support Tickets
            </h1>
            <Link 
              href="/messages"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Search Messages
            </Link>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Browse and manage all support tickets
          </p>
        </div>
        
        {/* Author Filter Indicator */}
        {authorInfo && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <p className="text-blue-800 dark:text-blue-200 text-sm font-medium">
                Showing tickets by @{authorInfo.name}
                {authorInfo.displayName && authorInfo.displayName !== authorInfo.name && (
                  <span className="text-blue-600 dark:text-blue-300"> ({authorInfo.displayName})</span>
                )}
              </p>
            </div>
            <button
              onClick={handleClearAuthorFilter}
              className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Clear Filter
            </button>
          </div>
        )}
        
        {/* Filters and Sort */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
                >
                  <option value="all">All Statuses</option>
                  <option value="OPEN">Open</option>
                  <option value="CLOSED">Closed</option>
                  <option value="DELETED">Deleted</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Panel
                </label>
                <select
                  value={panelFilter}
                  onChange={(e) => {
                    setPanelFilter(e.target.value);
                    setPage(1);
                  }}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
                >
                  <option value="all">All Panels</option>
                  {panels.map(panel => (
                    <option key={panel.id} value={panel.id.toString()}>
                      {panel.title}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest' | 'messages')}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="messages">Most Messages</option>
                </select>
              </div>
            </div>
            
            {total > 0 && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Showing {tickets.length} of {total.toLocaleString()} ticket{total !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>
        
        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-800 dark:text-red-200">
              Error: {error.message}
            </p>
          </div>
        )}
        
        {/* Tickets List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
          {filteredTickets.length === 0 ? (
            <div className="p-12 text-center text-gray-500 dark:text-gray-400">
              <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-lg font-medium">No tickets found</p>
              <p className="text-sm mt-2">Try adjusting your filters</p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Ticket
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Author
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Messages
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Closed
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredTickets.map((ticket) => (
                      <tr 
                        key={ticket.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Link 
                            href={`/tickets/${ticket.id}`}
                            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                            onMouseEnter={() => prefetchTicket(ticket.id)}
                          >
                            #{ticket.sequence !== null ? ticket.sequence : ticket.id}
                          </Link>
                          {ticket.channel && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              #{ticket.channel.name}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {ticket.author ? (
                            <div 
                              className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={(e) => handleUserClick(
                                e,
                                ticket.author!.id,
                                ticket.author!.name,
                                ticket.author!.displayName,
                                ticket.author!.displayAvatar,
                                `table-${ticket.id}`
                              )}
                              onMouseEnter={() => prefetchUser(ticket.author!.id)}
                            >
                              <div className="relative">
                                <Avatar 
                                  src={ticket.author.displayAvatar}
                                  name={ticket.author.displayName || ticket.author.name}
                                  size={32}
                                />
                                {loadingUserId === ticket.author.id && isPopoverFetching && loadingElementKey === `table-${ticket.id}` && (
                                  <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 rounded-full">
                                    <LoadingSpinner size="sm" />
                                  </div>
                                )}
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {ticket.author.displayName || ticket.author.name}
                                </div>
                                {ticket.author.displayName && ticket.author.name && ticket.author.displayName !== ticket.author.name && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    @{ticket.author.name}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500 dark:text-gray-400">Unknown</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            ticket.status === 'OPEN' 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : ticket.status === 'CLOSED'
                              ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          }`}>
                            {ticket.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {ticket.messageCount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {new Date(ticket.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {ticket.closedAt ? new Date(ticket.closedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          }) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Mobile Card View */}
              <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-700">
                {filteredTickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Link 
                          href={`/tickets/${ticket.id}`}
                          className="text-lg font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                          onMouseEnter={() => prefetchTicket(ticket.id)}
                        >
                          #{ticket.sequence !== null ? ticket.sequence : ticket.id}
                        </Link>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          ticket.status === 'OPEN' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : ticket.status === 'CLOSED'
                            ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {ticket.status}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {ticket.messageCount} msgs
                      </span>
                    </div>
                    
                    {ticket.channel && (
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        #{ticket.channel.name}
                      </div>
                    )}
                    
                    {ticket.author && (
                      <div 
                        className="flex items-center gap-2 mb-2 cursor-pointer hover:opacity-80 transition-opacity w-fit"
                        onClick={(e) => handleUserClick(
                          e,
                          ticket.author!.id,
                          ticket.author!.name,
                          ticket.author!.displayName,
                          ticket.author!.displayAvatar,
                          `card-${ticket.id}`
                        )}
                        onMouseEnter={() => prefetchUser(ticket.author!.id)}
                      >
                        <div className="relative">
                          <Avatar 
                            src={ticket.author.displayAvatar}
                            name={ticket.author.displayName || ticket.author.name}
                            size={24}
                          />
                          {loadingUserId === ticket.author.id && isPopoverFetching && loadingElementKey === `card-${ticket.id}` && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 rounded-full">
                              <LoadingSpinner size="sm" />
                            </div>
                          )}
                        </div>
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {ticket.author.displayName || ticket.author.name}
                        </span>
                      </div>
                    )}
                    
                    <div className="text-xs text-gray-500 dark:text-gray-400">
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
                ))}
              </div>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-4">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed disabled:hover:bg-gray-300 transition-colors"
                  >
                    Previous
                  </button>
                  
                  <span className="text-gray-600 dark:text-gray-400">
                    Page {page} of {totalPages}
                  </span>
                  
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed disabled:hover:bg-gray-300 transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* User Popover - only show when data is loaded */}
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
