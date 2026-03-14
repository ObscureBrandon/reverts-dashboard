'use client'

import { PanelBreadcrumb, StaffPanelContent } from '@/app/users/components/staff-details-panel'
import { UserPanelContent } from '@/app/users/components/user-details-panel'
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerTitle,
} from '@/components/ui/drawer'
import { useUserPanel } from '@/lib/contexts/user-panel-context'
import { useStaffDetails } from '@/lib/hooks/queries/useStaffDetails'
import { useUserDetails } from '@/lib/hooks/queries/useUserDetails'
import { useMediaQuery } from '@/lib/hooks/useMediaQuery'
import { cn } from '@/lib/utils'
import * as VisuallyHidden from '@radix-ui/react-visually-hidden'
import { X } from 'lucide-react'
import { useCallback, useEffect, useRef } from 'react'

/**
 * GlobalUserPanel renders a single panel shell (Drawer on mobile, side panel on desktop)
 * and swaps the content inside based on the panel stack.
 * 
 * Key behaviors:
 * - ONE shell component stays mounted — content swaps, no close/reopen
 * - Stack-based navigation: clicking a supervisee pushes, "back" pops
 * - Auto-switches user → staff if the user is a staff member
 * - Desktop: Panel persists across navigation
 * - Mobile: Panel closes on navigation (handled by context)
 */
export function GlobalUserPanel() {
  const { 
    currentPanel, parentPanel, canGoBack, panelState,
    closePanel, goBack, openStaffPanel, openUserPanel 
  } = useUserPanel()
  const isMobile = useMediaQuery('(max-width: 767px)')
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  
  const isOpen = panelState.isOpen
  
  // Track if we've already auto-switched to staff panel for this user
  const autoSwitchedRef = useRef<string | null>(null)
  
  // Fetch data based on current panel type
  const { data: userData, isLoading: userLoading, error: userError } = useUserDetails(
    currentPanel?.panelType === 'user' && currentPanel.userId ? currentPanel.userId : null
  )
  const { data: staffData, isLoading: staffLoading, error: staffError } = useStaffDetails(
    currentPanel?.panelType === 'staff' && currentPanel?.userId ? currentPanel.userId : null
  )
  
  // Also fetch parent staff data for breadcrumb display
  const { data: parentStaffData } = useStaffDetails(
    parentPanel?.panelType === 'staff' ? parentPanel.userId : null
  )
  
  // Auto-switch to staff panel if user is staff
  useEffect(() => {
    if (
      currentPanel?.panelType === 'user' && 
      userData?.user?.isStaff && 
      currentPanel.userId && 
      autoSwitchedRef.current !== currentPanel.userId
    ) {
      autoSwitchedRef.current = currentPanel.userId
      openStaffPanel(currentPanel.userId)
    }
  }, [userData?.user?.isStaff, currentPanel, openStaffPanel])
  
  // Reset auto-switch tracking when panel closes or user changes
  useEffect(() => {
    if (!isOpen || !currentPanel?.userId) {
      autoSwitchedRef.current = null
    }
  }, [isOpen, currentPanel?.userId])

  // Escape key to close panel (desktop only)
  useEffect(() => {
    if (!isOpen || isMobile) return
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closePanel()
      }
    }
    
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, isMobile, closePanel])

  // Focus close button when panel opens (desktop only)
  useEffect(() => {
    if (isOpen && !isMobile && closeButtonRef.current) {
      const timer = setTimeout(() => {
        closeButtonRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isOpen, isMobile])

  // Handle clicking on a supervisee in the staff panel
  const handleSuperviseeClick = useCallback((superviseeId: string) => {
    openUserPanel(superviseeId)
  }, [openUserPanel])

  // Build breadcrumb from parent panel
  const breadcrumb = canGoBack && parentPanel?.panelType === 'staff' && parentStaffData ? (
    <PanelBreadcrumb
      staffName={parentStaffData.staff.displayName || parentStaffData.staff.name || 'Staff'}
      onBack={goBack}
    />
  ) : undefined

  // Determine which content to render
  const isStaffPanel = currentPanel?.panelType === 'staff'
  const panelContent = isStaffPanel ? (
    <StaffPanelContent
      data={staffData}
      isLoading={staffLoading}
      error={staffError}
      onSuperviseeClick={handleSuperviseeClick}
      breadcrumb={breadcrumb}
    />
  ) : (
    <UserPanelContent
      data={userData}
      isLoading={userLoading}
      error={userError}
      isMobile={isMobile}
      breadcrumb={breadcrumb}
    />
  )

  // Mobile: Use Drawer with swipe gestures — single drawer, content swaps inside
  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && closePanel()}>
        <DrawerContent className="max-h-[85vh] flex flex-col overflow-hidden rounded-t-2xl bg-card p-0 text-card-foreground shadow-2xl">
          <VisuallyHidden.Root>
            <DrawerTitle>{isStaffPanel ? 'Staff Details' : 'User Details'}</DrawerTitle>
            <DrawerDescription>
              {isStaffPanel ? 'Staff member details' : 'User details'}
            </DrawerDescription>
          </VisuallyHidden.Root>
          {panelContent}
        </DrawerContent>
      </Drawer>
    )
  }

  // Desktop/Tablet: Use fixed positioned panel with slide animation
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={isStaffPanel ? 'Staff details' : 'User details'}
      className={cn(
        'fixed top-0 right-0 z-50 flex h-full w-[440px] max-w-[calc(100vw-0.75rem)] flex-col overflow-hidden',
        'border-l border-border bg-card text-card-foreground shadow-2xl ring-1 ring-border/50',
        'transform transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
        isOpen ? 'translate-x-0 pointer-events-auto' : 'translate-x-full pointer-events-none'
      )}
      style={{ willChange: 'transform' }}
    >
      {/* Close button */}
      <button
        ref={closeButtonRef}
        onClick={() => closePanel()}
        className="absolute right-4 top-4 z-20 rounded-full border border-border bg-background/95 p-2 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        aria-label="Close panel"
      >
        <X className="h-4 w-4" />
      </button>
      {panelContent}
    </div>
  )
}
