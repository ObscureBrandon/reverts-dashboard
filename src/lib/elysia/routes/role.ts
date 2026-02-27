import { auth } from '@/lib/auth'
import { getUserRole } from '@/lib/user-role'
import { Elysia } from 'elysia'

export const roleRoutes = new Elysia({ prefix: '/role' })
  .get('/', async ({ request, set }) => {
    // Get session from request headers
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session) {
      set.status = 401
      return { error: 'Not authenticated' }
    }

    const result = await getUserRole(session.user.id)

    if (!result) {
      set.status = 500
      return { error: 'Could not determine user role' }
    }

    return result
  })
