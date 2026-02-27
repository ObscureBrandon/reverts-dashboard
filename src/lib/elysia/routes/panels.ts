import { getAllPanels } from '@/lib/db/queries'
import { authMacro } from '@/lib/elysia/auth'
import { Elysia } from 'elysia'

export const panelsRoutes = new Elysia({ prefix: '/panels' })
  .use(authMacro)
  .get('/', async ({ set }) => {
    try {
      const panels = await getAllPanels()

      // Set cache headers
      set.headers['Cache-Control'] = 'public, s-maxage=300, stale-while-revalidate=600'

      return { panels }
    } catch (err) {
      console.error('Error fetching panels:', err)
      throw new Error('Failed to fetch panels')
    }
  }, { modAuth: true })
