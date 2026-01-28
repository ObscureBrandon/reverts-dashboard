import { auth } from '@/lib/auth'
import { Elysia } from 'elysia'

/**
 * Auth macro for Elysia routes
 * Provides user and session context to protected routes
 */
export const authMacro = new Elysia({ name: 'auth-macro' })
  .macro({
    auth: {
      async resolve({ status, request: { headers } }) {
        const session = await auth.api.getSession({ headers })

        if (!session) {
          return status(401)
        }

        return {
          user: session.user,
          session: session.session
        }
      }
    }
  })
