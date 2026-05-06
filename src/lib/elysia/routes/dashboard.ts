import { getMyDashboardData } from '@/lib/db/queries'
import { authMacro } from '@/lib/elysia/auth'
import { Elysia } from 'elysia'

export const dashboardRoutes = new Elysia({ prefix: '/dashboard' })
  .use(authMacro)

  // GET /dashboard - Get dashboard data for the logged-in staff member
  .get('/', async ({ access, discordId }) => {
    try {
      const data = await getMyDashboardData(BigInt(discordId), {
        includeStaleTickets: access.role === 'mod',
        includeMentionedTickets: access.role === 'mod',
      })
      return data
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      throw new Error('Failed to fetch dashboard data')
    }
  }, { staffAuth: true })
