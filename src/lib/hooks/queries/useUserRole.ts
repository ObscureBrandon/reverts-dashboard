'use client'

import { useQuery } from '@tanstack/react-query'

export type UserRole = 'mod' | 'user'

type UserRoleResponse = {
  role: UserRole
  discordId: string
}

/**
 * Hook to fetch the current user's role and Discord ID.
 * Returns whether they are a mod or a regular user.
 */
export function useUserRole() {
  const query = useQuery({
    queryKey: ['user-role'],
    queryFn: async (): Promise<UserRoleResponse> => {
      const res = await fetch('/api/role', { credentials: 'include' })

      if (!res.ok) {
        throw new Error('Failed to fetch user role')
      }

      return res.json()
    },
    staleTime: 5 * 60 * 1000, // Role rarely changes, cache for 5 minutes
    retry: 1,
  })

  return {
    role: query.data?.role ?? null,
    discordId: query.data?.discordId ?? null,
    isMod: query.data?.role === 'mod',
    isUser: query.data?.role === 'user',
    isLoading: query.isLoading,
    error: query.error,
  }
}
