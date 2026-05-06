import { auth } from '@/lib/auth'
import { getUserRole } from '@/lib/user-role'
import { Elysia } from 'elysia'

/**
 * Auth macro for Elysia routes.
 * Provides two guards:
 * - `auth`: Requires any authenticated session, returns user + session
 * - `staffAuth`: Requires authenticated dashboard staff access
 * - `modAuth`: Requires authenticated session with mod role, returns user + session + discordId
 */
export const authMacro = new Elysia({ name: 'auth-macro' })
  .macro({
    auth: {
      async resolve({ status, request: { headers } }) {
        const session = await auth.api.getSession({ headers })

        if (!session) {
          return status(401)
        }

        const access = await getUserRole(session.user.id)

        return {
          user: session.user,
          session: session.session,
          access,
          discordId: access?.discordId ?? null,
        }
      }
    },
    staffAuth: {
      async resolve({ status, request: { headers } }) {
        const session = await auth.api.getSession({ headers })

        if (!session) {
          return status(401)
        }

        const access = await getUserRole(session.user.id)

        if (!access || !access.capabilities.canAccessDashboard) {
          return status(403)
        }

        return {
          user: session.user,
          session: session.session,
          access,
          discordId: access.discordId,
        }
      }
    },
    modAuth: {
      async resolve({ status, request: { headers } }) {
        const session = await auth.api.getSession({ headers })

        if (!session) {
          return status(401)
        }

        const result = await getUserRole(session.user.id)

        if (!result || result.role !== 'mod') {
          return status(403)
        }

        return {
          user: session.user,
          session: session.session,
          access: result,
          discordId: result.discordId,
        }
      }
    }
  })
