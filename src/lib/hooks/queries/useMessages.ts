'use client'

import { api } from '@/lib/eden'
import { useQuery, useQueryClient } from '@tanstack/react-query'

export type Message = {
  id: string
  content: string
  createdAt: string
  isStaff: boolean
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
  ticket: {
    id: number
    sequence: number | null
    status: string | null
    createdAt: string
  } | null
}

export type MentionLookup = {
  users: Record<string, { name: string; displayName: string | null; displayAvatar: string | null }>
  roles: Record<string, { name: string; color: number }>
  channels: Record<string, { name: string }>
}

export type MessagesParams = {
  q?: string
  page?: number
  limit?: number
  staffOnly?: boolean
}

export type MessagesResponse = {
  messages: Message[]
  mentions: MentionLookup
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
  guildId: string | null
}

/**
 * Search messages with pagination and filters
 */
export function useMessages(params: MessagesParams = {}, options?: { enabled?: boolean }) {
  const { q, page = 1, limit = 50, staffOnly = false } = params

  return useQuery({
    queryKey: ['messages', { q, page, limit, staffOnly }],
    queryFn: async (): Promise<MessagesResponse> => {
      const query: Record<string, string> = {
        page: page.toString(),
        limit: limit.toString(),
      }

      if (q) {
        query.q = q
      }

      if (staffOnly) {
        query.staffOnly = 'true'
      }

      const { data, error } = await api.messages.get({ query })

      if (error) {
        throw new Error('Failed to fetch messages')
      }

      return data as MessagesResponse
    },
    staleTime: 30 * 1000, // 30 seconds
    ...options,
  })
}

/**
 * Prefetch messages for the next/previous page
 * Use this to improve pagination performance
 */
export function usePrefetchMessages(params: MessagesParams = {}) {
  const queryClient = useQueryClient()
  const { q, page = 1, limit = 50, staffOnly = false } = params

  const prefetchPage = (targetPage: number) => {
    queryClient.prefetchQuery({
      queryKey: ['messages', { q, page: targetPage, limit, staffOnly }],
      queryFn: async (): Promise<MessagesResponse> => {
        const query: Record<string, string> = {
          page: targetPage.toString(),
          limit: limit.toString(),
        }

        if (q) {
          query.q = q
        }

        if (staffOnly) {
          query.staffOnly = 'true'
        }

        const { data, error } = await api.messages.get({ query })

        if (error) {
          throw new Error('Failed to fetch messages')
        }

        return data as MessagesResponse
      },
      staleTime: 30 * 1000,
    })
  }

  return { prefetchPage }
}
