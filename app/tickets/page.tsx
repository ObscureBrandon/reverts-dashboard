'use client';

import { useState, Suspense, useEffect, useRef, useLayoutEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTickets, usePrefetchTickets, usePrefetchTicketDetail } from '@/lib/hooks/queries/useTickets';
import { useUser, useUserTicketStats, useUserRecentTickets, usePrefetchUser } from '@/lib/hooks/queries/useUsers';
import { usePanels } from '@/lib/hooks/queries/usePanels';

type Ticket = {
  id: number;
  sequence: number | null;
  status: string | null;
  createdAt: string;
  closedAt: string | null;
  author: {
    id: string;
    name: string;
    displayName: string | null;
    displayAvatar: string | null;
  } | null;
  channel: {
    id: string;
    name: string;
  } | null;
  panel: {
    id: number;
    title: string;
  } | null;
  messageCount: number;
};

type UserRole = {
  id: string;
  name: string;
  color: number;
  position: number;
};

type ModalData = 
  | { type: 'user'; id: string; data: { name: string; displayName: string | null; displayAvatar: string | null }; position: { x: number; y: number } }
  | null;

// Utility function to convert Discord role color integer to hex
function roleColorToHex(color: number): string {
  return '#' + color.toString(16).padStart(6, '0');
}

// Avatar component with fallback
function Avatar({ 
  src, 
  name, 
  size = 32,
  onClick 
}: { 
  src: string | null; 
  name: string; 
  size?: number;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const [imageError, setImageError] = useState(false);
  
  const initials = name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  
  const getColorFromName = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 60%, 50%)`;
  };
  
  const baseClasses = "rounded-full flex items-center justify-center border-2 border-gray-200 dark:border-gray-700 flex-shrink-0";
  const clickableClasses = onClick ? "cursor-pointer hover:opacity-80 transition-opacity" : "";
  
  if (!src || imageError) {
    return (
      <div 
        className={`${baseClasses} ${clickableClasses} font-semibold text-white`}
        style={{ 
          width: `${size}px`, 
          height: `${size}px`,
          backgroundColor: getColorFromName(name),
          fontSize: `${size * 0.4}px`
        }}
        onClick={onClick}
      >
        {initials}
      </div>
    );
  }
  
  return (
    <img 
      src={src}
      alt={`${name}'s avatar`}
      className={`${baseClasses} ${clickableClasses}`}
      style={{ width: `${size}px`, height: `${size}px` }}
      onError={() => setImageError(true)}
      onClick={onClick}
    />
  );
}

