'use client'

import { api } from '@/lib/eden'
import { getErrorMessage } from '@/lib/utils'
import { useMutation, useQueryClient } from '@tanstack/react-query'

type AddSupervisorNotePayload = {
  userId: string
  note: string
}

export function useAddSupervisorNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId, note }: AddSupervisorNotePayload) => {
      const { data, error } = await api.users({ id: userId })['supervisor-notes'].post({ note })

      if (error) {
        throw new Error(getErrorMessage(error, 'Failed to add supervisor note'))
      }

      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user', 'details', variables.userId] })
    },
  })
}