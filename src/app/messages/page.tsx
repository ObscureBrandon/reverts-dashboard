'use client';

import { NavigationHeader } from '@/app/components/navigation-header';
import { PageHeader } from '@/app/components/page-header';
import { ChannelPopover } from '@/app/components/popovers/ChannelPopover';
import type { Position } from '@/app/components/popovers/PopoverWrapper';
import { RolePopover } from '@/app/components/popovers/RolePopover';
import { UserAvatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MessageContent } from '@/components/ui/message-content';
import { useUserPanel } from '@/lib/contexts/user-panel-context';
import { useMessages, usePrefetchMessages } from '@/lib/hooks/queries/useMessages';
import { usePrefetchUserDetails } from '@/lib/hooks/queries/useUserDetails';
import { useUserRole } from '@/lib/hooks/queries/useUserRole';
import { getTicketStatusDescriptor } from '@/lib/status-system';
import { cn, formatRelativeTime } from '@/lib/utils';
import { useDebouncedCallback } from '@tanstack/react-pacer';
import { ChevronLeft, ChevronRight, ExternalLink, Hash, MessageSquare, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import MessagesPageSkeleton, { MessagesResultsSkeleton } from './skeleton';

const searchParamsSchema = {
  page: parseAsInteger.withDefault(1),
  q: parseAsString.withDefault(''),
};

type RoleModalData = { 
  type: 'role'; 
  id: string; 
  data: { name: string; color: number }; 
  position: Position 
};

type ChannelModalData = { 
  type: 'channel'; 
  id: string; 
  data: { name: string }; 
  position: Position 
};

function formatMessageTimestamp(value: string) {
  return new Date(value).toLocaleString();
}

function MessagesPageContent() {
  const router = useRouter();
  const { isMod, isLoading: roleLoading } = useUserRole();
  const [params, setParams] = useQueryStates(searchParamsSchema, {
    history: 'replace',
    shallow: true,
    throttleMs: 50,
  });
  
  // Global panel context
  const { openUserPanel } = useUserPanel();
  
  const [roleModalData, setRoleModalData] = useState<RoleModalData | null>(null);
  const [channelModalData, setChannelModalData] = useState<ChannelModalData | null>(null);
  const [expandedMessageIds, setExpandedMessageIds] = useState<Set<string>>(() => new Set());
  const page = params.page;

  const debouncedSearch = useDebouncedCallback(
    (query: string) => {
      setParams({ q: query || null, page: 1 });
    },
    { wait: 150 }
  );

  const handleSearch = useCallback((query: string) => {
    debouncedSearch(query);
  }, [debouncedSearch]);

  const handlePageChange = useCallback((nextPage: number) => {
    setParams({ page: nextPage === 1 ? null : nextPage });
  }, [setParams]);

  const toggleExpandedMessage = useCallback((messageId: string) => {
    setExpandedMessageIds((current) => {
      const next = new Set(current);

      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }

      return next;
    });
  }, []);
  
  // Use TanStack Query hook for data fetching
  const { data, isLoading, isFetching, error } = useMessages({
    q: params.q || undefined,
    page,
    limit: 50,
  });
  
  // Prefetch adjacent pages for instant navigation
  const { prefetchPage } = usePrefetchMessages({
    q: params.q || undefined,
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
  const mentions = useMemo(() => data?.mentions || { users: {}, roles: {}, channels: {} }, [data?.mentions]);
  const totalPages = data?.pagination.totalPages || 1;
  const total = data?.pagination.total || 0;
  const guildId = data?.guildId || null;
  const hasActiveQuery = Boolean(params.q);
  
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
  
  // Redirect to my-tickets if not a mod
  useEffect(() => {
    if (!roleLoading && !isMod) {
      router.replace('/my-tickets');
    }
  }, [isMod, roleLoading, router]);

  if (roleLoading) {
    return <MessagesPageSkeleton />;
  }

  // Don't render content if redirecting
  if (!roleLoading && !isMod) {
    return <MessagesPageSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      <NavigationHeader />
      {/* Role and Channel Popovers (keep these) */}
      {roleModalData && (
        <RolePopover 
          isOpen={true}
          onClose={() => setRoleModalData(null)}
          triggerElement={null}
          triggerRect={roleModalData.position}
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
          triggerElement={null}
          triggerRect={channelModalData.position}
          channelData={{
            id: channelModalData.id,
            name: channelModalData.data.name,
          }}
        />
      )}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <PageHeader
          title="Messages"
          utility={
            <div className="space-y-3 pt-2 sm:pt-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  key={params.q}
                  type="text"
                  defaultValue={params.q}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search by username, Discord ID, or message content..."
                  className="h-10 bg-background pl-9"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {hasActiveQuery ? (
                  <span>
                    <span className="font-medium text-foreground">{total.toLocaleString()}</span> matching message{total === 1 ? '' : 's'}
                  </span>
                ) : null}
              </div>
            </div>
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
        
        {/* Results */}
        <Card className="relative gap-0 overflow-hidden border-border py-0 shadow-sm">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brand-accent-solid/30 via-brand-accent-solid to-brand-accent-solid/30" />
          
          {isLoading || isFetching ? (
            <MessagesResultsSkeleton />
          ) : messages.length === 0 ? (
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center gap-3">
                {params.q ? (
                  <>
                    <div className="p-4 rounded-full bg-muted">
                      <Search className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-lg font-medium text-foreground">No messages found</p>
                    <p className="text-sm text-muted-foreground">Try adjusting your search criteria</p>
                  </>
                ) : (
                  <>
                    <div className="rounded-full bg-brand-accent-soft p-4">
                      <MessageSquare className="h-8 w-8 text-brand-accent-text" />
                    </div>
                    <p className="text-lg font-medium text-foreground">Start searching</p>
                    <p className="text-sm text-muted-foreground">Enter a username, Discord ID, or message phrase to find relevant results.</p>
                  </>
                )}
              </div>
            </CardContent>
          ) : (
            <>
              <div className="divide-y divide-border">
                {messages.map((msg) => {
                  const isExpanded = expandedMessageIds.has(msg.id);
                  const isExpandable = (msg.content?.length ?? 0) > 280;

                  return (
                    <div key={msg.id} className="p-5 transition-colors hover:bg-muted/35 sm:p-6">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="flex items-start gap-3">
                            {msg.author ? (
                              <div
                                className="cursor-pointer"
                                onClick={(e) => handleUserClick(e, msg.author!.id)}
                                onMouseEnter={() => prefetchUserDetails(msg.author!.id)}
                              >
                                <UserAvatar
                                  src={msg.author.displayAvatar}
                                  name={msg.author.displayName || msg.author.name}
                                  size="lg"
                                  className="border border-border"
                                />
                              </div>
                            ) : null}

                            <div className="min-w-0 flex-1 space-y-3">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0 space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="truncate text-base font-semibold text-foreground">
                                      {msg.author?.displayName || msg.author?.name || 'Unknown User'}
                                    </span>
                                    {msg.author?.id === '1346564959835787284' ? (
                                      <Badge tone="info" kind="attribute" emphasis="soft">
                                        Bot
                                      </Badge>
                                    ) : null}
                                    {msg.isStaff ? (
                                      <Badge tone="neutral" kind="attribute" emphasis="soft">
                                        Staff
                                      </Badge>
                                    ) : null}
                                  </div>
                                  {msg.author?.displayName && msg.author?.name && msg.author.displayName !== msg.author.name ? (
                                    <span className="block truncate text-xs text-muted-foreground">
                                      @{msg.author.name}
                                    </span>
                                  ) : null}
                                </div>

                                <div className="text-sm text-muted-foreground lg:text-right">
                                  <p className="font-medium text-foreground">{formatRelativeTime(msg.createdAt)}</p>
                                  <p>{formatMessageTimestamp(msg.createdAt)}</p>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5">
                                {msg.ticket ? (
                                  <Badge asChild tone="info" kind="meta" emphasis="soft">
                                    <Link href={`/tickets/${msg.ticket.id}`}>
                                      Ticket {msg.ticket.sequence !== null ? `#${msg.ticket.sequence}` : msg.ticket.id}
                                    </Link>
                                  </Badge>
                                ) : null}
                                {msg.ticket?.status ? (
                                  <Badge
                                    tone={getTicketStatusDescriptor(msg.ticket.status).tone}
                                    kind={getTicketStatusDescriptor(msg.ticket.status).kind}
                                    emphasis={getTicketStatusDescriptor(msg.ticket.status).emphasis}
                                  >
                                    {getTicketStatusDescriptor(msg.ticket.status).label}
                                  </Badge>
                                ) : null}
                                {msg.channel ? (
                                  <Badge tone="neutral" kind="meta" emphasis="outline" className="gap-1.5">
                                    <Hash className="h-3 w-3" />
                                    {msg.channel.name}
                                  </Badge>
                                ) : null}
                              </div>

                              <div className="space-y-2">
                                <div
                                  className={cn(
                                    'relative text-sm leading-6 text-foreground whitespace-pre-wrap break-words',
                                    !isExpanded && isExpandable && 'max-h-24 overflow-hidden'
                                  )}
                                >
                                  <MessageContent
                                    content={msg.content || '(No content)'}
                                    mentions={mentions}
                                    onMentionClick={handleMentionClick}
                                    className="text-sm leading-6 text-foreground"
                                  />
                                  {!isExpanded && isExpandable ? (
                                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card via-card/95 to-transparent" />
                                  ) : null}
                                </div>

                                {isExpandable ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleExpandedMessage(msg.id)}
                                    className="text-xs font-medium text-brand-accent-text hover:underline"
                                  >
                                    {isExpanded ? 'Show less' : 'Show full message'}
                                  </button>
                                ) : null}
                              </div>

                              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                {msg.author ? (
                                  <Badge tone="neutral" kind="meta" emphasis="outline">
                                    ID: {msg.author.id}
                                  </Badge>
                                ) : null}
                                {guildId && msg.channel ? (
                                  <Button asChild variant="outline" size="xs">
                                    <a href={`discord://discord.com/channels/${guildId}/${msg.channel.id}/${msg.id}`}>
                                      <ExternalLink className="h-3 w-3" />
                                      Jump to Message
                                    </a>
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
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
                      onClick={() => handlePageChange(Math.max(1, page - 1))}
                      disabled={page === 1 || isLoading}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-1.5 px-2 text-sm">
                      <Badge tone="brand" kind="meta" emphasis="soft">
                        {page}
                      </Badge>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-muted-foreground">{totalPages}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
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
    <Suspense fallback={<MessagesPageSkeleton />}>
      <MessagesPageContent />
    </Suspense>
  );
}
