'use client'

import { StaffDetailsPanel } from '@/app/users/components/staff-details-panel'
import { UserDetailsPanel } from '@/app/users/components/user-details-panel'
import { useUserPanel } from '@/lib/contexts/user-panel-context'
import { useUserDetails } from '@/lib/hooks/queries/useUserDetails'
import { useMediaQuery } from '@/lib/hooks/useMediaQuery'
import { useCallback, useEffect, useRef } from 'react'

/**
 * GlobalUserPanel renders a user or staff details panel globally.
 * 
 * It listens to the UserPanelContext and renders the appropriate panel.
 * This component should be placed in the providers so it's available on every page.
 * 
 * Key behaviors:
 * - If context has a userId and isOpen=true, fetch user details
 * - If user is staff (isStaff=true), automatically switch to StaffDetailsPanel
 * - Desktop: Panel persists across navigation
 * - Mobile: Panel closes on navigation (handled by context)
 */
export function GlobalUserPanel() {
  const { panelState, closePanel, openStaffPanel, openUserPanel } = useUserPanel()
  const { userId, panelType, isOpen } = panelState
  const isMobile = useMediaQuery('(max-width: 767px)')
  
  // Track if we've already auto-switched to staff panel for this user
  const autoSwitchedRef = useRef<string | null>(null)
  
  // Fetch user details to check if they're staff (only when panelType is 'user')
  const { data: userData } = useUserDetails(
    panelType === 'user' && isOpen && userId ? userId : null
  )
  
  // Auto-switch to staff panel if user is staff
  useEffect(() => {
    if (
      panelType === 'user' && 
      userData?.user?.isStaff && 
      userId && 
      autoSwitchedRef.current !== userId
    ) {
      autoSwitchedRef.current = userId
      openStaffPanel(userId)
    }
  }, [userData?.user?.isStaff, userId, panelType, openStaffPanel])
  
  // Reset auto-switch tracking when panel closes or user changes
  useEffect(() => {
    if (!isOpen || !userId) {
      autoSwitchedRef.current = null
    }
  }, [isOpen, userId])

  // Handle clicking on a supervisee in the staff panel
  const handleSuperviseeClick = useCallback((superviseeId: string) => {
    openUserPanel(superviseeId)
  }, [openUserPanel])

  // Render the appropriate panel based on panelType
  if (panelType === 'staff') {
    return (
      <StaffDetailsPanel
        staffId={userId}
        open={isOpen}
        onOpenChange={(open) => !open && closePanel()}
        onSuperviseeClick={handleSuperviseeClick}
      />
    )
  }

  return (
    <UserDetailsPanel
      userId={userId}
      open={isOpen}
      onOpenChange={(open) => !open && closePanel()}
    />
  )
}
