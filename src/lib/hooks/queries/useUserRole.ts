'use client'

import { useQuery } from '@tanstack/react-query'

export type UserRole = 'mod' | 'trial_support' | 'user'

export type UserCapabilities = {
  canAccessDashboard: boolean
  canAccessUsersPage: boolean
  canAccessStaffOverview: boolean
  canAccessTicketsPage: boolean
  canAccessMessagesPage: boolean
  canUseGlobalSearch: boolean
  canManageTagCatalog: boolean
  canAccessBotHealth: boolean
  canPerformCrossStaffActions: boolean
  canGenerateTicketSummary: boolean
}

type UserRoleResponse = {
  role: UserRole
  discordId: string
  capabilities: UserCapabilities
}

/**
 * Hook to fetch the current user's role and Discord ID.
 * Returns role-derived capabilities for gating UI and requests.
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

  const capabilities = query.data?.capabilities ?? null

  return {
    role: query.data?.role ?? null,
    discordId: query.data?.discordId ?? null,
    capabilities,
    isStaff: query.data?.role === 'mod' || query.data?.role === 'trial_support',
    isMod: query.data?.role === 'mod',
    isTrialSupport: query.data?.role === 'trial_support',
    isUser: query.data?.role === 'user',
    canAccessDashboard: capabilities?.canAccessDashboard ?? false,
    canAccessUsersPage: capabilities?.canAccessUsersPage ?? false,
    canAccessStaffOverview: capabilities?.canAccessStaffOverview ?? false,
    canAccessTicketsPage: capabilities?.canAccessTicketsPage ?? false,
    canAccessMessagesPage: capabilities?.canAccessMessagesPage ?? false,
    canUseGlobalSearch: capabilities?.canUseGlobalSearch ?? false,
    canManageTagCatalog: capabilities?.canManageTagCatalog ?? false,
    canAccessBotHealth: capabilities?.canAccessBotHealth ?? false,
    canPerformCrossStaffActions: capabilities?.canPerformCrossStaffActions ?? false,
    canGenerateTicketSummary: capabilities?.canGenerateTicketSummary ?? false,
    isLoading: query.isLoading,
    error: query.error,
  }
}
