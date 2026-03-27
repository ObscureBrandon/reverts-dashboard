'use client'

import { useSyncExternalStore } from 'react'

/**
 * Hook that returns true if the given media query matches
 * 
 * @param query - CSS media query string, e.g. '(max-width: 767px)'
 * @returns boolean indicating if the query matches
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = (callback: () => void) => {
    const mediaQuery = window.matchMedia(query)

    mediaQuery.addEventListener('change', callback)

    return () => {
      mediaQuery.removeEventListener('change', callback)
    }
  }

  const getSnapshot = () => {
    if (typeof window === 'undefined') {
      return false
    }

    return window.matchMedia(query).matches
  }

  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
