'use client'

import { api } from '@/lib/eden'
import { useQuery, useQueryClient } from '@tanstack/react-query'

// Types matching the API response from /api/users/[id]?full=true
export type UserRole = {
  id: string
  name: string
  color: number
  position: number
}

export type UserShahada = {
  id: number
  createdAt: string
  supervisor: {
    id: string
    name: string | null
    displayName: string | null
    avatar: string | null
  } | null
}

export type UserSupervisor = {
  id: number
  active: boolean
  createdAt: string
  supervisor: {
    id: string
    name: string | null
    displayName: string | null
    avatar: string | null
  } | null
}

export type AssignmentHistoryItem = {
  id: number
  status: string
  priority: number
  notes: string | null
  active: boolean
  createdAt: string
  resolvedAt: string | null
  addedBy: { id: string; name: string | null } | null
  resolvedBy: { id: string; name: string | null } | null
}

export type SupervisionNeed = {
  id: number
  needType: string
  severity: number
  notes: string | null
  createdAt: string
  resolvedAt: string | null
  addedBy: { id: string; name: string | null } | null
}

export type UserInfraction = {
  id: number
  type: string
  status: string
  reason: string | null
  hidden: boolean
  jumpUrl: string | null
  expiresAt: string | null
  createdAt: string
  moderator: { id: string; name: string | null } | null
  pardonedBy: { id: string; at: string | null; reason: string | null } | null
}

export type SupervisorEntry = {
  id: number
  note: string | null
  createdAt: string
  supervisor: {
    id: string
    name: string | null
    displayName: string | null
  } | null
}

export type TicketStats = {
  open: number
  closed: number
  deleted: number
}

export type RecentTicket = {
  id: number
  sequence: number | null
  status: string | null
  createdAt: string
}

export type UserDetails = {
  user: {
    id: string
    name: string | null
    displayName: string | null
    displayAvatar: string | null
    nick: string | null
    inGuild: boolean
    isVerified: boolean
    isVoiceVerified: boolean
    relationToIslam: string | null
    gender: string | null
    age: string | null
    referralSource: string | null
    region: string | null
    religiousAffiliation: string | null
    wantsDiscussion: string | null
    createdAt: string
  }
  roles: UserRole[]
  shahadas: UserShahada[]
  supervisors: UserSupervisor[]
  assignmentHistory: AssignmentHistoryItem[]
  supervisionNeeds: SupervisionNeed[]
  infractions: UserInfraction[]
  supervisorEntries: SupervisorEntry[]
  ticketStats: TicketStats
  recentTickets: RecentTicket[]
}

async function fetchUserDetails(userId: string): Promise<UserDetails> {
  const { data, error } = await api.users({ id: userId }).get({
    query: { full: 'true' },
  })

  if (error) {
    throw new Error('Failed to fetch user details')
  }

  return data as UserDetails
}

/**
 * Hook to fetch full user details for the side panel
 */
export function useUserDetails(userId: string | null) {
  return useQuery({
    queryKey: ['user', 'details', userId],
    queryFn: () => fetchUserDetails(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  })
}

/**
 * Hook to prefetch user details on hover
 */
export function usePrefetchUserDetails() {
  const queryClient = useQueryClient()

  const prefetch = (userId: string) => {
    queryClient.prefetchQuery({
      queryKey: ['user', 'details', userId],
      queryFn: () => fetchUserDetails(userId),
      staleTime: 5 * 60 * 1000, // 5 minutes
    })
  }

  return { prefetch }
}
