import { getDistinctRelationsToIslam } from '@/lib/db/queries'
import { authMacro } from '@/lib/elysia/auth'
import { Elysia } from 'elysia'

export const relationsRoutes = new Elysia({ prefix: '/users/relations' })
  .use(authMacro)
  .get('/', async () => {
    try {
      const relations = await getDistinctRelationsToIslam()
      return { relations }
    } catch (err) {
      console.error('Error fetching relations to Islam:', err)
      throw new Error('Failed to fetch relations')
    }
  }, { modAuth: true })
