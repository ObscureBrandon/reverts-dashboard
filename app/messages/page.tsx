'use client';

import { useState, useCallback, Suspense, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useMessages, usePrefetchMessages } from '@/lib/hooks/queries/useMessages';
import { usePrefetchUser } from '@/lib/hooks/queries/useUsers';
import Link from 'next/link';
import { Avatar } from '@/app/components/Avatar';
import { roleColorToHex } from '@/app/components/utils';
import { UserPopover } from '@/app/components/popovers/UserPopover';
import { RolePopover } from '@/app/components/popovers/RolePopover';
import { ChannelPopover } from '@/app/components/popovers/ChannelPopover';

type Message = {
  id: string;
  content: string;
  createdAt: string;
  isStaff: boolean;
  author: {
    id: string;
    name: string;
    displayName: string | null;
    nick: string | null;
    displayAvatar: string | null;
  } | null;
  channel: {
    id: string;
    name: string;
  } | null;
  ticket: {
    id: number;
    sequence: number | null;
    status: string | null;
    createdAt: string;
  } | null;
};

type MentionLookup = {
  users: Record<string, { name: string; displayName: string | null; displayAvatar: string | null }>;
  roles: Record<string, { name: string; color: number }>;
  channels: Record<string, { name: string }>;
};

type UserRole = {
  id: string;
  name: string;
  color: number;
  position: number;
};

type UserModalData = { 
  type: 'user'; 
  id: string; 
  data: { name: string; displayName: string | null; displayAvatar: string | null }; 
  position: { x: number; y: number } 
};

type RoleModalData = { 
  type: 'role'; 
  id: string; 
  data: { name: string; color: number }; 
  position: { x: number; y: number } 
};

type ChannelModalData = { 
  type: 'channel'; 
  id: string; 
  data: { name: string }; 
  position: { x: number; y: number } 
};

type SearchResponse = {
  messages: Message[];
  mentions: MentionLookup;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  guildId: string | null;
};

// Component to render a single mention
function Mention({ 
  type, 
  id, 
  mentionLookup,
  onClick
}: { 
  type: 'user' | 'role' | 'channel'; 
  id: string; 
  mentionLookup: MentionLookup;
  onClick: (e: React.MouseEvent) => void;
}) {
  if (type === 'user') {
    const user = mentionLookup.users[id];
    const displayName = user?.displayName || user?.name || `Unknown User`;
    return (
      <span 
        onClick={onClick}
        className="inline-flex items-center px-1 py-0.5 mx-0.5 rounded text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
      >
        @{displayName}
      </span>
    );
  } else if (type === 'role') {
    const role = mentionLookup.roles[id];
    const roleName = role?.name || 'Unknown Role';
    const roleColor = role?.color ? roleColorToHex(role.color) : '#99aab5';
    return (
      <span 
        onClick={onClick}
        className="inline-flex items-center px-1 py-0.5 mx-0.5 rounded text-sm font-medium cursor-pointer hover:opacity-80 transition-opacity"
        style={{ 
          backgroundColor: `${roleColor}20`,
          color: roleColor,
        }}
      >
        @{roleName}
      </span>
    );
  } else if (type === 'channel') {
    const channel = mentionLookup.channels[id];
    const channelName = channel?.name || 'unknown-channel';
    return (
      <span 
        onClick={onClick}
        className="inline-flex items-center px-1 py-0.5 mx-0.5 rounded text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
      >
        #{channelName}
      </span>
    );
  }
  return null;
}

