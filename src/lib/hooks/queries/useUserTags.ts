'use client'

import { api } from '@/lib/eden'
import { useQuery } from '@tanstack/react-query'

export type ActiveTag = {
  assignmentId: number
  tagId: number
  name: string
  color: string
  emoji: string | null
  category: string | null
  assignedAt: string
  assignedBy: string | null
  note: string | null
}

export type TagHistoryItem = {
  id: number
  tagId: number
  tagName: string
  tagColor: string
  tagEmoji: string | null
  assignedAt: string
  assignedBy: string | null
  note: string | null
  removedAt: string | null
  removedBy: string | null
  removalNote: string | null
}

export type UserTagsData = {
  activeTags: ActiveTag[]
  history: TagHistoryItem[]
}

/**
 * Fetch active tags + full history for a specific user
 */
export function useUserTags(userId: string | null) {
  return useQuery({
    queryKey: ['user', 'tags', userId],
    queryFn: async (): Promise<UserTagsData> => {
      const { data, error } = await api.users({ id: userId! }).tags.get()

      if (error) {
        throw new Error('Failed to fetch user tags')
      }

      return data as unknown as UserTagsData
    },
    enabled: !!userId,
    staleTime: 1 * 60 * 1000, // 1 minute
  })
}
