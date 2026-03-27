'use client';

/* eslint-disable @next/next/no-img-element */

import { NavigationHeader } from '@/app/components/navigation-header';
import { PageHeader } from '@/app/components/page-header';
import { ChannelPopover } from '@/app/components/popovers/ChannelPopover';
import { RolePopover } from '@/app/components/popovers/RolePopover';
import { AvatarGroup, AvatarGroupCount, UserAvatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { DeferredMessageContent, MessageContent, type MentionLookup } from '@/components/ui/message-content';
import { useGlobalSearchOverlay } from '@/lib/contexts/global-search-context';
import { useUserPanel } from '@/lib/contexts/user-panel-context';
import { useGenerateTicketSummary } from '@/lib/hooks/mutations/useTicketMutations';
import { useTicket, useTicketMessages } from '@/lib/hooks/queries/useTickets';
import { usePrefetchUserDetails } from '@/lib/hooks/queries/useUserDetails';
import { useUserRole } from '@/lib/hooks/queries/useUserRole';
import { getTicketStatusDescriptor } from '@/lib/status-system';
import { cn, formatRelativeTime } from '@/lib/utils';
import { ArrowLeft, Check, Clock3, Copy, ExternalLink, Hash, MessageSquare, Sparkles, Users } from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Position } from '@/app/components/popovers/PopoverWrapper';
import TicketDetailSkeleton from './skeleton';

type Message = {
  id: string;
  content: string;
  createdAt: string;
  isStaff: boolean;
  embeds?: unknown[];
  attachments?: string[];
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
};

// UserModalData type removed - using global panel context now

type RoleModalData = { 
  type: 'role'; 
  id: string; 
  data: { name: string; color: number }; 
  triggerElement: HTMLElement | null;
  triggerRect: Position;
};

type ChannelModalData = { 
  type: 'channel'; 
  id: string; 
  data: { name: string }; 
  triggerElement: HTMLElement | null;
  triggerRect: Position;
};

const BOT_AUTHOR_ID = '1346564959835787284';

function safeReturnHref(rawReturnTo: string | null, fallback: string) {
  if (!rawReturnTo || !rawReturnTo.startsWith('/')) {
    return fallback;
  }

  return rawReturnTo;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// Attachment helper functions
function getAttachmentType(url: string): 'image' | 'video' | 'audio' | 'document' | 'other' {
  const extension = url.split('.').pop()?.toLowerCase().split('?')[0];
  
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'];
  const videoExts = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'wmv'];
  const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'];
  const docExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'zip', 'rar', '7z'];
  
  if (extension && imageExts.includes(extension)) return 'image';
  if (extension && videoExts.includes(extension)) return 'video';
  if (extension && audioExts.includes(extension)) return 'audio';
  if (extension && docExts.includes(extension)) return 'document';
  
  return 'other';
}

function getAttachmentFileName(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const parts = pathname.split('/');
    const filename = parts[parts.length - 1];
    return decodeURIComponent(filename);
  } catch {
    return 'attachment';
  }
}

function AttachmentIcon({ type }: { type: string }) {
  const iconClass = "w-4 h-4";
  
  if (type === 'image') {
    return (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  }
  
  if (type === 'video') {
    return (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    );
  }
  
  if (type === 'audio') {
    return (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
    );
  }
  
  if (type === 'document') {
    return (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    );
  }
  
  return (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
    </svg>
  );
}

// Component to render message attachments
function MessageAttachments({ attachments }: { attachments: string[] }) {
  if (!attachments || attachments.length === 0) return null;
  
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {attachments.map((url, index) => {
        const type = getAttachmentType(url);
        const filename = getAttachmentFileName(url);
        
        // Render images and videos as previews
        if (type === 'image') {
          return (
            <a 
              key={index}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="block max-w-md hover:opacity-90 transition-opacity"
            >
              <img 
                src={url} 
                alt={filename}
                className="max-h-80 rounded-xl border border-border bg-muted/30 object-contain"
              />
            </a>
          );
        }
        
        if (type === 'video') {
          return (
            <video 
              key={index}
              src={url}
              controls
              className="max-h-80 max-w-md rounded-xl border border-border bg-muted/30"
            >
              Your browser does not support the video tag.
            </video>
          );
        }
        
        // Render other file types as badges with icons
        return (
          <a
            key={index}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm transition-colors hover:bg-muted"
          >
            <AttachmentIcon type={type} />
            <span className="font-medium truncate max-w-xs">{filename}</span>
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </a>
        );
      })}
    </div>
  );
}

