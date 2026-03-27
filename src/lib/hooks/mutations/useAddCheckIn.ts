'use client'

import { api } from '@/lib/eden'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getErrorMessage } from '@/lib/utils'

/**
 * Mutation: Log a new check-in for a user
 */
export function useAddCheckIn() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      userId: string
      method: string
      summary?: string
    }) => {
      const { data: result, error } = await api.users({ id: data.userId })['check-ins'].post({
        method: data.method,
        summary: data.summary,
      })

      if (error) {
        throw new Error(getErrorMessage(error, 'Failed to add check-in'))
      }

      return result
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user', 'check-ins', variables.userId] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
