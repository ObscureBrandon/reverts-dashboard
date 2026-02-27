'use client'

import { useMediaQuery } from '@/lib/hooks/useMediaQuery'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

// ============================================================================
// Types
// ============================================================================

type PanelType = 'user' | 'staff'

type PanelState = {
  userId: string | null
  panelType: PanelType
  isOpen: boolean
}

type UserPanelContextType = {
  /** Current panel state */
  panelState: PanelState
  /** Open the user details panel for a specific user */
  openUserPanel: (userId: string) => void
  /** Open the staff details panel for a specific staff member */
  openStaffPanel: (staffId: string) => void
  /** Close the currently open panel */
  closePanel: () => void
  /** Check if a specific user's panel is currently open */
  isPanelOpenForUser: (userId: string) => boolean
}

// ============================================================================
// Context
// ============================================================================

const UserPanelContext = createContext<UserPanelContextType | null>(null)

// ============================================================================
// Provider
// ============================================================================

export function UserPanelProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isMobile = useMediaQuery('(max-width: 767px)')
  
  // In-memory state for cross-page persistence
  const [panelState, setPanelState] = useState<PanelState>({
    userId: null,
    panelType: 'user',
    isOpen: false,
  })
  
  // Track if we've initialized from URL (for shared links)
  const hasInitializedRef = useRef(false)
  // Track previous pathname to detect navigation
  const prevPathnameRef = useRef(pathname)
  
  // Initialize from URL on first mount (for shared links)
  useEffect(() => {
    if (hasInitializedRef.current) return
    hasInitializedRef.current = true
    
    const userParam = searchParams.get('user')
    const staffParam = searchParams.get('staff')
    
    if (staffParam) {
      setPanelState({
        userId: staffParam,
        panelType: 'staff',
        isOpen: true,
      })
    } else if (userParam) {
      setPanelState({
        userId: userParam,
        panelType: 'user',
        isOpen: true,
      })
    }
  }, [searchParams])
  
  // Sync panel state TO URL when it changes (for shareability)
  useEffect(() => {
    if (!hasInitializedRef.current) return
    
    const currentUserParam = searchParams.get('user')
    const currentStaffParam = searchParams.get('staff')
    
    // Build new search params
    const params = new URLSearchParams(searchParams.toString())
    
    if (panelState.isOpen && panelState.userId) {
      if (panelState.panelType === 'staff') {
        params.set('staff', panelState.userId)
        params.delete('user')
      } else {
        params.set('user', panelState.userId)
        params.delete('staff')
      }
    } else {
      params.delete('user')
      params.delete('staff')
    }
    
    const newParamString = params.toString()
    const currentParamString = searchParams.toString()
    
    // Only update if params changed to avoid infinite loops
    if (newParamString !== currentParamString) {
      const newUrl = newParamString ? `${pathname}?${newParamString}` : pathname
      router.replace(newUrl, { scroll: false })
    }
  }, [panelState, pathname, router, searchParams])
  
  // On mobile, close panel when navigating to a different page
  useEffect(() => {
    if (isMobile && prevPathnameRef.current !== pathname && panelState.isOpen) {
      setPanelState(prev => ({ ...prev, isOpen: false, userId: null }))
    }
    prevPathnameRef.current = pathname
  }, [pathname, isMobile, panelState.isOpen])

  const openUserPanel = useCallback((userId: string) => {
    setPanelState({
      userId,
      panelType: 'user',
      isOpen: true,
    })
  }, [])

  const openStaffPanel = useCallback((staffId: string) => {
    setPanelState({
      userId: staffId,
      panelType: 'staff',
      isOpen: true,
    })
  }, [])

  const closePanel = useCallback(() => {
    setPanelState(prev => ({
      ...prev,
      isOpen: false,
      userId: null,
    }))
  }, [])

  const isPanelOpenForUser = useCallback((userId: string) => {
    return panelState.isOpen && panelState.userId === userId
  }, [panelState.isOpen, panelState.userId])

  return (
    <UserPanelContext.Provider
      value={{
        panelState,
        openUserPanel,
        openStaffPanel,
        closePanel,
        isPanelOpenForUser,
      }}
    >
      {children}
    </UserPanelContext.Provider>
  )
}

// ============================================================================
// Hook
// ============================================================================

export function useUserPanel() {
  const context = useContext(UserPanelContext)
  if (!context) {
    throw new Error('useUserPanel must be used within a UserPanelProvider')
  }
  return context
}
