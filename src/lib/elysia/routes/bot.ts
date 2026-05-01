import { botApiClient } from '@/lib/bot-api'
import { authMacro } from '@/lib/elysia/auth'
import { Elysia } from 'elysia'

type StartCheckInRequest = {
  revertUserId?: string
}

type StartCheckInResponse = {
  outcome: string
  ticketId: number
  channelId: string
  channelName: string
  guildId: string
  ticketViewMessageId: string | null
  discordUrl: string
  panelId: number
  panelTitle: string
}

function normalizeBotStatus(status?: number): number {
  if (!status) {
    return 502
  }

  if (status === 422) {
    return 400
  }

  if (status === 503) {
    return 502
  }

  return status
}

function normalizeBotError(apiError: unknown, status?: number) {
  const normalizedStatus = normalizeBotStatus(status)

  if (apiError && typeof apiError === 'object' && 'detail' in apiError) {
    const detail = (apiError as { detail?: unknown }).detail

    if (Array.isArray(detail)) {
      return {
        status: normalizedStatus,
        body: { error: 'Invalid check-in request' },
      }
    }

    if (detail && typeof detail === 'object') {
      const message = 'message' in detail ? detail.message : undefined
      const code = 'code' in detail ? detail.code : undefined

      return {
        status: normalizedStatus,
        body: {
          error: typeof message === 'string' && message.length > 0 ? message : 'Failed to start check-in ticket',
          code: typeof code === 'string' ? code : undefined,
        },
      }
    }

    if (typeof detail === 'string' && detail.length > 0) {
      return {
        status: normalizedStatus,
        body: { error: detail },
      }
    }
  }

  return {
    status: normalizedStatus,
    body: {
      error: normalizedStatus === 502 ? 'Bot API unavailable' : 'Failed to start check-in ticket',
    },
  }
}

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

  .post('/check-ins/start', async ({ body, discordId, set }) => {
    const { revertUserId } = body as StartCheckInRequest

    if (!revertUserId || !/^\d+$/.test(revertUserId)) {
      set.status = 400
      return { error: 'Invalid revert user ID', code: 'INVALID_REVERT_USER_ID' }
    }

    if (!discordId || !/^\d+$/.test(discordId)) {
      set.status = 500
      return { error: 'Acting moderator is missing a Discord ID', code: 'MOD_DISCORD_ID_MISSING' }
    }

    const { data, error: apiError, response } = await botApiClient.POST('/check-ins/start', {
      body: {
        revert_user_id: revertUserId,
        started_by_id: discordId,
      },
    })

    if (apiError) {
      const normalizedError = normalizeBotError(apiError, response.status)
      set.status = normalizedError.status
      return normalizedError.body
    }

    return {
      outcome: data.outcome,
      ticketId: data.ticket_id,
      channelId: data.channel_id,
      channelName: data.channel_name,
      guildId: data.guild_id,
      ticketViewMessageId: data.ticket_view_message_id,
      discordUrl: data.discord_url,
      panelId: data.panel_id,
      panelTitle: data.panel_title,
    } satisfies StartCheckInResponse
  }, { modAuth: true })
