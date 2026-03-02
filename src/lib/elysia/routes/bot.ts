import { botApiClient } from '@/lib/bot-api'
import { authMacro } from '@/lib/elysia/auth'
import { Elysia } from 'elysia'

export const botRoutes = new Elysia({ prefix: '/bot' })
  .use(authMacro)

  // GET /api/bot/health - Check bot status
  .get('/health', async ({ set }) => {
    const { data, error: apiError } = await botApiClient.GET('/health')

    if (apiError) {
      set.status = 502
      return { message: 'Bot API unavailable' }
    }

    return data
  }, { modAuth: true })
