'use client'

import { api } from '@/lib/eden'
import { useQuery } from '@tanstack/react-query'

export type DashboardRevert = {
  id: string
  name: string | null
  displayName: string | null
  displayAvatar: string | null
  inGuild: boolean
  assignedAt: string
  assignmentStatus: string | null
  lastCheckIn: string | null
  activeTags: Array<{ id: number; name: string; color: string; emoji: string | null }>
}

export type DashboardTicket = {
  id: number
  sequence: number | null
  status: string | null
  createdAt: string
  author: {
    id: string
    name: string | null
    avatar: string | null
  }
  lastStaffMessageAt: string | null
}

export type DashboardShahadaRevert = {
  id: string
  name: string | null
  displayName: string | null
  displayAvatar: string | null
  inGuild: boolean
  shahadaAt: string | null
  activeTags: Array<{ id: number; name: string; color: string; emoji: string | null }>
  assignee: {
    id: string
    name: string | null
    avatar: string | null
  } | null
  activeAssigneeCount: number
  isAssignedToYou: boolean
}

export type DashboardData = {
  stats: {
    totalReverts: number
    needsSupport: number
    overdueCheckIns: number
    openTickets: number
    shahadaCount: number
  }
  assignedReverts: DashboardRevert[]
  recentTickets: DashboardTicket[]
  shahadaWithMe: DashboardShahadaRevert[]
}

/**
 * Fetch dashboard aggregate data for the logged-in staff member
 */
export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async (): Promise<DashboardData> => {
      const { data, error } = await api.dashboard.get()

      if (error) {
        throw new Error('Failed to fetch dashboard data')
      }

      return data as unknown as DashboardData
    },
    staleTime: 30 * 1000, // 30 seconds
  })
}
