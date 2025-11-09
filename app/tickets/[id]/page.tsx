'use client';

import { useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTicket, useTicketMessages } from '@/lib/hooks/queries/useTickets';
import { usePrefetchUser } from '@/lib/hooks/queries/useUsers';
import { useGenerateTicketSummary } from '@/lib/hooks/mutations/useTicketMutations';
import TicketDetailSkeleton from './skeleton';
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
  embeds?: any[];
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
  messageCount: number;
  summary?: string | null;
  summaryGeneratedAt?: string | null;
  summaryModel?: string | null;
  summaryTokensUsed?: number | null;
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

// Sparkles Icon component for AI Summary
function SparklesIcon({ size = 40 }: { size?: number }) {
  return (
    <div 
      className="rounded-full flex items-center justify-center border-2 border-gray-200 dark:border-gray-700 flex-shrink-0 bg-gradient-to-br from-purple-500 to-blue-500"
      style={{ 
        width: `${size}px`, 
        height: `${size}px`,
      }}
    >
      <svg 
        className="text-white" 
        style={{ width: `${size * 0.6}px`, height: `${size * 0.6}px` }}
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
      </svg>
    </div>
  );
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

// Component to render a single mention
function Mention({ 
  type, 
  id, 
  mentionLookup,
  onClick,
  onMouseEnter
}: { 
  type: 'user' | 'role' | 'channel'; 
  id: string; 
  mentionLookup: MentionLookup;
  onClick: (e: React.MouseEvent) => void;
  onMouseEnter?: () => void;
}) {
  if (type === 'user') {
    const user = mentionLookup.users[id];
    const displayName = user?.displayName || user?.name || `Unknown User`;
    return (
      <span 
        onClick={onClick}
        onMouseEnter={onMouseEnter}
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
  onMentionClick: (type: 'user' | 'role' | 'channel', id: string, event: React.MouseEvent) => void,
  onUserMentionHover?: (userId: string) => void
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
          onMouseEnter={onUserMentionHover ? () => onUserMentionHover(userId) : undefined}
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
                className="rounded border border-gray-300 dark:border-gray-600 max-h-80 object-contain"
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
              className="rounded border border-gray-300 dark:border-gray-600 max-w-md max-h-80"
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
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 transition-colors text-sm"
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
        className="bg-gray-100 dark:bg-gray-800 border-l-4 rounded overflow-hidden"
        style={{ borderLeftColor: embedColor }}
      >
        <div className="p-3 space-y-2">
          {/* Author */}
          {embed.author && (
            <div className="flex items-center gap-2">
              {embed.author.icon_url && (
                <img 
                  src={embed.author.icon_url} 
                  alt=""
                  className="w-6 h-6 rounded-full"
                />
              )}
              {embed.author.url ? (
                <a 
                  href={embed.author.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-gray-900 dark:text-white hover:underline"
                >
                  {embed.author.name}
                </a>
              ) : (
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
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
                  className="text-base font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {embed.title}
                </a>
              ) : (
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  {embed.title}
                </h3>
              )}
            </div>
          )}

          {/* Description */}
          {embed.description && (
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
              {parseMessageContent(embed.description, mentions, onMentionClick, onUserMentionHover)}
            </p>
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
                  <div className="text-sm font-semibold text-gray-900 dark:text-white mb-0.5">
                    {parseMessageContent(field.name, mentions, onMentionClick, onUserMentionHover)}
                  </div>
                  <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                    {parseMessageContent(field.value, mentions, onMentionClick, onUserMentionHover)}
                  </div>
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
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 pt-1">
              {embed.footer?.icon_url && (
                <img 
                  src={embed.footer.icon_url}
                  alt=""
                  className="w-5 h-5 rounded-full"
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

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = params.id as string;
  
  const [userModalData, setUserModalData] = useState<UserModalData | null>(null);
  const [roleModalData, setRoleModalData] = useState<RoleModalData | null>(null);
  const [channelModalData, setChannelModalData] = useState<ChannelModalData | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Use TanStack Query hooks for data fetching
  const { data: ticketData, isLoading: ticketLoading, error: ticketError } = useTicket(ticketId);
  const { data: messagesData, isLoading: messagesLoading, error: messagesError } = useTicketMessages(ticketId);
  const { mutate: generateSummary, isPending: generatingSummary, error: summaryMutationError } = useGenerateTicketSummary(ticketId);
  const { prefetchUser } = usePrefetchUser();
  
  // Extract data from hook responses
  const ticket = ticketData?.ticket || null;
  const messages = messagesData?.messages || [];
  const mentions = messagesData?.mentions || { users: {}, roles: {}, channels: {} };
  const guildId = messagesData?.guildId || null;
  
  // Combined loading and error states
  const loading = ticketLoading || messagesLoading;
  const error = ticketError || messagesError;
  const summaryError = summaryMutationError?.message || null;

  
  const handleMentionClick = (type: 'user' | 'role' | 'channel', id: string, event: React.MouseEvent) => {
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
  };
  
  const handleGenerateSummary = () => {
    generateSummary();
  };
  
  // While loading, show the skeleton UI
  if (loading) {
    return <TicketDetailSkeleton />;
  }
  
  // Show error only if we have an actual error or ticket doesn't exist after loading
  if (error || !ticket) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <svg className="mx-auto h-12 w-12 text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Ticket Not Found</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error?.message || 'The ticket you are looking for does not exist.'}</p>
          <Link 
            href="/tickets"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Tickets
          </Link>
        </div>
      </div>
    );
  }
  
  const messageGroups = groupMessagesByDate(messages);
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
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
      
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Link 
                href="/tickets"
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                title="Back to tickets"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Ticket {ticket.sequence !== null ? `#${ticket.sequence}` : ticket.id}
                </h1>
                {ticket.channel && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    #{ticket.channel.name}
                  </p>
                )}
              </div>
              <span className={`inline-flex items-center px-2.5 py-1 rounded text-sm font-medium ${
                ticket.status === 'OPEN' 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : ticket.status === 'CLOSED'
                  ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
              }`}>
                {ticket.status}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const url = window.location.href;
                  navigator.clipboard.writeText(url);
                  alert('Link copied to clipboard!');
                }}
                className="px-3 py-2 text-sm bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 rounded-md font-medium transition-colors"
                title="Copy share link"
              >
                <svg className="w-4 h-4 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share
              </button>
            </div>
          </div>
          
          {/* Ticket metadata */}
          <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
            {ticket.author && (
              <div className="flex items-center gap-2">
                <Avatar 
                  src={ticket.author.displayAvatar}
                  name={ticket.author.displayName || ticket.author.name}
                  size={24}
                  onClick={(e) => {
                    // Try to get user data from mentions, fallback to ticket author data
                    const userData = mentions.users[ticket.author!.id] || {
                      name: ticket.author!.name,
                      displayName: ticket.author!.displayName,
                      displayAvatar: ticket.author!.displayAvatar
                    };
                    const rect = (e.target as HTMLElement).getBoundingClientRect();
                    setUserModalData({ 
                      type: 'user', 
                      id: ticket.author!.id, 
                      data: userData, 
                      position: { x: rect.left, y: rect.bottom } 
                    });
                  }}
                />
                <span>
                  Created by <span className="font-medium">{ticket.author.displayName || ticket.author.name}</span>
                </span>
              </div>
            )}
            <span>•</span>
            <span>{new Date(ticket.createdAt).toLocaleString()}</span>
            {ticket.closedAt && (
              <>
                <span>•</span>
                <span>Closed {new Date(ticket.closedAt).toLocaleString()}</span>
              </>
            )}
            <span>•</span>
            <span>{ticket.messageCount} messages</span>
          </div>
        </div>
      </div>
      
      {/* Messages Container - Discord style */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 py-6">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-gray-500 dark:text-gray-400">No messages in this ticket</p>
            </div>
          ) : (
            <>
              {/* AI Summary Message - Appears as first message */}
              {(ticket.summary || ticket.status === 'CLOSED' || messages.length > 0) && (
                <div className="mb-6">
                  <div className="group hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors py-3 px-4 rounded-md">
                    <div className="flex gap-3">
                      <SparklesIcon size={40} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-semibold text-gray-900 dark:text-white">
                            AI Summary
                          </span>
                          {ticket.summaryGeneratedAt && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(ticket.summaryGeneratedAt).toLocaleTimeString('en-US', { 
                                hour: 'numeric', 
                                minute: '2-digit',
                                hour12: true 
                              })}
                            </span>
                          )}
                        </div>
                        
                        {/* Summary Content */}
                        {ticket.summary ? (
                          <>
                            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words leading-relaxed">
                              {ticket.summary}
                            </p>
                            
                            {/* Metadata Footer */}
                            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                              {ticket.summaryModel && (
                                <span className="font-mono">{ticket.summaryModel}</span>
                              )}
                              {ticket.summaryTokensUsed && (
                                <>
                                  <span>•</span>
                                  <span>~{ticket.summaryTokensUsed} tokens</span>
                                </>
                              )}
                              <button
                                onClick={handleGenerateSummary}
                                disabled={generatingSummary}
                                className="ml-auto px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {generatingSummary ? 'Regenerating...' : 'Regenerate Summary'}
                              </button>
                            </div>
                          </>
                        ) : generatingSummary ? (
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                            <span>Generating summary...</span>
                          </div>
                        ) : summaryError ? (
                          <div className="text-sm">
                            <p className="text-red-600 dark:text-red-400 mb-2">{summaryError}</p>
                            <button
                              onClick={handleGenerateSummary}
                              className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                            >
                              Try Again
                            </button>
                          </div>
                        ) : (
                          <div className="text-sm">
                            <p className="text-gray-600 dark:text-gray-400 mb-2">
                              No summary generated yet. Click below to generate an AI summary of this ticket.
                            </p>
                            <button
                              onClick={handleGenerateSummary}
                              disabled={messages.length === 0}
                              className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title={messages.length === 0 ? 'No messages to summarize' : 'Generate AI summary'}
                            >
                              Generate Summary
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Date-grouped Messages */}
              {Array.from(messageGroups.entries()).map(([dateKey, dateMessages]) => (
                <div key={dateKey}>
                  {/* Date divider */}
                  <div className="flex items-center justify-center my-6">
                    <div className="flex-1 border-t border-gray-300 dark:border-gray-600"></div>
                    <div className="px-4 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-full">
                      {formatDateHeader(new Date(dateKey))}
                    </div>
                    <div className="flex-1 border-t border-gray-300 dark:border-gray-600"></div>
                  </div>
                  
                  {/* Messages for this date */}
                  {dateMessages.map((msg, idx) => {
                    const prevMsg = idx > 0 ? dateMessages[idx - 1] : null;
                    const isGrouped = prevMsg && 
                      prevMsg.author?.id === msg.author?.id && 
                      (new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime()) < 5 * 60 * 1000;
                    
                    return (
                      <div 
                        key={msg.id} 
                        className={`group hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors ${
                          isGrouped ? 'py-0.5' : 'py-3 mt-4'
                        } px-4 rounded-md`}
                      >
                        {!isGrouped ? (
                          // Full message with avatar
                          <div className="flex gap-3">
                            {msg.author && (
                              <Avatar 
                                src={msg.author.displayAvatar}
                                name={msg.author.displayName || msg.author.name}
                                size={40}
                                onClick={(e) => {
                                  // Try to get user data from mentions, fallback to message author data
                                  const userData = mentions.users[msg.author!.id] || {
                                    name: msg.author!.name,
                                    displayName: msg.author!.displayName,
                                    displayAvatar: msg.author!.displayAvatar
                                  };
                                  const rect = (e.target as HTMLElement).getBoundingClientRect();
                                  setUserModalData({ 
                                    type: 'user', 
                                    id: msg.author!.id, 
                                    data: userData, 
                                    position: { x: rect.left, y: rect.bottom } 
                                  });
                                }}
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="font-semibold text-gray-900 dark:text-white">
                                  {msg.author?.displayName || msg.author?.name || 'Unknown User'}
                                </span>
                                {msg.author?.id === '1346564959835787284' && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                                    BOT
                                  </span>
                                )}
                                {msg.isStaff && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                                    STAFF
                                  </span>
                                )}
                                 <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {new Date(msg.createdAt).toLocaleTimeString('en-US', { 
                                    hour: 'numeric', 
                                    minute: '2-digit',
                                    hour12: true 
                                  })}
                                 </span>
                              </div>
                              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                                {parseMessageContent(msg.content || (msg.attachments?.length ? '' : '(No content)'), mentions, handleMentionClick, prefetchUser)}
                              </p>
                              
                              {/* Render embeds if present */}
                              {msg.embeds && msg.embeds.length > 0 && (
                                <div className="space-y-2">
                                  {msg.embeds.map((embed, embedIdx) => (
                                    <DiscordEmbedDisplay 
                                      key={embedIdx} 
                                      embed={embed} 
                                      mentions={mentions}
                                      onMentionClick={handleMentionClick}
                                      onUserMentionHover={prefetchUser}
                                    />
                                  ))}
                                </div>
                              )}
                              
                              {/* Render attachments if present */}
                              {msg.attachments && msg.attachments.length > 0 && (
                                <MessageAttachments attachments={msg.attachments} />
                              )}
                              
                              {guildId && msg.channel && (
                                <a
                                  href={`discord://discord.com/channels/${guildId}/${msg.channel.id}/${msg.id}`}
                                  className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                  Jump to Message
                                </a>
                              )}
                            </div>
                          </div>
                        ) : (
                          // Compact message (grouped)
                          <div className="flex gap-3">
                            <div className="w-10 flex-shrink-0 flex items-start justify-center">
                              <span className="text-xs text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                {new Date(msg.createdAt).toLocaleTimeString('en-US', { 
                                  hour: 'numeric', 
                                  minute: '2-digit',
                                  hour12: true 
                                })}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                                {parseMessageContent(msg.content || (msg.attachments?.length ? '' : '(No content)'), mentions, handleMentionClick, prefetchUser)}
                              </p>
                              
                              {/* Render embeds if present */}
                              {msg.embeds && msg.embeds.length > 0 && (
                                <div className="space-y-2">
                                  {msg.embeds.map((embed, embedIdx) => (
                                    <DiscordEmbedDisplay 
                                      key={embedIdx} 
                                      embed={embed} 
                                      mentions={mentions}
                                      onMentionClick={handleMentionClick}
                                      onUserMentionHover={prefetchUser}
                                    />
                                  ))}
                                </div>
                              )}
                              
                              {/* Render attachments if present */}
                              {msg.attachments && msg.attachments.length > 0 && (
                                <MessageAttachments attachments={msg.attachments} />
                              )}
                              
                              {guildId && msg.channel && (
                                <a
                                  href={`discord://discord.com/channels/${guildId}/${msg.channel.id}/${msg.id}`}
                                  className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                  Jump to Message
                                </a>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
