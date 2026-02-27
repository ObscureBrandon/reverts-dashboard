'use client'

import { api } from '@/lib/eden'
import { useQuery, useQueryClient } from '@tanstack/react-query'

// Types matching the API response from /api/users/:id/staff-details
export type StaffSupervisee = {
  id: string
  name: string | null
  displayName: string | null
  displayAvatar: string | null
  inGuild: boolean
  isVerified: boolean
  assignmentStatus: string | null
  assignedAt: string
}

export type StaffRole = {
  id: string
  name: string
  color: number
  position: number
}

export type StaffDetails = {
  staff: {
    id: string
    name: string | null
    displayName: string | null
    displayAvatar: string | null
    inGuild: boolean
    isVerified: boolean
    isVoiceVerified: boolean
  }
  supervisees: StaffSupervisee[]
  roles: StaffRole[]
  stats: {
    totalSupervisees: number
    needsSupport: number
  }
}

async function fetchStaffDetails(staffId: string): Promise<StaffDetails> {
  const { data, error } = await api.users({ id: staffId })['staff-details'].get()

  if (error) {
    throw new Error('Failed to fetch staff details')
  }

  return data as StaffDetails
}

/**
 * Hook to fetch staff member details for the side panel
 */
export function useStaffDetails(staffId: string | null) {
  return useQuery({
    queryKey: ['staff', 'details', staffId],
    queryFn: () => fetchStaffDetails(staffId!),
    enabled: !!staffId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  })
}

/**
 * Hook to prefetch staff details on hover
 */
export function usePrefetchStaffDetails() {
  const queryClient = useQueryClient()

  const prefetch = (staffId: string) => {
    queryClient.prefetchQuery({
      queryKey: ['staff', 'details', staffId],
      queryFn: () => fetchStaffDetails(staffId),
      staleTime: 5 * 60 * 1000, // 5 minutes
    })
  }

  return { prefetch }
}
