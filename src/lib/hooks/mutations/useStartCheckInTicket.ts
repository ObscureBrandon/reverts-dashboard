'use client'

import { api } from '@/lib/eden'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { getErrorMessage } from '@/lib/utils'

export type StartCheckInTicketResponse = {
  outcome: string
  ticketId: number
  channelId: string
  channelName: string
  guildId: string
  ticketViewMessageId: string | null
  discordUrl: string
  panelId: number
  panelTitle: string
}

export function useStartCheckInTicket() {
  const queryClient = useQueryClient()

  return useMutation<StartCheckInTicketResponse, Error, { userId: string }>({
    mutationFn: async ({ userId }) => {
      const { data, error } = await api.bot['check-ins'].start.post({
        revertUserId: userId,
      })

      if (error) {
        throw new Error(getErrorMessage(error, 'Failed to create check-in ticket'))
      }

      return data as StartCheckInTicketResponse
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user', 'details', variables.userId] })
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['ticket'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}