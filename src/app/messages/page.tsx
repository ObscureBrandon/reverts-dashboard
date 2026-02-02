'use client';

import { Avatar } from '@/app/components/Avatar';
import { NavigationHeader } from '@/app/components/navigation-header';
import { ChannelPopover } from '@/app/components/popovers/ChannelPopover';
import { RolePopover } from '@/app/components/popovers/RolePopover';
import { roleColorToHex } from '@/app/components/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useUserPanel } from '@/lib/contexts/user-panel-context';
import { useMessages, usePrefetchMessages } from '@/lib/hooks/queries/useMessages';
import { usePrefetchUserDetails } from '@/lib/hooks/queries/useUserDetails';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { ChevronLeft, ChevronRight, Loader2, MessageSquare, Search } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

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

type RoleModalData = { 
  type: 'role'; 
  id: string; 
  data: { name: string; color: number }; 
  position: { x: number; y: number; triggerWidth?: number; triggerHeight?: number } 
};

type ChannelModalData = { 
  type: 'channel'; 
  id: string; 
  data: { name: string }; 
  position: { x: number; y: number; triggerWidth?: number; triggerHeight?: number } 
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
  
  // Global panel context
  const { openUserPanel } = useUserPanel();
  
  const [searchQuery, setSearchQuery] = useState(urlQuery || '');
  const [staffOnly, setStaffOnly] = useState(false);
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
  const { data, isLoading, isFetching, error } = useMessages({
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

  // Prefetch user details on hover
  const { prefetch: prefetchUserDetails } = usePrefetchUserDetails();

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
    event.preventDefault();
    event.stopPropagation();
    
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const position = {
      x: rect.left,
      y: rect.bottom,
    };

    if (type === 'user') {
      // Use global panel instead of popover
      openUserPanel(id);
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
  }, [mentions, openUserPanel]);

  // Handler for opening user panel from avatar click
  const handleUserClick = useCallback((e: React.MouseEvent, userId: string) => {
    e.preventDefault();
    e.stopPropagation();
    openUserPanel(userId);
  }, [openUserPanel]);
  
  return (
    <div className="min-h-screen bg-background">
      <NavigationHeader />
      {/* Role and Channel Popovers (keep these) */}
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
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">
            Message Search
          </h1>
          <div className="h-1 w-12 bg-emerald-500 rounded-full mt-2" />
          <p className="text-muted-foreground mt-2">
            Search through Discord messages
          </p>
        </div>
        
        {/* Search Bar */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
              <div className="flex-1 w-full">
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Search Messages
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search message content..."
                    className="pl-9"
                  />
                </div>
              </div>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={staffOnly}
                  onCheckedChange={(checked: boolean | 'indeterminate') => setStaffOnly(checked === true)}
                  className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                />
                <span className="text-sm font-medium text-foreground whitespace-nowrap">
                  Staff Only
                </span>
              </label>
            </div>
            
            {total > 0 && (
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>
                  Found <span className="font-medium text-foreground">{total.toLocaleString()}</span> message{total !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Error Message */}
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 mb-6">
            <p className="text-destructive text-sm">
              Error: {error.message}
            </p>
          </div>
        )}
        
        {/* Results */}
        <Card className="overflow-hidden relative">
          {/* Accent gradient at top */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500/30 via-emerald-500 to-emerald-500/30" />
          
          {isLoading ? (
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                <p className="text-muted-foreground">Loading messages...</p>
              </div>
            </CardContent>
          ) : messages.length === 0 ? (
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center gap-3">
                {debouncedQuery || staffOnly ? (
                  <>
                    <div className="p-4 rounded-full bg-muted">
                      <Search className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-lg font-medium text-foreground">No messages found</p>
                    <p className="text-sm text-muted-foreground">Try adjusting your search criteria</p>
                  </>
                ) : (
                  <>
                    <div className="p-4 rounded-full bg-emerald-50 dark:bg-emerald-950/50">
                      <MessageSquare className="h-8 w-8 text-emerald-500" />
                    </div>
                    <p className="text-lg font-medium text-foreground">Start searching</p>
                    <p className="text-sm text-muted-foreground">Enter a search term to find messages</p>
                  </>
              )}
              </div>
            </CardContent>
          ) : (
            <>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {messages.map((msg) => (
                  <div key={msg.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        {msg.author && (
                          <div className="flex items-center gap-2">
                            <div 
                              className="cursor-pointer"
                              onClick={(e) => handleUserClick(e, msg.author!.id)}
                              onMouseEnter={() => prefetchUserDetails(msg.author!.id)}
                            >
                              <Avatar 
                                src={msg.author.displayAvatar}
                                name={msg.author.displayName || msg.author.name}
                                size={40}
                              />
                            </div>
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
                <div className="p-4 border-t border-border flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page <span className="font-medium text-foreground">{page}</span> of{' '}
                    <span className="font-medium text-foreground">{totalPages}</span>
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1 || isLoading}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-1.5 px-2 text-sm">
                      <span className="font-medium px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                        {page}
                      </span>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-muted-foreground">{totalPages}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages || isLoading}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

// Wrapper component with Suspense boundary
export default function MessagesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background">
        <NavigationHeader />
        <div className="flex items-center justify-center pt-32">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mx-auto mb-4" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <MessagesPageContent />
    </Suspense>
  );
}
