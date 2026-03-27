'use client'

import { useMediaQuery } from '@/lib/hooks/useMediaQuery'
import type { ReadonlyURLSearchParams } from 'next/navigation'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

// ============================================================================
// Types
// ============================================================================

type PanelType = 'user' | 'staff'

type PanelEntry = {
  userId: string
  panelType: PanelType
}

type PanelState = {
  /** Ordered bottom→top. Top of stack = currently visible panel. */
  stack: PanelEntry[]
  /** Derived: true when stack has entries */
  isOpen: boolean
}

type UserPanelContextType = {
  /** Full panel state */
  panelState: PanelState
  /** Currently visible panel entry (top of stack), or null */
  currentPanel: PanelEntry | null
  /** Parent panel for breadcrumb display (second from top), or null */
  parentPanel: PanelEntry | null
  /** Whether there's a panel to go back to */
  canGoBack: boolean
  /** Push a user panel onto the stack */
  openUserPanel: (userId: string) => void
  /** Push a staff panel onto the stack */
  openStaffPanel: (staffId: string) => void
  /** Pop the top entry; if stack becomes empty, panel closes */
  goBack: () => void
  /** Clear the entire stack (close everything) */
  closePanel: () => void
  /** Check if a specific user's panel is currently showing */
  isPanelOpenForUser: (userId: string) => boolean
}

// ============================================================================
// Context
// ============================================================================

const UserPanelContext = createContext<UserPanelContextType | null>(null)

function getStackFromSearchParams(searchParams: ReadonlyURLSearchParams): PanelEntry[] {
  const userParam = searchParams.get('user')
  const staffParam = searchParams.get('staff')

  if (staffParam && userParam) {
    return [
      { userId: staffParam, panelType: 'staff' },
      { userId: userParam, panelType: 'user' },
    ]
  }

  if (staffParam) {
    return [{ userId: staffParam, panelType: 'staff' }]
  }

  if (userParam) {
    return [{ userId: userParam, panelType: 'user' }]
  }

  return []
}

// ============================================================================
// Provider
// ============================================================================

export function UserPanelProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isMobile = useMediaQuery('(max-width: 767px)')
  
  // Stack-based state
  const [stack, setStack] = useState<PanelEntry[]>(() => getStackFromSearchParams(searchParams))
  const [stackPath, setStackPath] = useState(pathname)
  const visibleStack = useMemo(() => {
    if (isMobile && stackPath !== pathname) {
      return []
    }

    return stack
  }, [isMobile, pathname, stack, stackPath])
  
  // Derived state
  const isOpen = visibleStack.length > 0
  const currentPanel = visibleStack.length > 0 ? visibleStack[visibleStack.length - 1] : null
  const parentPanel = visibleStack.length > 1 ? visibleStack[visibleStack.length - 2] : null
  const canGoBack = visibleStack.length > 1
  
  const panelState: PanelState = useMemo(() => ({
    stack: visibleStack,
    isOpen,
  }), [visibleStack, isOpen])
  
  // Sync stack TO URL when it changes
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    
    if (isOpen && currentPanel) {
      // Always reflect the top-of-stack in URL
      if (currentPanel.panelType === 'staff') {
        params.set('staff', currentPanel.userId)
        params.delete('user')
      } else {
        params.set('user', currentPanel.userId)
        // Keep staff param if parent is staff (for shareable stacked URLs)
        if (parentPanel?.panelType === 'staff') {
          params.set('staff', parentPanel.userId)
        } else {
          params.delete('staff')
        }
      }
    } else {
      params.delete('user')
      params.delete('staff')
    }
    
    const newParamString = params.toString()
    const currentParamString = searchParams.toString()
    
    if (newParamString !== currentParamString) {
      const newUrl = newParamString ? `${pathname}?${newParamString}` : pathname
      router.replace(newUrl, { scroll: false })
    }
  }, [currentPanel, isOpen, parentPanel, pathname, router, searchParams])

  const openUserPanel = useCallback((userId: string) => {
    setStackPath(pathname)
    setStack(prev => {
      const baseStack = isMobile && stackPath !== pathname ? [] : prev
      // Don't push duplicate of what's already on top
      const top = baseStack.length > 0 ? baseStack[baseStack.length - 1] : null
      if (top && top.userId === userId && top.panelType === 'user') {
        return baseStack
      }
      return [...baseStack, { userId, panelType: 'user' as const }]
    })
  }, [isMobile, pathname, stackPath])

  const openStaffPanel = useCallback((staffId: string) => {
    setStackPath(pathname)
    setStack(prev => {
      const baseStack = isMobile && stackPath !== pathname ? [] : prev
      // Don't push duplicate of what's already on top
      const top = baseStack.length > 0 ? baseStack[baseStack.length - 1] : null
      if (top && top.userId === staffId && top.panelType === 'staff') {
        return baseStack
      }
      return [...baseStack, { userId: staffId, panelType: 'staff' as const }]
    })
  }, [isMobile, pathname, stackPath])

  const goBack = useCallback(() => {
    setStack(prev => {
      if (prev.length <= 1) return [] // close entirely
      return prev.slice(0, -1) // pop top
    })
  }, [])

  const closePanel = useCallback(() => {
    setStack([])
  }, [])

  const isPanelOpenForUser = useCallback((userId: string) => {
    return currentPanel?.userId === userId
  }, [currentPanel])

  return (
    <UserPanelContext.Provider
      value={{
        panelState,
        currentPanel,
        parentPanel,
        canGoBack,
        openUserPanel,
        openStaffPanel,
        goBack,
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
