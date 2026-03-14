'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

type GlobalSearchContextValue = {
  isOpen: boolean
  openGlobalSearch: () => void
  closeGlobalSearch: () => void
  toggleGlobalSearch: () => void
}

const GlobalSearchContext = createContext<GlobalSearchContextValue | null>(null)

export function GlobalSearchProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  const openGlobalSearch = useCallback(() => {
    setIsOpen(true)
  }, [])

  const closeGlobalSearch = useCallback(() => {
    setIsOpen(false)
  }, [])

  const toggleGlobalSearch = useCallback(() => {
    setIsOpen((current) => !current)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setIsOpen((current) => !current)
        return
      }

      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const scrollY = window.scrollY
    const { body } = document
    const previousStyles = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    }

    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'
    body.style.overflow = 'hidden'

    return () => {
      body.style.position = previousStyles.position
      body.style.top = previousStyles.top
      body.style.left = previousStyles.left
      body.style.right = previousStyles.right
      body.style.width = previousStyles.width
      body.style.overflow = previousStyles.overflow
      window.scrollTo({ top: scrollY })
    }
  }, [isOpen])

  const value = useMemo(() => ({
    isOpen,
    openGlobalSearch,
    closeGlobalSearch,
    toggleGlobalSearch,
  }), [closeGlobalSearch, isOpen, openGlobalSearch, toggleGlobalSearch])

  return <GlobalSearchContext.Provider value={value}>{children}</GlobalSearchContext.Provider>
}

export function useGlobalSearchOverlay() {
  const context = useContext(GlobalSearchContext)

  if (!context) {
    throw new Error('useGlobalSearchOverlay must be used within GlobalSearchProvider')
  }

  return context
}