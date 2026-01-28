'use client'

import { api } from '@/lib/eden'
import { useQuery } from '@tanstack/react-query'

export type Panel = {
  id: number
  title: string
}

export function usePanels() {
  return useQuery({
    queryKey: ['panels'],
    queryFn: async () => {
      const { data, error } = await api.panels.get()

      if (error) {
        throw new Error('Failed to fetch panels')
      }

      return data.panels as Panel[]
    },
    staleTime: 5 * 60 * 1000, // Panels rarely change, cache for 5 minutes
  })
}
