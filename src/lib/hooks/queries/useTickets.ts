'use client'

import { api } from '@/lib/eden'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'

export type Ticket = {
  id: number
  sequence: number | null
  status: string | null
  createdAt: string
  closedAt: string | null
  author: {
    id: string
    name: string
    displayName: string | null
    displayAvatar: string | null
  } | null
  channel: {
    id: string
    name: string
  } | null
  panel: {
    id: number
    title: string
  } | null
  messageCount: number
  summary?: string | null
  summaryGeneratedAt?: string | null
  summaryModel?: string | null
  summaryTokensUsed?: number | null
}

export type Message = {
  id: string
  content: string
  createdAt: string
  isStaff: boolean
  embeds?: any[]
  attachments?: string[]
  author: {
    id: string
    name: string
    displayName: string | null
    nick: string | null
    displayAvatar: string | null
  } | null
  channel: {
    id: string
    name: string
  } | null
}

export type MentionLookup = {
  users: Record<string, { name: string; displayName: string | null; displayAvatar: string | null }>
  roles: Record<string, { name: string; color: number }>
  channels: Record<string, { name: string }>
}

export type TicketsParams = {
  page?: number
  limit?: number
  sortBy?: 'newest' | 'oldest' | 'messages'
  status?: string
  author?: string
  panel?: number
}

export type TicketsResponse = {
  tickets: Ticket[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export type TicketResponse = {
  ticket: Ticket
}

export type TicketMessagesResponse = {
  messages: Message[]
  mentions: MentionLookup
  guildId: string | null
}

/**
 * Fetch a list of tickets with pagination and filters
 */
export function useTickets(params: TicketsParams = {}, options?: { enabled?: boolean }) {
  const { page = 1, limit = 50, sortBy = 'newest', status, author, panel } = params

  return useQuery({
    queryKey: ['tickets', { page, limit, sortBy, status, author, panel }],
    queryFn: async (): Promise<TicketsResponse> => {
      const query: Record<string, string> = {
        page: page.toString(),
        limit: limit.toString(),
        sortBy,
      }

      if (status && status !== 'all') {
        query.status = status
      }

      if (author) {
        query.author = author
      }

      if (panel) {
        query.panel = panel.toString()
      }

      const { data, error } = await api.tickets.get({ query })

      if (error) {
        throw new Error('Failed to fetch tickets')
      }

      return data as TicketsResponse
    },
    staleTime: 30 * 1000, // 30 seconds
    placeholderData: keepPreviousData, // Keep previous results visible while fetching
    ...options,
  })
}

/**
 * Fetch a single ticket by ID
 */
export function useTicket(ticketId: string | number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: async (): Promise<TicketResponse> => {
      const { data, error } = await api.tickets.get({
        query: { id: String(ticketId) },
      })

      if (error) {
        throw new Error('Failed to fetch ticket')
      }

      return data as TicketResponse
    },
    staleTime: 1 * 60 * 1000, // 1 minute
    enabled: !!ticketId && (options?.enabled !== false),
  })
}

/**
 * Fetch messages for a ticket (transcript mode)
 */
export function useTicketMessages(ticketId: string | number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['ticketMessages', ticketId],
    queryFn: async (): Promise<TicketMessagesResponse> => {
      const { data, error } = await api.messages.get({
        query: {
          ticketId: String(ticketId),
          mode: 'transcript',
          limit: '1000',
        },
      })

      if (error) {
        throw new Error('Failed to fetch messages')
      }

      return data as TicketMessagesResponse
    },
    staleTime: 2 * 60 * 1000, // 2 minutes (transcript doesn't change often)
    enabled: !!ticketId && (options?.enabled !== false),
  })
}

/**
 * Prefetch tickets for the next/previous page
 * Use this to improve pagination performance
 */
export function usePrefetchTickets(params: TicketsParams = {}) {
  const queryClient = useQueryClient()
  const { page = 1, limit = 50, sortBy = 'newest', status, author, panel } = params

  const prefetchPage = (targetPage: number) => {
    queryClient.prefetchQuery({
      queryKey: ['tickets', { page: targetPage, limit, sortBy, status, author, panel }],
      queryFn: async (): Promise<TicketsResponse> => {
        const query: Record<string, string> = {
          page: targetPage.toString(),
          limit: limit.toString(),
          sortBy,
        }

        if (status && status !== 'all') {
          query.status = status
        }

        if (author) {
          query.author = author
        }

        if (panel) {
          query.panel = panel.toString()
        }

        const { data, error } = await api.tickets.get({ query })

        if (error) {
          throw new Error('Failed to fetch tickets')
        }

        return data as TicketsResponse
      },
      staleTime: 30 * 1000,
    })
  }

  return { prefetchPage }
}

/**
 * Prefetch a single ticket and its messages
 * Use this on hover to improve navigation performance
 */
export function usePrefetchTicketDetail() {
  const queryClient = useQueryClient()

  const prefetchTicket = (ticketId: string | number) => {
    // Prefetch ticket data
    queryClient.prefetchQuery({
      queryKey: ['ticket', ticketId],
      queryFn: async (): Promise<TicketResponse> => {
        const { data, error } = await api.tickets.get({
          query: { id: String(ticketId) },
        })

        if (error) {
          throw new Error('Failed to fetch ticket')
        }

        return data as TicketResponse
      },
      staleTime: 1 * 60 * 1000,
    })

    // Prefetch ticket messages
    queryClient.prefetchQuery({
      queryKey: ['ticketMessages', ticketId],
      queryFn: async (): Promise<TicketMessagesResponse> => {
        const { data, error } = await api.messages.get({
          query: {
            ticketId: String(ticketId),
            mode: 'transcript',
            limit: '1000',
          },
        })

        if (error) {
          throw new Error('Failed to fetch messages')
        }

        return data as TicketMessagesResponse
      },
      staleTime: 2 * 60 * 1000,
    })
  }

  return { prefetchTicket }
}