// Discord Embed Component
type DiscordEmbed = {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  author?: {
    name?: string;
    icon_url?: string;
    url?: string;
  };
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  image?: {
    url?: string;
  };
  thumbnail?: {
    url?: string;
  };
  footer?: {
    text?: string;
    icon_url?: string;
  };
  timestamp?: string;
};

function isDiscordEmbed(value: unknown): value is DiscordEmbed {
  return typeof value === 'object' && value !== null;
}

function DiscordEmbedDisplay({ 
  embed, 
  mentions, 
  onMentionClick,
  onUserMentionHover
}: { 
  embed: DiscordEmbed;
  mentions: MentionLookup;
  onMentionClick: (type: 'user' | 'role' | 'channel', id: string, event: React.MouseEvent) => void;
  onUserMentionHover?: (userId: string) => void;
}) {
  // Convert Discord color integer to hex
  const embedColor = embed.color 
    ? `#${embed.color.toString(16).padStart(6, '0')}`
    : '#5865F2'; // Discord blurple default

  return (
    <div className="mt-2 max-w-[520px]">
      <div 
        className="overflow-hidden rounded-xl border border-border bg-muted/40"
        style={{ borderLeftColor: embedColor }}
      >
        <div className="border-l-4 p-3 space-y-2" style={{ borderLeftColor: embedColor }}>
          {/* Author */}
          {embed.author && (
            <div className="flex items-center gap-2">
              {embed.author.icon_url && (
                <img 
                  src={embed.author.icon_url} 
                  alt=""
                  className="h-6 w-6 rounded-full"
                />
              )}
              {embed.author.url ? (
                <a 
                  href={embed.author.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-foreground hover:underline"
                >
                  {embed.author.name}
                </a>
              ) : (
                <span className="text-sm font-semibold text-foreground">
                  {embed.author.name}
                </span>
              )}
            </div>
          )}

          {/* Title */}
          {embed.title && (
            <div>
              {embed.url ? (
                <a 
                  href={embed.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-base font-semibold text-brand-accent-text hover:underline"
                >
                  {embed.title}
                </a>
              ) : (
                <h3 className="text-base font-semibold text-foreground">
                  {embed.title}
                </h3>
              )}
            </div>
          )}

          {/* Description */}
          {embed.description && (
            <MessageContent
              content={embed.description}
              mentions={mentions}
              onMentionClick={onMentionClick}
              onUserMentionHover={onUserMentionHover}
              className="text-sm text-muted-foreground"
            />
          )}

          {/* Fields */}
          {embed.fields && embed.fields.length > 0 && (
            <div className="grid gap-2" style={{ 
              gridTemplateColumns: embed.fields.some(f => f.inline) ? 'repeat(auto-fit, minmax(150px, 1fr))' : '1fr'
            }}>
              {embed.fields.map((field, idx) => (
                <div 
                  key={idx}
                  className={field.inline ? '' : 'col-span-full'}
                >
                  <MessageContent
                    content={field.name}
                    mentions={mentions}
                    onMentionClick={onMentionClick}
                    onUserMentionHover={onUserMentionHover}
                    className="text-sm font-semibold text-foreground"
                  />
                  <MessageContent
                    content={field.value}
                    mentions={mentions}
                    onMentionClick={onMentionClick}
                    onUserMentionHover={onUserMentionHover}
                    className="text-sm text-muted-foreground"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Thumbnail */}
          {embed.thumbnail?.url && (
            <div className="flex justify-end">
              <img 
                src={embed.thumbnail.url}
                alt=""
                className="max-w-[80px] max-h-[80px] rounded object-cover"
              />
            </div>
          )}

          {/* Image */}
          {embed.image?.url && (
            <img 
              src={embed.image.url}
              alt=""
              className="max-w-full rounded"
            />
          )}

          {/* Footer */}
          {(embed.footer || embed.timestamp) && (
            <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
              {embed.footer?.icon_url && (
                <img 
                  src={embed.footer.icon_url}
                  alt=""
                  className="h-5 w-5 rounded-full"
                />
              )}
              <span>
                {embed.footer?.text}
                {embed.footer?.text && embed.timestamp && ' • '}
                {embed.timestamp && new Date(embed.timestamp).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



// Format date headers
function formatDateHeader(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }
}

// Group messages by date
function groupMessagesByDate(messages: Message[]): Map<string, Message[]> {
  const groups = new Map<string, Message[]>();
  
  messages.forEach(msg => {
    const date = new Date(msg.createdAt);
    const dateKey = date.toDateString();
    
    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(msg);
  });
  
  return groups;
}

function JumpToMessageLink({
  guildId,
  channelId,
  messageId,
  className,
  compact = false,
}: {
  guildId: string;
  channelId: string;
  messageId: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <a
      href={`discord://discord.com/channels/${guildId}/${channelId}/${messageId}`}
      className={cn(
        compact
          ? 'inline-flex h-7 w-7 items-center justify-center rounded-md text-brand-accent-text transition-colors hover:bg-muted/70'
          : 'inline-flex items-center gap-1 text-xs font-medium text-brand-accent-text transition-opacity',
        className,
      )}
      aria-label="Open message in Discord"
    >
      <ExternalLink className="h-3 w-3" />
      {compact ? null : 'Jump to Message'}
    </a>
  );
}

export default function TicketDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const ticketId = params.id as string;
  const { isOpen: isGlobalSearchOpen } = useGlobalSearchOverlay();
  
  const [roleModalData, setRoleModalData] = useState<RoleModalData | null>(null);
  const [channelModalData, setChannelModalData] = useState<ChannelModalData | null>(null);
  
  const [copiedLink, setCopiedLink] = useState(false);
  
  // Role-based access
  const { isMod, discordId, isLoading: roleLoading } = useUserRole();
  
  // Global panel context (mod-only feature)
  const { openUserPanel } = useUserPanel();
  
  // Use TanStack Query hooks for data fetching
  const { data: ticketData, isLoading: ticketLoading, error: ticketError } = useTicket(ticketId);
  const { data: messagesData, isLoading: messagesLoading, error: messagesError } = useTicketMessages(ticketId);
  const { mutate: generateSummary, isPending: generatingSummary, error: summaryMutationError } = useGenerateTicketSummary(ticketId);
  const { prefetch: prefetchUserDetails } = usePrefetchUserDetails();
  
  // Extract data from hook responses
  const ticket = ticketData?.ticket || null;
  const messages = useMemo(() => messagesData?.messages ?? [], [messagesData?.messages]);
  const mentions = useMemo(() => messagesData?.mentions || { users: {}, roles: {}, channels: {} }, [messagesData?.mentions]);
  const guildId = messagesData?.guildId || null;
  
  // Combined loading and error states
  const loading = ticketLoading || messagesLoading || roleLoading;
  const error = ticketError || messagesError;
  const summaryError = summaryMutationError?.message || null;

  // Back link: mods go to /tickets, users go to /my-tickets
  const fallbackBackHref = isMod ? '/tickets' : '/my-tickets';
  const backHref = safeReturnHref(searchParams.get('returnTo'), fallbackBackHref);
  const backLabel = isMod ? 'Back to Tickets' : 'Back to My Tickets';
  const targetMessageId = searchParams.get('message');
  const highlightTerm = searchParams.get('highlight');
  const statusDescriptor = getTicketStatusDescriptor(ticket?.status);
  const primarySummaryActionLabel = generatingSummary
    ? 'Generating...'
    : ticket?.summary
      ? 'Regenerate Summary'
      : 'Generate Summary';
  const canGenerateSummary = messages.length > 0;
  const hasSummary = Boolean(ticket?.summary?.trim());
  const hasSummaryMeta = Boolean(ticket?.summaryGeneratedAt || ticket?.summaryModel || ticket?.summaryTokensUsed);
  const useCompactEmptySummary = !hasSummary && !hasSummaryMeta && !generatingSummary && !summaryError;
  const participants = useMemo(() => {
    const uniqueParticipants = new Map<string, NonNullable<Message['author']>>();

    messages.forEach((message) => {
      if (!message.author || message.author.id === BOT_AUTHOR_ID || uniqueParticipants.has(message.author.id)) {
        return;
      }

      uniqueParticipants.set(message.author.id, message.author);
    });

    return Array.from(uniqueParticipants.values());
  }, [messages]);
  const visibleParticipants = participants.slice(0, 4);
  const hiddenParticipantCount = Math.max(participants.length - visibleParticipants.length, 0);
  const ticketAuthor = ticket?.author ?? null;
  const ticketAuthorId = ticket?.author?.id;

  useEffect(() => {
    if (!targetMessageId || messages.length === 0) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      const targetElement = document.getElementById(`message-${targetMessageId}`)
      targetElement?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 150)

    return () => window.clearTimeout(timeoutId)
  }, [messages.length, targetMessageId])

  
  const handleMentionClick = useCallback((type: 'user' | 'role' | 'channel', id: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const triggerElement = event.currentTarget as HTMLElement;
    const rect = triggerElement.getBoundingClientRect();
    const triggerRect: Position = {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
      right: rect.right,
      bottom: rect.bottom,
    };

    if (type === 'user') {
      // Use global panel instead of popover
      openUserPanel(id);
    } else if (type === 'role') {
      const roleData = mentions.roles[id];
      if (roleData) {
        setRoleModalData({ type: 'role', id, data: roleData, triggerElement, triggerRect });
      }
    } else if (type === 'channel') {
      const channelData = mentions.channels[id];
      if (channelData) {
        setChannelModalData({ type: 'channel', id, data: channelData, triggerElement, triggerRect });
      }
    }
  }, [mentions, openUserPanel]);
  
  const handleGenerateSummary = () => {
    generateSummary();
  };

  const handleCopyLink = useCallback(async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }, []);

  const messageGroups = useMemo(() => groupMessagesByDate(messages), [messages]);
  
  // While loading, show the skeleton UI
  if (loading) {
    return <TicketDetailSkeleton />;
  }
  
  // Access control: non-mods can only see their own tickets
  if (!loading && ticket && !isMod && ticket.author?.id !== discordId) {
    return (
      <div className="min-h-screen bg-background">
        <NavigationHeader />
        <div className="mx-auto max-w-5xl px-4 py-8">
          <PageHeader
            title="Access denied"
            description="You do not have permission to view this ticket."
            actions={(
              <Button asChild variant="outline">
                <Link href="/my-tickets">Back to My Tickets</Link>
              </Button>
            )}
          />
        </div>
      </div>
    );
  }

  // Show error only if we have an actual error or ticket doesn't exist after loading
  if (error || !ticket) {
    return (
      <div className="min-h-screen bg-background">
        <NavigationHeader />
        <div className="mx-auto max-w-5xl px-4 py-8">
          <PageHeader
            title="Ticket not found"
            description={error?.message || 'The ticket you are looking for does not exist.'}
            actions={(
              <Button asChild variant="outline">
                <Link href={backHref}>{backLabel}</Link>
              </Button>
            )}
          />
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background">
      <NavigationHeader />
      
      {roleModalData && (
        <RolePopover
          isOpen={true}
          onClose={() => setRoleModalData(null)}
          triggerElement={roleModalData.triggerElement}
          triggerRect={roleModalData.triggerRect}
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
          triggerElement={channelModalData.triggerElement}
          triggerRect={channelModalData.triggerRect}
          channelData={{
            id: channelModalData.id,
            name: channelModalData.data.name,
          }}
        />
      )}
      
      <div className="mx-auto max-w-7xl px-4 py-8">
        <PageHeader
          title={`Ticket #${ticket.sequence !== null ? ticket.sequence : ticket.id}`}
          context={(
            <Badge tone={statusDescriptor.tone} kind={statusDescriptor.kind} emphasis={statusDescriptor.emphasis}>
              {statusDescriptor.label}
            </Badge>
          )}
          actions={(
            <>
              <Button asChild variant="outline">
                <Link href={backHref}>
                  <ArrowLeft className="h-4 w-4" />
                  {backLabel}
                </Link>
              </Button>
              <Button onClick={handleCopyLink} variant="outline">
                {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiedLink ? 'Copied' : 'Copy Link'}
              </Button>
            </>
          )}
        />

        <div className="mt-0 space-y-6">
          <Card className="gap-0 border-border py-0 shadow-sm">
            <CardContent className="px-6 py-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:flex xl:flex-nowrap xl:items-stretch xl:overflow-hidden">
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 xl:w-[220px] xl:shrink-0">
                  <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    Opened by
                  </div>
                  <div
                    className={cn('mt-1 flex min-w-0 items-center gap-2.5', isMod && ticketAuthor && 'cursor-pointer')}
                    onClick={isMod && ticketAuthorId ? (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openUserPanel(ticketAuthorId);
                    } : undefined}
                    onMouseEnter={isMod && ticketAuthorId ? () => prefetchUserDetails(ticketAuthorId) : undefined}
                  >
                    <UserAvatar
                      src={ticketAuthor?.displayAvatar}
                      name={ticketAuthor?.displayName || ticketAuthor?.name || 'Unknown User'}
                      size="sm"
                      className="shrink-0 border border-border"
                    />
                    <p className="truncate text-sm font-medium text-foreground">
                      {ticketAuthor?.displayName || ticketAuthor?.name || 'Unknown User'}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 xl:w-[180px] xl:shrink-0">
                    <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5" />
                      Created
                    </div>
                    <p className="mt-1 text-sm font-medium text-foreground">{formatDateTime(ticket.createdAt)}</p>
                </div>

                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 xl:w-[120px] xl:shrink-0">
                    <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      <MessageSquare className="h-3.5 w-3.5" />
                      Messages
                    </div>
                    <p className="mt-1 text-sm font-medium text-foreground">{ticket.messageCount}</p>
                </div>

                {ticket.closedAt ? (
                  <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 xl:w-[180px] xl:shrink-0">
                    <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5" />
                      Closed
                    </div>
                    <p className="mt-1 text-sm font-medium text-foreground">{formatDateTime(ticket.closedAt)}</p>
                  </div>
                ) : null}

                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 xl:w-[180px] xl:shrink-0">
                    <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      <Hash className="h-3.5 w-3.5" />
                      Channel
                    </div>
                    <p className="mt-1 truncate text-sm font-medium text-foreground">{ticket.channel ? `#${ticket.channel.name}` : 'No channel recorded'}</p>
                </div>

                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 xl:w-[220px] xl:shrink-0">
                    <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      Participants
                    </div>

                    {participants.length > 0 ? (
                      <div className="mt-1 flex min-w-0 items-center justify-between gap-3">
                        <p className="truncate text-sm font-medium text-foreground">
                          {participants.length} participant{participants.length === 1 ? '' : 's'}
                        </p>

                        <AvatarGroup className="shrink-0">
                          {visibleParticipants.map((participant) => {
                            const participantName = participant.displayName || participant.name;

                            return (
                              <UserAvatar
                                key={participant.id}
                                src={participant.displayAvatar}
                                name={participantName}
                                size="sm"
                                className={cn('border border-border', isMod && 'cursor-pointer')}
                                onClick={isMod ? (e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  openUserPanel(participant.id);
                                } : undefined}
                                onMouseEnter={isMod ? () => prefetchUserDetails(participant.id) : undefined}
                              />
                            );
                          })}

                          {hiddenParticipantCount > 0 ? (
                            <AvatarGroupCount>+{hiddenParticipantCount}</AvatarGroupCount>
                          ) : null}
                        </AvatarGroup>
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">No recorded authors</p>
                    )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="gap-0 border-border py-0 shadow-sm">
            <CardHeader className={cn('border-b border-border px-6', useCompactEmptySummary ? 'py-4' : 'py-5')}>
              <CardTitle>AI Summary</CardTitle>
            </CardHeader>

            {hasSummary ? (
              <CardContent className="px-6 py-6">
                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground/90">
                  {ticket.summary}
                </p>
              </CardContent>
            ) : generatingSummary ? (
              <CardContent className="px-6 py-4">
                <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                  Generating summary from the current transcript...
                </div>
              </CardContent>
            ) : summaryError ? (
              <CardContent className="px-6 py-4">
                <div className="rounded-lg border border-status-danger-border bg-status-danger-soft px-4 py-3 text-sm text-status-danger-text">
                  {summaryError}
                </div>
              </CardContent>
            ) : useCompactEmptySummary ? (
              <CardContent className="px-6 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">No summary generated yet.</p>
                  {isMod ? (
                    <Button
                      onClick={handleGenerateSummary}
                      disabled={!canGenerateSummary}
                      size="sm"
                    >
                      <Sparkles className="h-4 w-4" />
                      {primarySummaryActionLabel}
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            ) : null}

            {(hasSummary || generatingSummary || summaryError || hasSummaryMeta) ? (
              <CardFooter className="flex flex-wrap items-center gap-2 border-t border-border px-6 py-4">
                {ticket.summaryGeneratedAt ? (
                  <Badge tone="neutral" kind="meta" emphasis="outline">Updated {formatRelativeTime(ticket.summaryGeneratedAt)}</Badge>
                ) : null}
                {ticket.summaryModel ? (
                  <Badge tone="neutral" kind="meta" emphasis="outline">{ticket.summaryModel}</Badge>
                ) : null}
                {ticket.summaryTokensUsed ? (
                  <Badge tone="neutral" kind="meta" emphasis="outline">~{ticket.summaryTokensUsed} tokens</Badge>
                ) : null}
                {isMod ? (
                  <Button
                    onClick={handleGenerateSummary}
                    disabled={generatingSummary || !canGenerateSummary}
                    className="ml-auto"
                    size="sm"
                  >
                    <Sparkles className="h-4 w-4" />
                    {primarySummaryActionLabel}
                  </Button>
                ) : null}
              </CardFooter>
            ) : null}
          </Card>

          <Card className="relative gap-0 overflow-hidden border-border py-0 shadow-sm">
            <div className="absolute left-0 right-0 top-0 h-0.5 bg-gradient-to-r from-brand-accent-solid/30 via-brand-accent-solid to-brand-accent-solid/30" />
            <CardHeader className="border-b border-border px-6 py-5">
              <CardTitle>Transcript</CardTitle>
            </CardHeader>

            <CardContent className="px-6 py-6">
              {messages.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
                  <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground" />
                  <p className="mt-4 font-medium text-foreground">No transcript messages yet</p>
                  <p className="mt-2 text-sm text-muted-foreground">This ticket does not have any recorded conversation history.</p>
                </div>
              ) : (
                Array.from(messageGroups.entries()).map(([dateKey, dateMessages]) => (
                  <div key={dateKey}>
                    <div className="flex items-center justify-center gap-3 py-2">
                      <div className="h-px flex-1 bg-border" />
                      <Badge tone="neutral" kind="meta" emphasis="outline">{formatDateHeader(new Date(dateKey))}</Badge>
                      <div className="h-px flex-1 bg-border" />
                    </div>

                    {dateMessages.map((msg, idx) => {
                      const prevMsg = idx > 0 ? dateMessages[idx - 1] : null;
                      const jumpGuildId = guildId;
                      const jumpChannelId = msg.channel?.id ?? null;
                      const hasJumpLink = Boolean(jumpGuildId && jumpChannelId);
                      const isGrouped = prevMsg && 
                        prevMsg.author?.id === msg.author?.id && 
                        (new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime()) < 5 * 60 * 1000;

                      return (
                        <div
                          key={msg.id}
                          id={`message-${msg.id}`}
                          className={cn(
                            'group rounded-xl px-3 transition-colors hover:bg-muted/40',
                            targetMessageId === msg.id && 'bg-brand-accent-soft/70 ring-1 ring-brand-accent-border',
                            isGrouped ? 'mt-0.5 py-1' : 'mt-3 py-2.5',
                          )}
                        >
                          {!isGrouped ? (
                            <div className="relative flex gap-3">
                              {hasJumpLink ? (
                                <JumpToMessageLink
                                  guildId={jumpGuildId!}
                                  channelId={jumpChannelId!}
                                  messageId={msg.id}
                                  className="absolute right-0 top-0 md:hidden"
                                  compact
                                />
                              ) : null}

                              {hasJumpLink ? (
                                <JumpToMessageLink
                                  guildId={jumpGuildId!}
                                  channelId={jumpChannelId!}
                                  messageId={msg.id}
                                  className="absolute right-0 top-0 hidden md:inline-flex md:opacity-0 md:group-hover:opacity-100"
                                />
                              ) : null}

                              {msg.author ? (
                                <div
                                  className={cn('flex-shrink-0 self-start', isMod && 'cursor-pointer')}
                                  onClick={isMod ? (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    openUserPanel(msg.author!.id);
                                  } : undefined}
                                  onMouseEnter={isMod ? () => prefetchUserDetails(msg.author!.id) : undefined}
                                >
                                  <UserAvatar
                                    src={msg.author.displayAvatar}
                                    name={msg.author.displayName || msg.author.name}
                                    size="lg"
                                    className="border border-border"
                                  />
                                </div>
                              ) : null}

                              <div className={cn('min-w-0 flex-1 md:pr-28', hasJumpLink && 'pr-10')}>
                                <div className="mb-1 flex flex-wrap items-center gap-2">
                                  <span className="font-semibold text-foreground">
                                    {msg.author?.displayName || msg.author?.name || 'Unknown User'}
                                  </span>
                                  {msg.author?.id === BOT_AUTHOR_ID ? (
                                    <Badge tone="info" kind="attribute" emphasis="soft">Bot</Badge>
                                  ) : null}
                                  {msg.isStaff ? (
                                    <Badge tone="neutral" kind="attribute" emphasis="soft">Staff</Badge>
                                  ) : null}
                                  <span className="text-xs text-muted-foreground">{formatTime(msg.createdAt)}</span>
                                </div>

                                <DeferredMessageContent
                                  content={highlightTerm && targetMessageId === msg.id && msg.content
                                    ? msg.content.replace(new RegExp(`(${highlightTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'), '==$1==')
                                    : msg.content || (msg.attachments?.length || msg.embeds?.length ? '' : '(No content)')}
                                  mentions={mentions}
                                  onMentionClick={handleMentionClick}
                                  onUserMentionHover={prefetchUserDetails}
                                  className="text-foreground/90"
                                  eager={idx < 12}
                                />

                                {msg.embeds && msg.embeds.length > 0 ? (
                                  <div className="space-y-2">
                                    {msg.embeds.filter(isDiscordEmbed).map((embed, embedIdx) => (
                                      <DiscordEmbedDisplay
                                        key={embedIdx}
                                        embed={embed}
                                        mentions={mentions}
                                        onMentionClick={handleMentionClick}
                                        onUserMentionHover={prefetchUserDetails}
                                      />
                                    ))}
                                  </div>
                                ) : null}

                                {msg.attachments && msg.attachments.length > 0 ? (
                                  <MessageAttachments attachments={msg.attachments} />
                                ) : null}

                              </div>
                            </div>
                          ) : (
                            <div className="relative flex gap-3">
                              {hasJumpLink ? (
                                <JumpToMessageLink
                                  guildId={jumpGuildId!}
                                  channelId={jumpChannelId!}
                                  messageId={msg.id}
                                  className="absolute right-0 top-0 md:hidden"
                                  compact
                                />
                              ) : null}

                              {hasJumpLink ? (
                                <JumpToMessageLink
                                  guildId={jumpGuildId!}
                                  channelId={jumpChannelId!}
                                  messageId={msg.id}
                                  className="absolute right-0 top-0 hidden md:inline-flex md:opacity-0 md:group-hover:opacity-100"
                                />
                              ) : null}

                              <div className="relative flex w-10 flex-shrink-0 items-start justify-center overflow-visible">
                                <span className="absolute right-0 top-0 whitespace-nowrap text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                                  {formatTime(msg.createdAt)}
                                </span>
                              </div>

                              <div className={cn('min-w-0 flex-1 md:pr-28', hasJumpLink && 'pr-10')}>
                                <DeferredMessageContent
                                  content={highlightTerm && targetMessageId === msg.id && msg.content
                                    ? msg.content.replace(new RegExp(`(${highlightTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'), '==$1==')
                                    : msg.content || (msg.attachments?.length || msg.embeds?.length ? '' : '(No content)')}
                                  mentions={mentions}
                                  onMentionClick={handleMentionClick}
                                  onUserMentionHover={prefetchUserDetails}
                                  className="text-foreground/90"
                                  eager={idx < 12}
                                />

                                {msg.embeds && msg.embeds.length > 0 ? (
                                  <div className="space-y-2">
                                    {msg.embeds.filter(isDiscordEmbed).map((embed, embedIdx) => (
                                      <DiscordEmbedDisplay
                                        key={embedIdx}
                                        embed={embed}
                                        mentions={mentions}
                                        onMentionClick={handleMentionClick}
                                        onUserMentionHover={prefetchUserDetails}
                                      />
                                    ))}
                                  </div>
                                ) : null}

                                {msg.attachments && msg.attachments.length > 0 ? (
                                  <MessageAttachments attachments={msg.attachments} />
                                ) : null}

                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {!isGlobalSearchOpen ? (
          <div className="sticky bottom-4 mt-6 rounded-2xl border border-border bg-background/95 p-3 shadow-lg backdrop-blur md:hidden">
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" className="flex-1">
                <Link href={backHref}>
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Link>
              </Button>
              <Button onClick={handleCopyLink} variant="outline" className="flex-1">
                {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiedLink ? 'Copied' : 'Copy Link'}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
