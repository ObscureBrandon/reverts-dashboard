'use client'

import { api } from '@/lib/eden'
import { getErrorMessage } from '@/lib/utils'
import { useMutation, useQueryClient } from '@tanstack/react-query'

type AssignmentMutationResult = {
  success: true
  assignmentStatus: string | null
  primarySupervisor: {
    id: number
    active: boolean
    createdAt: string
    supervisor: {
      id: string
      name: string | null
      displayName: string | null
      avatar: string | null
    }
  } | null
}

type AssignSupervisorPayload = {
  userId: string
  supervisorId: string
  note?: string
}

type UnassignPayload = {
  userId: string
  nextState: 'OPEN' | 'ON_HOLD' | 'CLOSED'
  reason?: string
  note?: string
}

function invalidateAssignmentQueries(queryClient: ReturnType<typeof useQueryClient>, userId: string) {
  queryClient.invalidateQueries({ queryKey: ['users', 'table'] })
  queryClient.invalidateQueries({ queryKey: ['user', 'details', userId] })
  queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  queryClient.invalidateQueries({ queryKey: ['users', 'staff'] })
}

export function useClaimAssignment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await api.users({ id: userId }).assignment.claim.post({})

      if (error) {
        throw new Error(getErrorMessage(error, 'Failed to claim assignment'))
      }

      return data as AssignmentMutationResult
    },
    onSuccess: (_, userId) => {
      invalidateAssignmentQueries(queryClient, userId)
    },
  })
}

export function useAssignUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId, supervisorId, note }: AssignSupervisorPayload) => {
      const { data, error } = await api.users({ id: userId }).assignment.assign.post({
        supervisorId,
        note,
      })

      if (error) {
        throw new Error(getErrorMessage(error, 'Failed to assign supervisor'))
      }

      return data as AssignmentMutationResult
    },
    onSuccess: (_, variables) => {
      invalidateAssignmentQueries(queryClient, variables.userId)
    },
  })
}

export function useTransferAssignment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId, supervisorId, note }: AssignSupervisorPayload) => {
      const { data, error } = await api.users({ id: userId }).assignment.transfer.post({
        supervisorId,
        note,
      })

      if (error) {
        throw new Error(getErrorMessage(error, 'Failed to transfer assignment'))
      }

      return data as AssignmentMutationResult
    },
    onSuccess: (_, variables) => {
      invalidateAssignmentQueries(queryClient, variables.userId)
    },
  })
}

export function useUnassignUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId, nextState, reason, note }: UnassignPayload) => {
      const { data, error } = await api.users({ id: userId }).assignment.unassign.post({
        nextState,
        reason,
        note,
      })

      if (error) {
        throw new Error(getErrorMessage(error, 'Failed to unassign supervisor'))
      }

      return data as AssignmentMutationResult
    },
    onSuccess: (_, variables) => {
      invalidateAssignmentQueries(queryClient, variables.userId)
    },
  })
}

type UpdateSupportStatePayload = {
  userId: string
  nextState: 'OPEN' | 'ON_HOLD' | 'CLOSED'
  reason?: string
}

export function useUpdateSupportState() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId, nextState, reason }: UpdateSupportStatePayload) => {
      const { data, error } = await api.users({ id: userId }).assignment.status.post({
        nextState,
        reason,
      })

      if (error) {
        throw new Error(getErrorMessage(error, 'Failed to update support state'))
      }

      return data
    },
    onSuccess: (_, variables) => {
      invalidateAssignmentQueries(queryClient, variables.userId)
    },
  })
}