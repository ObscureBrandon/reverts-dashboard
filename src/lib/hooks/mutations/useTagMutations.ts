'use client'

import { api } from '@/lib/eden'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getErrorMessage } from '@/lib/utils'

/**
 * Mutation: Create a new tag
 */
export function useCreateTag() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      name: string
      description?: string
      color: string
      emoji?: string
      category?: string
    }) => {
      const { data: result, error } = await api.tags.post(data)

      if (error) {
        throw new Error(getErrorMessage(error, 'Failed to create tag'))
      }

      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revert-tags'] })
    },
  })
}

/**
 * Mutation: Update a tag
 */
export function useUpdateTag() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ tagId, ...data }: {
      tagId: number
      name?: string
      description?: string
      color?: string
      emoji?: string
      category?: string
    }) => {
      const { data: result, error } = await api.tags({ id: String(tagId) }).patch(data)

      if (error) {
        throw new Error(getErrorMessage(error, 'Failed to update tag'))
      }

      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revert-tags'] })
    },
  })
}

/**
 * Mutation: Archive a tag
 */
export function useArchiveTag() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (tagId: number) => {
      const { data: result, error } = await api.tags({ id: String(tagId) }).archive.patch()

      if (error) {
        throw new Error(getErrorMessage(error, 'Failed to archive tag'))
      }

      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revert-tags'] })
    },
  })
}

/**
 * Mutation: Assign a tag to a user
 */
export function useAssignTag() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      userId: string
      tagId: number
      note?: string
    }) => {
      const { data: result, error } = await api.users({ id: data.userId }).tags.post({
        tagId: data.tagId,
        note: data.note,
      })

      if (error) {
        throw new Error(getErrorMessage(error, 'Failed to assign tag'))
      }

      return result
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user', 'tags', variables.userId] })
      queryClient.invalidateQueries({ queryKey: ['user', 'details', variables.userId] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

/**
 * Mutation: Remove a tag from a user
 */
export function useRemoveTag() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      userId: string
      assignmentId: number
      removalNote?: string
    }) => {
      const { data: result, error } = await api.users({ id: data.userId }).tags({ assignmentId: String(data.assignmentId) }).delete({
        removalNote: data.removalNote,
      })

      if (error) {
        throw new Error(getErrorMessage(error, 'Failed to remove tag'))
      }

      return result
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user', 'tags', variables.userId] })
      queryClient.invalidateQueries({ queryKey: ['user', 'details', variables.userId] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
