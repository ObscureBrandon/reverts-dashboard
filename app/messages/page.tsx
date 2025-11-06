'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useDebounce } from '@/lib/hooks/useDebounce';
import Link from 'next/link';

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

type ModalData = 
  | { type: 'user'; id: string; data: { name: string; displayName: string | null; displayAvatar: string | null }; position: { x: number; y: number } }
  | { type: 'role'; id: string; data: { name: string; color: number }; position: { x: number; y: number } }
  | { type: 'channel'; id: string; data: { name: string }; position: { x: number; y: number } }
  | null;

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

// Utility function to convert Discord role color integer to hex
function roleColorToHex(color: number): string {
  return '#' + color.toString(16).padStart(6, '0');
}

// Avatar component with fallback
function Avatar({ 
  src, 
  name, 
  size = 40 
}: { 
  src: string | null; 
  name: string; 
  size?: number;
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
  
  if (!src || imageError) {
    return (
      <div 
        className="rounded-full flex items-center justify-center font-semibold text-white border-2 border-gray-200 dark:border-gray-700 flex-shrink-0"
        style={{ 
          width: `${size}px`, 
          height: `${size}px`,
          backgroundColor: getColorFromName(name),
          fontSize: `${size * 0.4}px`
        }}
      >
        {initials}
      </div>
    );
  }
  
  return (
    <img 
      src={src}
      alt={`${name}'s avatar`}
      className="rounded-full border-2 border-gray-200 dark:border-gray-700 flex-shrink-0"
      style={{ width: `${size}px`, height: `${size}px` }}
      onError={() => setImageError(true)}
    />
  );
}

// Component to render info popover
function MentionPopover({ modalData, onClose }: { modalData: ModalData; onClose: () => void }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);

  // Fetch user roles when popover opens for a user
  useEffect(() => {
    if (modalData?.type === 'user') {
      setRolesLoading(true);
      fetch(`/api/users/${modalData.id}`)
        .then(res => res.json())
        .then(data => {
          if (data.roles) {
            setUserRoles(data.roles);
          }
        })
        .catch(err => console.error('Failed to fetch user roles:', err))
        .finally(() => setRolesLoading(false));
    } else {
      setUserRoles([]);
    }
  }, [modalData?.type, modalData?.id]);

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

  const adjustedPosition = {
    x: Math.min(modalData.position.x, window.innerWidth - 320),
    y: modalData.position.y + 10,
  };

  if (adjustedPosition.y + 300 > window.innerHeight) {
    adjustedPosition.y = modalData.position.y - 310;
  }

  return (
    <>
      <div 
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      
      <div 
        className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 w-80 animate-in fade-in slide-in-from-top-2 duration-200"
        style={{
          left: `${adjustedPosition.x}px`,
          top: `${adjustedPosition.y}px`,
        }}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
              {modalData.type === 'user' && 'User'}
              {modalData.type === 'role' && 'Role'}
              {modalData.type === 'channel' && 'Channel'}
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
              </>
            )}

            {modalData.type === 'role' && (
              <>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Name</label>
                  <p className="text-sm text-gray-900 dark:text-white mt-1">{modalData.data.name}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Color</label>
                  <div className="flex items-center gap-2 mt-1">
                    <div 
                      className="w-5 h-5 rounded border border-gray-300 dark:border-gray-600"
                      style={{ backgroundColor: roleColorToHex(modalData.data.color) }}
                    />
                    <p className="text-xs text-gray-900 dark:text-white font-mono">
                      {roleColorToHex(modalData.data.color)}
                    </p>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Role ID</label>
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
              </>
            )}

            {modalData.type === 'channel' && (
              <>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Name</label>
                  <p className="text-sm text-gray-900 dark:text-white mt-1">#{modalData.data.name}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Channel ID</label>
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
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

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
  const router = useRouter();
  
  // Get initial values from URL
  const urlQuery = searchParams.get('q');
  
  const [searchQuery, setSearchQuery] = useState(urlQuery || '');
  const [staffOnly, setStaffOnly] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [mentions, setMentions] = useState<MentionLookup>({ users: {}, roles: {}, channels: {} });
  const [modalData, setModalData] = useState<ModalData>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [guildId, setGuildId] = useState<string | null>(null);
  
  const debouncedQuery = useDebounce(searchQuery, 150);
  
  const handleMentionClick = useCallback((type: 'user' | 'role' | 'channel', id: string, event: React.MouseEvent) => {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const position = {
      x: rect.left,
      y: rect.bottom,
    };

    if (type === 'user') {
      const userData = mentions.users[id];
      if (userData) {
        setModalData({ type: 'user', id, data: userData, position });
      }
    } else if (type === 'role') {
      const roleData = mentions.roles[id];
      if (roleData) {
        setModalData({ type: 'role', id, data: roleData, position });
      }
    } else if (type === 'channel') {
      const channelData = mentions.channels[id];
      if (channelData) {
        setModalData({ type: 'channel', id, data: channelData, position });
      }
    }
  }, [mentions]);
  
  const fetchMessages = useCallback(async (signal: AbortSignal) => {
    const isFirstLoad = messages.length === 0;
    if (isFirstLoad) {
      setLoading(true);
    }
    setError(null);
    
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
      });
      
      if (debouncedQuery) {
        params.set('q', debouncedQuery);
      }
      
      if (staffOnly) {
        params.set('staffOnly', 'true');
      }
      
      const response = await fetch(`/api/messages?${params}`, {
        signal,
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }
      
      const data: SearchResponse = await response.json();
      
      setMessages(data.messages);
      setMentions(data.mentions);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
      setGuildId(data.guildId);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      console.error('Failed to fetch messages:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setMessages([]);
    } finally {
      if (isFirstLoad) {
        setLoading(false);
      }
    }
  }, [debouncedQuery, staffOnly, page, messages.length]);
  
  useEffect(() => {
    const abortController = new AbortController();
    fetchMessages(abortController.signal);
    
    return () => abortController.abort();
  }, [fetchMessages]);
  
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, staffOnly]);
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <MentionPopover modalData={modalData} onClose={() => setModalData(null)} />
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
              Error: {error}
            </p>
          </div>
        )}
        
        {/* Results */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
          {loading ? (
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
                          <Avatar 
                            src={msg.author.displayAvatar}
                            name={msg.author.displayName || msg.author.name}
                            size={40}
                          />
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
                    disabled={page === 1 || loading}
                    className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed disabled:hover:bg-gray-300 transition-colors"
                  >
                    Previous
                  </button>
                  
                  <span className="text-gray-600 dark:text-gray-400">
                    Page {page} of {totalPages}
                  </span>
                  
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || loading}
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
