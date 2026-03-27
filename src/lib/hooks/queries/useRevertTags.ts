'use client'

import { api } from '@/lib/eden'
import { useQuery } from '@tanstack/react-query'

export type RevertTag = {
  id: number
  name: string
  description: string | null
  color: string
  emoji: string | null
  category: string | null
  isArchived: boolean
  createdById: string
  createdAt: string
  activeCount?: number
}

type RevertTagsResponse = {
  tags: Array<Omit<RevertTag, 'createdAt'> & { createdAt: Date }>
}

/**
 * Fetch all non-archived tags (for tag picker)
 */
export function useRevertTags() {
  return useQuery({
    queryKey: ['revert-tags'],
    queryFn: async (): Promise<RevertTag[]> => {
      const { data, error } = await api.tags.get()

      if (error) {
        throw new Error('Failed to fetch tags')
      }

      return (data as RevertTagsResponse).tags.map((tag) => ({
        ...tag,
        createdAt: tag.createdAt.toISOString(),
      }))
    },
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Fetch all tags including archived (for tag management page)
 */
export function useAllRevertTags() {
  return useQuery({
    queryKey: ['revert-tags', 'all'],
    queryFn: async (): Promise<RevertTag[]> => {
      const { data, error } = await api.tags.all.get()

      if (error) {
        throw new Error('Failed to fetch tags')
      }

      return (data as RevertTagsResponse).tags.map((tag) => ({
        ...tag,
        createdAt: tag.createdAt.toISOString(),
      }))
    },
    staleTime: 2 * 60 * 1000,
  })
}
