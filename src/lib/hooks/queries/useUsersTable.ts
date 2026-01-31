'use client'

import { api } from '@/lib/eden'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'

export type UserListItem = {
  id: string
  name: string | null
  displayName: string | null
  displayAvatar: string | null
  inGuild: boolean
  isVerified: boolean
  isVoiceVerified: boolean
  relationToIslam: string | null
  gender: string | null
  age: string | null
  region: string | null
  currentAssignmentStatus: string | null
  topRoles: Array<{ id: string; name: string; color: number }>
  createdAt: string
}

export type UsersTableParams = {
  query?: string
  assignmentStatus?: string
  relationToIslam?: string
  inGuild?: boolean
  verified?: boolean
  voiceVerified?: boolean
  roleId?: string
  assignedToMe?: boolean
  hasShahada?: boolean
  hasSupport?: boolean
  sortBy?: 'name' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

type UsersResponse = {
  users: UserListItem[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

async function fetchUsers(params: UsersTableParams): Promise<UsersResponse> {
  const query: Record<string, string> = {}

  if (params.query) query.q = params.query
  if (params.assignmentStatus) query.assignmentStatus = params.assignmentStatus
  if (params.relationToIslam) query.relationToIslam = params.relationToIslam
  if (params.inGuild !== undefined) query.inGuild = String(params.inGuild)
  if (params.verified !== undefined) query.verified = String(params.verified)
  if (params.voiceVerified !== undefined) query.voiceVerified = String(params.voiceVerified)
  if (params.roleId) query.roleId = params.roleId
  if (params.assignedToMe) query.assignedToMe = 'true'
  if (params.hasShahada) query.hasShahada = 'true'
  if (params.hasSupport) query.hasSupport = 'true'
  if (params.sortBy) query.sortBy = params.sortBy
  if (params.sortOrder) query.sortOrder = params.sortOrder
  if (params.page) query.page = String(params.page)
  if (params.limit) query.limit = String(params.limit)

  const { data, error } = await api.users.get({ query })

  if (error) {
    throw new Error('Failed to fetch users')
  }

  return data as UsersResponse
}

export function useUsersTable(params: UsersTableParams) {
  return useQuery({
    queryKey: ['users', 'table', params],
    queryFn: () => fetchUsers(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
    // Keep previous data while fetching new data to prevent layout shift
    placeholderData: keepPreviousData,
  })
}

export function usePrefetchUsersTable() {
  const queryClient = useQueryClient()

  const prefetchPage = (params: UsersTableParams) => {
    queryClient.prefetchQuery({
      queryKey: ['users', 'table', params],
      queryFn: () => fetchUsers(params),
      staleTime: 5 * 60 * 1000, // 5 minutes
    })
  }

  return { prefetchPage }
}

// Roles for filter dropdown
type Role = {
  id: string
  name: string
  color: number
  position: number
}

async function fetchRoles(): Promise<{ roles: Role[] }> {
  const { data, error } = await api.roles.get()

  if (error) throw new Error('Failed to fetch roles')

  return data as { roles: Role[] }
}

export function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: fetchRoles,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Relations to Islam for filter dropdown
async function fetchRelations(): Promise<{ relations: string[] }> {
  const { data, error } = await api.users.relations.get()

  if (error) throw new Error('Failed to fetch relations')

  return data as { relations: string[] }
}

export function useRelationsToIslam() {
  return useQuery({
    queryKey: ['relations-to-islam'],
    queryFn: fetchRelations,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}
