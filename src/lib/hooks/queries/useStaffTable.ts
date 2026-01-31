'use client'

import { api } from '@/lib/eden'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'

export type StaffListItem = {
  id: string
  name: string | null
  displayName: string | null
  displayAvatar: string | null
  superviseeCount: number
  supervisees: Array<{ id: string; name: string | null; displayName: string | null }>
  topRoles: Array<{ id: string; name: string; color: number }>
}

export type StaffTableParams = {
  query?: string
  sortBy?: 'name' | 'superviseeCount'
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

type StaffResponse = {
  staff: StaffListItem[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

async function fetchStaff(params: StaffTableParams): Promise<StaffResponse> {
  const query: Record<string, string> = {}

  if (params.query) query.q = params.query
  if (params.sortBy) query.sortBy = params.sortBy
  if (params.sortOrder) query.sortOrder = params.sortOrder
  if (params.page) query.page = String(params.page)
  if (params.limit) query.limit = String(params.limit)

  const { data, error } = await api.users.staff.get({ query })

  if (error) {
    throw new Error('Failed to fetch staff')
  }

  return data as StaffResponse
}

export function useStaffTable(params: StaffTableParams) {
  return useQuery({
    queryKey: ['users', 'staff', params],
    queryFn: () => fetchStaff(params),
    staleTime: 30 * 1000, // 30 seconds
    placeholderData: keepPreviousData,
  })
}

export function usePrefetchStaffTable() {
  const queryClient = useQueryClient()

  const prefetchPage = (params: StaffTableParams) => {
    queryClient.prefetchQuery({
      queryKey: ['users', 'staff', params],
      queryFn: () => fetchStaff(params),
      staleTime: 30 * 1000,
    })
  }

  return { prefetchPage }
}
