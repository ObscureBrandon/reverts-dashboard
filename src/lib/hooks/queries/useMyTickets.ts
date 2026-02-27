'use client'

import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'

export type MyTicketsParams = {
  page?: number
  limit?: number
  status?: string
}

export type MyTicket = {
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
}

export type MyTicketsResponse = {
  tickets: MyTicket[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export type MyTicketResponse = {
  ticket: MyTicket & {
    summary?: string | null
    summaryGeneratedAt?: string | null
    summaryModel?: string | null
    summaryTokensUsed?: number | null
  }
}

/**
 * Fetch the current user's own tickets
 */
export function useMyTickets(params: MyTicketsParams = {}) {
  const { page = 1, limit = 50, status } = params

  return useQuery({
    queryKey: ['my-tickets', { page, limit, status }],
    queryFn: async (): Promise<MyTicketsResponse> => {
      const searchParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      })

      if (status && status !== 'all') {
        searchParams.set('status', status)
      }

      const res = await fetch(`/api/my-tickets?${searchParams}`, {
        credentials: 'include',
      })

      if (!res.ok) {
        throw new Error('Failed to fetch tickets')
      }

      return res.json()
    },
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  })
}

/**
 * Fetch a single ticket that belongs to the current user
 */
export function useMyTicket(ticketId: string | number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['my-ticket', ticketId],
    queryFn: async (): Promise<MyTicketResponse> => {
      const res = await fetch(`/api/my-tickets?id=${ticketId}`, {
        credentials: 'include',
      })

      if (!res.ok) {
        if (res.status === 403) {
          throw new Error('Access denied: This ticket does not belong to you')
        }
        throw new Error('Failed to fetch ticket')
      }

      return res.json()
    },
    staleTime: 1 * 60 * 1000,
    enabled: !!ticketId && (options?.enabled !== false),
  })
}

/**
 * Prefetch My Tickets for pagination
 */
export function usePrefetchMyTickets(params: MyTicketsParams = {}) {
  const queryClient = useQueryClient()
  const { page = 1, limit = 50, status } = params

  const prefetchPage = (targetPage: number) => {
    queryClient.prefetchQuery({
      queryKey: ['my-tickets', { page: targetPage, limit, status }],
      queryFn: async (): Promise<MyTicketsResponse> => {
        const searchParams = new URLSearchParams({
          page: targetPage.toString(),
          limit: limit.toString(),
        })

        if (status && status !== 'all') {
          searchParams.set('status', status)
        }

        const res = await fetch(`/api/my-tickets?${searchParams}`, {
          credentials: 'include',
        })

        if (!res.ok) {
          throw new Error('Failed to fetch tickets')
        }

        return res.json()
      },
      staleTime: 30 * 1000,
    })
  }

  return { prefetchPage }
}
