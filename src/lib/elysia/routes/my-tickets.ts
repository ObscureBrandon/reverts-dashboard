import { auth } from '@/lib/auth'
import { getTicketById, getTicketCount, getTickets } from '@/lib/db/queries'
import { getDiscordIdFromSession } from '@/lib/user-role'
import { Elysia } from 'elysia'

export const myTicketsRoutes = new Elysia({ prefix: '/my-tickets' })
  /**
   * GET /my-tickets - List the authenticated user's own tickets
   * Supports: pagination, status filter
   */
  .get('/', async ({ query, request, set }) => {
    // Authenticate: get session from request
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      set.status = 401
      return { error: 'Not authenticated' }
    }

    // Resolve Discord ID from session
    const discordId = await getDiscordIdFromSession(session.user.id)
    if (!discordId) {
      set.status = 500
      return { error: 'Could not determine Discord ID' }
    }

    const ticketId = query.id

    // Single ticket detail — only if the user is the author
    if (ticketId) {
      try {
        const ticket = await getTicketById(parseInt(ticketId))

        if (!ticket) {
          set.status = 404
          return { error: 'Ticket not found' }
        }

        // Ownership check
        if (ticket.author?.discordId.toString() !== discordId) {
          set.status = 403
          return { error: 'Access denied' }
        }

        set.headers['Cache-Control'] = 'private, s-maxage=60, stale-while-revalidate=300'

        return {
          ticket: {
            id: ticket.ticket.id,
            sequence: ticket.ticket.sequence,
            status: ticket.ticket.status,
            createdAt: ticket.ticket.createdAt?.toISOString(),
            closedAt: ticket.ticket.closedAt?.toISOString(),
            author: ticket.author ? {
              id: ticket.author.discordId.toString(),
              name: ticket.author.name || ticket.author.displayName || 'Unknown User',
              displayName: ticket.author.displayName,
              displayAvatar: ticket.author.displayAvatar,
            } : null,
            channel: ticket.channel ? {
              id: ticket.channel.channelId.toString(),
              name: ticket.channel.name,
            } : null,
            panel: ticket.panel ? {
              id: ticket.panel.id,
              title: ticket.panel.title,
            } : null,
            messageCount: ticket.messageCount || 0,
            summary: ticket.ticket.summary,
            summaryGeneratedAt: ticket.ticket.summaryGeneratedAt?.toISOString(),
            summaryModel: ticket.ticket.summaryModel,
            summaryTokensUsed: ticket.ticket.summaryTokensUsed,
          }
        }
      } catch (error) {
        console.error('My ticket fetch error:', error)
        throw new Error('Failed to fetch ticket')
      }
    }

    // List user's tickets
    const status = query.status as 'OPEN' | 'CLOSED' | 'DELETED' | undefined
    const page = parseInt(query.page || '1')
    const limit = parseInt(query.limit || '50')

    try {
      const offset = (page - 1) * limit
      const authorId = BigInt(discordId)

      const results = await getTickets({
        status: status || undefined,
        authorId,
        sortBy: 'newest',
        limit,
        offset,
      })

      const total = await getTicketCount({
        status: status || undefined,
        authorId,
      })

      set.headers['Cache-Control'] = 'private, s-maxage=30, stale-while-revalidate=120'

      return {
        tickets: results.map(r => ({
          id: r.ticket.id,
          sequence: r.ticket.sequence,
          status: r.ticket.status,
          createdAt: r.ticket.createdAt?.toISOString(),
          closedAt: r.ticket.closedAt?.toISOString(),
          author: r.author ? {
            id: r.author.discordId.toString(),
            name: r.author.name || r.author.displayName || 'Unknown User',
            displayName: r.author.displayName,
            displayAvatar: r.author.displayAvatar,
          } : null,
          channel: r.channel ? {
            id: r.channel.channelId.toString(),
            name: r.channel.name,
          } : null,
          panel: r.panel ? {
            id: r.panel.id,
            title: r.panel.title,
          } : null,
          messageCount: r.messageCount || 0,
        })),
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      console.error('My tickets list error:', error)
      throw new Error('Failed to fetch tickets')
    }
  })
