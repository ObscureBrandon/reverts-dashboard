import type { App } from '@/app/api/[[...slugs]]/route'
import { treaty } from '@elysiajs/eden'

/**
 * Type-safe API client using Eden treaty
 * 
 * Uses isomorphic pattern:
 * - Server: Direct function calls (no network overhead)
 * - Client: HTTP calls through the network
 * 
 * Usage:
 * ```ts
 * // Get users with type safety
 * const { data, error } = await api.users.get({ query: { limit: '10' } })
 * 
 * // Get a specific user
 * const { data } = await api.users({ id: '123' }).get()
 * ```
 */
export const api = treaty<App>(
  typeof process !== 'undefined' && process.env.BETTER_AUTH_URL
    ? process.env.BETTER_AUTH_URL
    : typeof window !== 'undefined'
      ? window.location.origin
      : 'http://localhost:3000'
).api
