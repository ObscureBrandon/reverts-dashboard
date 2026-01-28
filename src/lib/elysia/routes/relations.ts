import { getDistinctRelationsToIslam } from '@/lib/db/queries'
import { Elysia } from 'elysia'

export const relationsRoutes = new Elysia({ prefix: '/users/relations' })
  .get('/', async () => {
    try {
      const relations = await getDistinctRelationsToIslam()
      return { relations }
    } catch (err) {
      console.error('Error fetching relations to Islam:', err)
      throw new Error('Failed to fetch relations')
    }
  })
