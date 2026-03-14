'use client'

import { api } from '@/lib/eden'
import { hasMeaningfulGlobalSearchQuery } from '@/lib/search/global-search-query'
import { useQuery } from '@tanstack/react-query'

export type GlobalSearchMatchReason =
  | 'discord_id'
  | 'username'
  | 'ticket_id'
  | 'ticket_sequence'
  | 'channel_id'
  | 'ticket_author'
  | 'participant'
  | 'message_content'
  | 'message_author'

export type GlobalSearchUserResult = {
  id: string
  name: string | null
  displayName: string | null
  displayAvatar: string | null
  matchReason: GlobalSearchMatchReason
}

export type GlobalSearchTicketResult = {
  id: number
  sequence: number | null
  status: string | null
  createdAt: string
  channelId: string | null
  channelName: string | null
  panelTitle: string | null
  author: {
    id: string
    name: string | null
    displayName: string | null
    displayAvatar: string | null
  } | null
  matchReason: GlobalSearchMatchReason
}

export type GlobalSearchMessageResult = {
  id: string
  content: string
  preview: string
  highlightTerm: string | null
  createdAt: string
  author: {
    id: string
    name: string | null
    displayName: string | null
    displayAvatar: string | null
  } | null
  ticketId: number
  ticketSequence: number | null
  channelId: string | null
  channelName: string | null
  matchReason: GlobalSearchMatchReason
}

export type GlobalSearchResponse = {
  query: string
  users: GlobalSearchUserResult[]
  tickets: GlobalSearchTicketResult[]
  messages: GlobalSearchMessageResult[]
  meta: {
    tookMs: number
    strategy: 'empty' | 'numeric-fast-path' | 'text-search'
  }
}

function canRunGlobalSearch(query: string) {
  const normalizedQuery = query.trim()
  return hasMeaningfulGlobalSearchQuery(normalizedQuery) && (/^\d+$/.test(normalizedQuery) || normalizedQuery.length >= 2)
}

export function canRunGlobalSearchQuery(query: string) {
  return canRunGlobalSearch(query)
}

export function useGlobalSearch(query: string) {
  const normalizedQuery = query.trim()

  return useQuery({
    queryKey: ['global-search', normalizedQuery],
    queryFn: async (): Promise<GlobalSearchResponse> => {
      const { data, error } = await api.search.global.get({
        query: { q: normalizedQuery },
      })

      if (error) {
        throw new Error('Failed to search')
      }

      return data as GlobalSearchResponse
    },
    enabled: canRunGlobalSearch(normalizedQuery),
    staleTime: 15 * 1000,
    gcTime: 2 * 60 * 1000,
  })
}

export function getGlobalSearchReasonLabel(reason: GlobalSearchMatchReason) {
  switch (reason) {
    case 'discord_id':
      return 'Discord ID'
    case 'username':
      return 'Username'
    case 'ticket_id':
      return 'Ticket ID'
    case 'ticket_sequence':
      return 'Ticket #'
    case 'channel_id':
      return 'Channel ID'
    case 'ticket_author':
      return 'Ticket author'
    case 'participant':
      return 'Participant'
    case 'message_author':
      return 'Message author'
    case 'message_content':
    default:
      return 'Message content'
  }
}