function MentionPopover({ modalData, onClose }: { modalData: ModalData; onClose: () => void }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isPositioned, setIsPositioned] = useState(false);

  // Use TanStack Query hooks for data fetching
  const userId = modalData?.type === 'user' ? modalData.id : undefined;
  
  const { data: userData, isLoading: rolesLoading } = useUser(userId, {
    enabled: modalData?.type === 'user',
  });
  
  const { data: ticketStats, isLoading: statsLoading } = useUserTicketStats(userId, {
    enabled: modalData?.type === 'user',
  });
  
  const { data: recentTickets = [], isLoading: recentLoading } = useUserRecentTickets(userId, 5, {
    enabled: modalData?.type === 'user',
  });
  
  const ticketsLoading = statsLoading || recentLoading;
  const userRoles = userData?.roles || [];

  // Calculate optimal position after render based on actual popover dimensions
  useLayoutEffect(() => {
    if (!modalData || !popoverRef.current) return;
    
    // Reset positioning when new popover opens
    if (modalData.type === 'user') {
      setIsPositioned(false);
    }

    const popover = popoverRef.current;
    const rect = popover.getBoundingClientRect();
    const viewportPadding = 16; // Buffer from viewport edges
    
    let x = modalData.position.x;
    let y = modalData.position.y + 10; // Default: show below with small gap

    // Horizontal positioning
    // Check if popover overflows right edge
    if (x + rect.width > window.innerWidth - viewportPadding) {
      // Align to right edge of viewport with padding
      x = window.innerWidth - rect.width - viewportPadding;
    }
    
    // Check if popover overflows left edge
    if (x < viewportPadding) {
      x = viewportPadding;
    }

    // Vertical positioning
    // Check if popover overflows bottom edge
    if (y + rect.height > window.innerHeight - viewportPadding) {
      // Try to show above the mention instead
      const yAbove = modalData.position.y - rect.height - 10;
      if (yAbove >= viewportPadding) {
        // Enough space above
        y = yAbove;
      } else {
        // Not enough space above or below, align to bottom with padding
        y = window.innerHeight - rect.height - viewportPadding;
      }
    }
    
    // Check if popover overflows top edge
    if (y < viewportPadding) {
      y = viewportPadding;
    }

    setPosition({ x, y });
    setIsPositioned(true);
  }, [modalData, ticketsLoading, rolesLoading, userRoles.length, recentTickets.length]);

  if (!modalData) return null;

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(text);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <>
      <div 
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      
      <div 
        ref={popoverRef}
        className={`fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 w-80 max-h-[90vh] overflow-y-auto transition-opacity duration-200 ${
          isPositioned ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
        }}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
              User
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-3">
            {modalData.type === 'user' && (
              <>
                <div className="flex items-center gap-3 pb-3 border-b border-gray-200 dark:border-gray-700">
                  <Avatar 
                    src={modalData.data.displayAvatar}
                    name={modalData.data.displayName || modalData.data.name}
                    size={64}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-gray-900 dark:text-white truncate">
                      {modalData.data.displayName || modalData.data.name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      @{modalData.data.name}
                    </p>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">User ID</label>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-gray-900 dark:text-white font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded flex-1">
                      {modalData.id}
                    </p>
                    <button
                      onClick={() => copyToClipboard(modalData.id)}
                      className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                      title="Copy ID"
                    >
                      {copiedId === modalData.id ? (
                        <svg className="w-3.5 h-3.5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                
                {/* Roles Section */}
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Roles
                  </label>
                  {rolesLoading ? (
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">Loading roles...</div>
                  ) : userRoles.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {userRoles.map(role => (
                        <div
                          key={role.id}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300"
                        >
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: role.color === 0 ? '#99AAB5' : roleColorToHex(role.color) }}
                          />
                          <span>{role.name}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">No roles</div>
                  )}
                </div>
                
                {/* Tickets Section */}
                <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Support Tickets
                  </label>
                  {ticketsLoading ? (
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">Loading tickets...</div>
                  ) : ticketStats ? (
                    <>
                      <div className="flex gap-4 mt-2 mb-3">
                        <div className="flex-1">
                          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {ticketStats.open}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Open</div>
                        </div>
                        <div className="flex-1">
                          <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                            {ticketStats.closed}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Closed</div>
                        </div>
                      </div>
                      
                      {recentTickets.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                            Recent Tickets
                          </div>
                          {recentTickets.map(ticket => (
                            <Link
                              key={ticket.id}
                              href={`/tickets/${ticket.id}`}
                              className="block px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors group"
                              onClick={onClose}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-blue-600 dark:text-blue-400 group-hover:underline">
                                    #{ticket.sequence !== null ? ticket.sequence : ticket.id}
                                  </span>
                                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                                    ticket.status === 'OPEN' 
                                      ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                  }`}>
                                    {ticket.status}
                                  </span>
                                </div>
                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                  {new Date(ticket.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                      
                      {(ticketStats.open > 0 || ticketStats.closed > 0) && (
                        <Link
                          href={`/tickets?author=${modalData.id}`}
                          className="mt-3 flex items-center justify-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                          onClick={onClose}
                        >
                          <span>View All Tickets</span>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      )}
                    </>
                  ) : (
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">No tickets found</div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

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
  const [modalData, setModalData] = useState<ModalData>(null);

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
    displayAvatar: string | null
  ) => {
    e.preventDefault();
    e.stopPropagation();
    
    const rect = (e.target as HTMLElement).getBoundingClientRect();
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
        y: rect.bottom,
      },
    });
  };

  // Handler for closing popover
  const handleCloseModal = () => {
    setModalData(null);
  };
  
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
          {isLoading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-500 dark:text-gray-400">Loading tickets...</p>
            </div>
          ) : filteredTickets.length === 0 ? (
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
                                ticket.author!.displayAvatar
                              )}
                              onMouseEnter={() => prefetchUser(ticket.author!.id)}
                            >
                              <Avatar 
                                src={ticket.author.displayAvatar}
                                name={ticket.author.displayName || ticket.author.name}
                                size={32}
                              />
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
                          ticket.author!.displayAvatar
                        )}
                        onMouseEnter={() => prefetchUser(ticket.author!.id)}
                      >
                        <Avatar 
                          src={ticket.author.displayAvatar}
                          name={ticket.author.displayName || ticket.author.name}
                          size={24}
                        />
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
                    disabled={page === 1 || isLoading}
                    className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed disabled:hover:bg-gray-300 transition-colors"
                  >
                    Previous
                  </button>
                  
                  <span className="text-gray-600 dark:text-gray-400">
                    Page {page} of {totalPages}
                  </span>
                  
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || isLoading}
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

      {/* User Popover */}
      {modalData && (
        <MentionPopover modalData={modalData} onClose={handleCloseModal} />
      )}
    </div>
  );
}

export default function TicketsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-500 dark:text-gray-400">Loading tickets...</p>
          </div>
        </div>
      </div>
    }>
      <TicketsContent />
    </Suspense>
  );
}
