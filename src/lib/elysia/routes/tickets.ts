import { generateTicketSummary } from '@/lib/ai/gemini'
import { db } from '@/lib/db'
import { getTicketById, getTicketCount, getTickets } from '@/lib/db/queries'
import { tickets } from '@/lib/db/schema'
import { authMacro } from '@/lib/elysia/auth'
import { eq } from 'drizzle-orm'
import { Elysia } from 'elysia'

export const ticketsRoutes = new Elysia({ prefix: '/tickets' })
  .use(authMacro)
  // GET /tickets - List tickets with filters
  .get('/', async ({ query, set }) => {
    const ticketId = query.id

    // If requesting a specific ticket by ID
    if (ticketId) {
      try {
        const ticket = await getTicketById(parseInt(ticketId))

        if (!ticket) {
          set.status = 404
          return { error: 'Ticket not found' }
        }

        set.headers['Cache-Control'] = 'public, s-maxage=60, stale-while-revalidate=300'

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
        console.error('Ticket fetch error:', error)
        throw new Error('Failed to fetch ticket')
      }
    }

    // Otherwise, return list of tickets
    const status = query.status as 'OPEN' | 'CLOSED' | 'DELETED' | undefined
    const authorIdParam = query.author
    const panelParam = query.panel
    const search = query.search || undefined
    const sortBy = query.sortBy as 'newest' | 'oldest' | 'messages' | undefined
    const page = parseInt(query.page || '1')
    const limit = parseInt(query.limit || '50')

    try {
      const offset = (page - 1) * limit

      // Parse authorId and panelId if provided
      const authorId = authorIdParam ? BigInt(authorIdParam) : undefined
      const panelId = panelParam ? parseInt(panelParam) : undefined

      const results = await getTickets({
        status: status || undefined,
        authorId,
        panelId,
        search,
        sortBy: sortBy || 'newest',
        limit,
        offset,
      })

      const total = await getTicketCount({
        status: status || undefined,
        authorId,
        panelId,
        search,
      })

      set.headers['Cache-Control'] = 'public, s-maxage=30, stale-while-revalidate=120'

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
      console.error('Tickets list error:', error)
      throw new Error('Failed to fetch tickets')
    }
  }, { modAuth: true })

  // POST /tickets/:id/summary - Generate AI summary
  .post('/:id/summary', async ({ params, set }) => {
    try {
      const ticketId = parseInt(params.id)

      if (isNaN(ticketId)) {
        set.status = 400
        return { error: 'Invalid ticket ID' }
      }

      // Generate the summary
      const { summary, tokensUsed, model } = await generateTicketSummary(ticketId)

      // Update the ticket with the summary
      await db
        .update(tickets)
        .set({
          summary,
          summaryGeneratedAt: new Date(),
          summaryModel: model,
          summaryTokensUsed: tokensUsed,
        })
        .where(eq(tickets.id, ticketId))

      return {
        success: true,
        summary,
        tokensUsed,
        model,
      }
    } catch (error) {
      console.error('Error generating ticket summary:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate summary'
      throw new Error(errorMessage)
    }
  }, { modAuth: true })
