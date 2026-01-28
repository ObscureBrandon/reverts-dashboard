'use client'

import { api } from '@/lib/eden'
import { useQuery, useQueryClient } from '@tanstack/react-query'

type UserRole = {
  id: string
  name: string
  color: number
  position: number
}

type UserData = {
  id: string
  name: string
  displayName: string | null
  displayAvatar: string | null
  inGuild?: boolean
  isVerified?: boolean
  isVoiceVerified?: boolean
  roles?: UserRole[]
}

type TicketStatsData = {
  open: number
  closed: number
}

type RecentTicket = {
  id: number
  sequence: number | null
  status: string | null
  createdAt: string
}

type UserPopoverData = {
  user: {
    id: string
    name: string
    displayName: string | null
    displayAvatar: string | null
    nick: string | null
    inGuild: boolean | null
    isVerified: boolean | null
    isVoiceVerified: boolean | null
  }
  roles: UserRole[]
  ticketStats: {
    open: number
    closed: number
  }
  recentTickets: RecentTicket[]
}

/**
 * Fetch user data with roles
 */
export function useUser(userId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required')

      const { data, error } = await api.users({ id: userId }).get()

      if (error) {
        throw new Error('Failed to fetch user')
      }

      // API returns { user: {...}, roles: [...] }
      return {
        ...data.user,
        roles: data.roles,
      } as UserData
    },
    enabled: options?.enabled !== false && !!userId,
    staleTime: 2 * 60 * 1000, // User data is fresh for 2 minutes
  })
}

/**
 * Fetch user ticket statistics (open and closed counts)
 * OPTIMIZED: Uses single endpoint instead of 3 separate API calls
 */
export function useUserTicketStats(userId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['userTicketStats', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required')

      const { data, error } = await api.users({ id: userId })['ticket-stats'].get()

      if (error) {
        throw new Error('Failed to fetch ticket stats')
      }

      return data as TicketStatsData
    },
    enabled: options?.enabled !== false && !!userId,
    staleTime: 1 * 60 * 1000, // Ticket stats fresh for 1 minute
  })
}

/**
 * Fetch user's recent tickets
 */
export function useUserRecentTickets(
  userId: string | undefined,
  limit: number = 5,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['userRecentTickets', userId, limit],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required')

      const { data, error } = await api.tickets.get({
        query: {
          author: userId,
          limit: String(limit),
          sortBy: 'newest',
        },
      })

      if (error) {
        throw new Error('Failed to fetch recent tickets')
      }

      return (data.tickets || []) as RecentTicket[]
    },
    enabled: options?.enabled !== false && !!userId,
    staleTime: 1 * 60 * 1000, // Recent tickets fresh for 1 minute
  })
}

/**
 * Fetch all user popover data in a single request
 * OPTIMIZED: Combines user details, roles, ticket stats, and recent tickets
 * This prevents layout shift by loading all data at once
 */
export function useUserPopoverData(userId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['userPopoverData', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required')

      const { data, error } = await api.users({ id: userId }).popover.get()

      if (error) {
        throw new Error('Failed to fetch user popover data')
      }

      return data as UserPopoverData
    },
    enabled: options?.enabled !== false && !!userId,
    staleTime: 1 * 60 * 1000, // Popover data fresh for 1 minute
  })
}

/**
 * Prefetch user data and stats on hover
 * Use this to improve popover performance
 * OPTIMIZED: Uses new single-query popover endpoint
 */
export function usePrefetchUser() {
  const queryClient = useQueryClient()

  const prefetchUser = (userId: string) => {
    // Prefetch all popover data in a single request
    queryClient.prefetchQuery({
      queryKey: ['userPopoverData', userId],
      queryFn: async () => {
        const { data, error } = await api.users({ id: userId }).popover.get()

        if (error) {
          throw new Error('Failed to fetch user popover data')
        }

        return data as UserPopoverData
      },
      staleTime: 1 * 60 * 1000,
    })
  }

  return { prefetchUser }
}