// Parse message content and replace mentions with styled components
function parseMessageContent(
  content: string, 
  mentionLookup: MentionLookup,
  onMentionClick: (type: 'user' | 'role' | 'channel', id: string, event: React.MouseEvent) => void
) {
  if (!content) return null;
  
  const mentionPattern = /<@!?(\d+)>|<@&(\d+)>|<#(\d+)>/g;
  
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  
  while ((match = mentionPattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.substring(lastIndex, match.index));
    }
    
    if (match[1]) {
      const userId = match[1];
      parts.push(
        <Mention 
          key={key++} 
          type="user" 
          id={userId} 
          mentionLookup={mentionLookup}
          onClick={(e) => onMentionClick('user', userId, e)}
        />
      );
    } else if (match[2]) {
      const roleId = match[2];
      parts.push(
        <Mention 
          key={key++} 
          type="role" 
          id={roleId} 
          mentionLookup={mentionLookup}
          onClick={(e) => onMentionClick('role', roleId, e)}
        />
      );
    } else if (match[3]) {
      const channelId = match[3];
      parts.push(
        <Mention 
          key={key++} 
          type="channel" 
          id={channelId} 
          mentionLookup={mentionLookup}
          onClick={(e) => onMentionClick('channel', channelId, e)}
        />
      );
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  if (lastIndex < content.length) {
    parts.push(content.substring(lastIndex));
  }
  
  return parts.length > 0 ? parts : content;
}

function MessagesPageContent() {
  const searchParams = useSearchParams();
  
  // Get initial values from URL
  const urlQuery = searchParams.get('q');
  
  const [searchQuery, setSearchQuery] = useState(urlQuery || '');
  const [staffOnly, setStaffOnly] = useState(false);
  const [userModalData, setUserModalData] = useState<UserModalData | null>(null);
  const [roleModalData, setRoleModalData] = useState<RoleModalData | null>(null);
  const [channelModalData, setChannelModalData] = useState<ChannelModalData | null>(null);
  const [page, setPage] = useState(1);
  
  const debouncedQuery = useDebounce(searchQuery, 150);
  
  // Reset page when search params change
  const prevQueryRef = useRef(debouncedQuery);
  const prevStaffOnlyRef = useRef(staffOnly);
  
  if (prevQueryRef.current !== debouncedQuery || prevStaffOnlyRef.current !== staffOnly) {
    setPage(1);
    prevQueryRef.current = debouncedQuery;
    prevStaffOnlyRef.current = staffOnly;
  }
  
  // Use TanStack Query hook for data fetching
  const { data, isLoading, error } = useMessages({
    q: debouncedQuery || undefined,
    staffOnly: staffOnly || undefined,
    page,
    limit: 50,
  });
  
  // Prefetch adjacent pages for instant navigation
  const { prefetchPage } = usePrefetchMessages({
    q: debouncedQuery || undefined,
    staffOnly: staffOnly || undefined,
    page,
    limit: 50,
  });

  // Prefetch user data on hover
  const { prefetchUser } = usePrefetchUser();

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
  
  // Extract data from the hook response
  const messages = data?.messages || [];
  const mentions = data?.mentions || { users: {}, roles: {}, channels: {} };
  const totalPages = data?.pagination.totalPages || 1;
  const total = data?.pagination.total || 0;
  const guildId = data?.guildId || null;
  
  const handleMentionClick = useCallback((type: 'user' | 'role' | 'channel', id: string, event: React.MouseEvent) => {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const position = {
      x: rect.left,
      y: rect.bottom,
    };

    if (type === 'user') {
      const userData = mentions.users[id];
      if (userData) {
        setUserModalData({ type: 'user', id, data: userData, position });
      }
    } else if (type === 'role') {
      const roleData = mentions.roles[id];
      if (roleData) {
        setRoleModalData({ type: 'role', id, data: roleData, position });
      }
    } else if (type === 'channel') {
      const channelData = mentions.channels[id];
      if (channelData) {
        setChannelModalData({ type: 'channel', id, data: channelData, position });
      }
    }
  }, [mentions]);

  // Handler for opening user popover from avatar click
  const handleUserClick = useCallback((
    e: React.MouseEvent,
    userId: string,
    userName: string,
    displayName: string | null,
    displayAvatar: string | null
  ) => {
    e.preventDefault();
    e.stopPropagation();
    
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setUserModalData({
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
  }, []);
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Render three separate popovers */}
      {userModalData && (
        <UserPopover 
          isOpen={true}
          onClose={() => setUserModalData(null)}
          triggerPosition={userModalData.position}
          userData={{
            id: userModalData.id,
            name: userModalData.data.name,
            displayName: userModalData.data.displayName,
            displayAvatar: userModalData.data.displayAvatar,
          }}
        />
      )}
      {roleModalData && (
        <RolePopover 
          isOpen={true}
          onClose={() => setRoleModalData(null)}
          triggerPosition={roleModalData.position}
          roleData={{
            id: roleModalData.id,
            name: roleModalData.data.name,
            color: roleModalData.data.color,
          }}
        />
      )}
      {channelModalData && (
        <ChannelPopover 
          isOpen={true}
          onClose={() => setChannelModalData(null)}
          triggerPosition={channelModalData.position}
          channelData={{
            id: channelModalData.id,
            name: channelModalData.data.name,
          }}
        />
      )}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Message Search
          </h1>
          <Link 
            href="/tickets"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Browse Tickets
          </Link>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Search through Discord messages
        </p>
        
        {/* Search Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Search Messages
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search message content..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={staffOnly}
                onChange={(e) => setStaffOnly(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                Staff Only
              </span>
            </label>
          </div>
          
          {total > 0 && (
            <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              Found {total.toLocaleString()} message{total !== 1 ? 's' : ''}
            </div>
          )}
        </div>
        
        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-800 dark:text-red-200">
              Error: {error.message}
            </p>
          </div>
        )}
        
        {/* Results */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-500 dark:text-gray-400">Loading messages...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="p-12 text-center text-gray-500 dark:text-gray-400">
              {debouncedQuery || staffOnly ? (
                <>
                  <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <p className="text-lg font-medium">No messages found</p>
                  <p className="text-sm mt-2">Try adjusting your search criteria</p>
                </>
              ) : (
                <>
                  <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="text-lg font-medium">Start searching</p>
                  <p className="text-sm mt-2">Enter a search term to find messages</p>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {messages.map((msg) => (
                  <div key={msg.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        {msg.author && (
                          <div
                            onClick={(e) => handleUserClick(
                              e,
                              msg.author!.id,
                              msg.author!.name,
                              msg.author!.displayName,
                              msg.author!.displayAvatar
                            )}
                            onMouseEnter={() => prefetchUser(msg.author!.id)}
                          >
                            <Avatar 
                              src={msg.author.displayAvatar}
                              name={msg.author.displayName || msg.author.name}
                              size={40}
                              onClick={(e) => handleUserClick(
                                e,
                                msg.author!.id,
                                msg.author!.name,
                                msg.author!.displayName,
                                msg.author!.displayAvatar
                              )}
                            />
                          </div>
                        )}
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {msg.author?.displayName || msg.author?.name || 'Unknown User'}
                          </span>
                          {msg.author?.displayName && msg.author?.name && msg.author.displayName !== msg.author.name && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              @{msg.author.name}
                            </span>
                          )}
                        </div>
                        {msg.author?.id === '1346564959835787284' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                            BOT
                          </span>
                        )}
                        {msg.isStaff && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                            STAFF
                          </span>
                        )}
                        {msg.ticket && (
                          <Link
                            href={`/tickets/${msg.ticket.id}`}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                          >
                            Ticket {msg.ticket.sequence !== null ? `#${msg.ticket.sequence}` : msg.ticket.id}
                          </Link>
                        )}
                        {msg.ticket?.status && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            msg.ticket.status === 'OPEN' 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : msg.ticket.status === 'CLOSED'
                              ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          }`}>
                            {msg.ticket.status}
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(msg.createdAt).toLocaleString()}
                      </span>
                    </div>
                    
                    <p className="text-gray-700 dark:text-gray-300 mb-3 whitespace-pre-wrap break-words">
                      {parseMessageContent(msg.content || '(No content)', mentions, handleMentionClick)}
                    </p>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      {msg.channel && (
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                          </svg>
                          {msg.channel.name}
                        </span>
                      )}
                      {msg.author && (
                        <span className="text-xs">
                          ID: {msg.author.id}
                        </span>
                      )}
                      {guildId && msg.channel && (
                        <a
                          href={`discord://discord.com/channels/${guildId}/${msg.channel.id}/${msg.id}`}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 rounded transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          Jump to Message
                        </a>
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
    </div>
  );
}

// Wrapper component with Suspense boundary
export default function MessagesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    }>
      <MessagesPageContent />
    </Suspense>
  );
}
