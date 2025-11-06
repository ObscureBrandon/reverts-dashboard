import { useQuery } from '@tanstack/react-query';

export type Ticket = {
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

export type Message = {
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

export type MentionLookup = {
  users: Record<string, { name: string; displayName: string | null; displayAvatar: string | null }>;
  roles: Record<string, { name: string; color: number }>;
  channels: Record<string, { name: string }>;
};

export type TicketsParams = {
  page?: number;
  limit?: number;
  sortBy?: 'newest' | 'oldest' | 'messages';
  status?: string;
  author?: string;
};

export type TicketsResponse = {
  tickets: Ticket[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export type TicketResponse = {
  ticket: Ticket;
};

export type TicketMessagesResponse = {
  messages: Message[];
  mentions: MentionLookup;
  guildId: string | null;
};

/**
 * Fetch a list of tickets with pagination and filters
 */
export function useTickets(params: TicketsParams = {}, options?: { enabled?: boolean }) {
  const { page = 1, limit = 50, sortBy = 'newest', status, author } = params;
  
  return useQuery({
    queryKey: ['tickets', { page, limit, sortBy, status, author }],
    queryFn: async (): Promise<TicketsResponse> => {
      const searchParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sortBy,
      });
      
      if (status && status !== 'all') {
        searchParams.set('status', status);
      }
      
      if (author) {
        searchParams.set('author', author);
      }
      
      const response = await fetch(`/api/tickets?${searchParams}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch tickets');
      }
      
      return response.json();
    },
    staleTime: 30 * 1000, // 30 seconds
    ...options,
  });
}

/**
 * Fetch a single ticket by ID
 */
export function useTicket(ticketId: string | number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: async (): Promise<TicketResponse> => {
      const response = await fetch(`/api/tickets?id=${ticketId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch ticket');
      }
      
      return response.json();
    },
    staleTime: 1 * 60 * 1000, // 1 minute
    enabled: !!ticketId && (options?.enabled !== false),
  });
}

/**
 * Fetch messages for a ticket (transcript mode)
 */
export function useTicketMessages(ticketId: string | number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['ticketMessages', ticketId],
    queryFn: async (): Promise<TicketMessagesResponse> => {
      const response = await fetch(`/api/messages?ticketId=${ticketId}&mode=transcript&limit=1000`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }
      
      return response.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes (transcript doesn't change often)
    enabled: !!ticketId && (options?.enabled !== false),
  });
}
