'use client'

import { api } from '@/lib/eden'
import { useQuery } from '@tanstack/react-query'

export type CheckIn = {
  id: number
  staffId: string
  staffName: string | null
  staffAvatar: string | null
  method: string
  summary: string | null
  checkedInAt: string
}

/**
 * Fetch check-ins for a specific user
 */
export function useCheckIns(userId: string | null) {
  return useQuery({
    queryKey: ['user', 'check-ins', userId],
    queryFn: async (): Promise<CheckIn[]> => {
      const { data, error } = await api.users({ id: userId! })['check-ins'].get()

      if (error) {
        throw new Error('Failed to fetch check-ins')
      }

      return (data as any).checkIns as CheckIn[]
    },
    enabled: !!userId,
    staleTime: 1 * 60 * 1000,
  })
}
