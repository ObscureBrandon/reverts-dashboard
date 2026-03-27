import { db } from '@/lib/db'
import { getTickets, searchMessages, searchUsers } from '@/lib/db/queries'
import { channels, panels, tickets, users } from '@/lib/db/schema'
import { authMacro } from '@/lib/elysia/auth'
import { parseGlobalSearchQuery, type ParsedGlobalSearchQuery } from '@/lib/search/global-search-query'
import { and, eq, or } from 'drizzle-orm'
import { Elysia } from 'elysia'

type SearchMatchReason =
  | 'discord_id'
  | 'username'
  | 'ticket_id'
  | 'ticket_sequence'
  | 'channel_id'
  | 'ticket_author'
  | 'participant'
  | 'message_content'
  | 'message_author'

type GlobalSearchUserResult = {
  id: string
  name: string | null
  displayName: string | null
  displayAvatar: string | null
  matchReason: SearchMatchReason
}

type GlobalSearchTicketResult = {
  id: number
  sequence: number | null
  status: string | null
  createdAt: string
  channelId: string | null
  channelName: string | null
  panelTitle: string | null
  author: {
    id: string
    name: string | null
    displayName: string | null
    displayAvatar: string | null
  } | null
  matchReason: SearchMatchReason
}

type GlobalSearchMessageResult = {
  id: string
  content: string
  preview: string
  highlightTerm: string | null
  createdAt: string
  author: {
    id: string
    name: string | null
    displayName: string | null
    displayAvatar: string | null
  } | null
  ticketId: number
  ticketSequence: number | null
  channelId: string | null
  channelName: string | null
  matchReason: SearchMatchReason
}

function resolveUserSearchTerm(parsed: ParsedGlobalSearchQuery) {
  return parsed.userTerm || parsed.fromTerm || parsed.text || ''
}

function resolveTicketSearchTerm(parsed: ParsedGlobalSearchQuery) {
  return parsed.ticketTerm || parsed.channelTerm || parsed.userTerm || parsed.text || ''
}

function resolveMessageSearchTerm(parsed: ParsedGlobalSearchQuery) {
  if (parsed.containsTerm) {
    return parsed.containsTerm
  }

  if (parsed.text) {
    return parsed.text
  }

  return ''
}

function resolveUserExactIdTerm(parsed: ParsedGlobalSearchQuery) {
  const candidate = parsed.userTerm || parsed.fromTerm || parsed.text
  return candidate && /^\d+$/.test(candidate.trim()) ? candidate.trim() : null
}

function createMessagePreview(content: string, highlightTerm: string | null) {
  const normalizedContent = content.trim()

  if (!normalizedContent) {
    return '(No text content)'
  }

  if (!highlightTerm) {
    return normalizedContent.length > 180 ? `${normalizedContent.slice(0, 177)}...` : normalizedContent
  }

  const lowerContent = normalizedContent.toLowerCase()
  const lowerHighlight = highlightTerm.toLowerCase()
  const matchIndex = lowerContent.indexOf(lowerHighlight)

  if (matchIndex === -1) {
    return normalizedContent.length > 180 ? `${normalizedContent.slice(0, 177)}...` : normalizedContent
  }

  const previewStart = Math.max(0, matchIndex - 50)
  const previewEnd = Math.min(normalizedContent.length, matchIndex + highlightTerm.length + 90)
  const prefix = previewStart > 0 ? '...' : ''
  const suffix = previewEnd < normalizedContent.length ? '...' : ''

  return `${prefix}${normalizedContent.slice(previewStart, previewEnd)}${suffix}`
}

function getTicketRank(matchReason: SearchMatchReason) {
  switch (matchReason) {
    case 'ticket_id':
      return 0
    case 'ticket_sequence':
      return 1
    case 'channel_id':
      return 2
    case 'ticket_author':
      return 3
    case 'participant':
      return 4
    default:
      return 5
  }
}

function getMessageRank(matchReason: SearchMatchReason) {
  switch (matchReason) {
    case 'message_author':
      return 0
    case 'message_content':
    default:
      return 1
  }
}

function buildUserResult(user: {
  discordId: bigint
  name: string | null
  displayName: string | null
  displayAvatar: string | null
}, matchReason: SearchMatchReason): GlobalSearchUserResult {
  return {
    id: user.discordId.toString(),
    name: user.name,
    displayName: user.displayName,
    displayAvatar: user.displayAvatar,
    matchReason,
  }
}

function buildTicketResult(row: {
  ticket: {
    id: number
    sequence: number | null
    status: string | null
    channelId: bigint | null
    createdAt: Date
  }
  author: {
    discordId: bigint
    name: string | null
    displayName: string | null
    displayAvatar: string | null
  } | null
  channel: {
    channelId: bigint
    name: string
  } | null
  panel: {
    title: string
  } | null
  matchReason: SearchMatchReason
}): GlobalSearchTicketResult {
  return {
    id: row.ticket.id,
    sequence: row.ticket.sequence,
    status: row.ticket.status,
    createdAt: row.ticket.createdAt.toISOString(),
    channelId: row.channel?.channelId.toString() ?? row.ticket.channelId?.toString() ?? null,
    channelName: row.channel?.name ?? null,
    panelTitle: row.panel?.title ?? null,
    author: row.author
      ? {
          id: row.author.discordId.toString(),
          name: row.author.name,
          displayName: row.author.displayName,
          displayAvatar: row.author.displayAvatar,
        }
      : null,
    matchReason: row.matchReason,
  }
}

export const searchRoutes = new Elysia({ prefix: '/search' })
  .use(authMacro)
  .get('/global', async ({ query }) => {
    const startedAt = Date.now()
    const rawQuery = typeof query.q === 'string' ? query.q : ''
    const parsedQuery = parseGlobalSearchQuery(rawQuery)
    const normalizedQuery = parsedQuery.raw.trim()

    if (!normalizedQuery) {
      return {
        query: '',
        users: [] as GlobalSearchUserResult[],
        tickets: [] as GlobalSearchTicketResult[],
        messages: [] as GlobalSearchMessageResult[],
        meta: {
          tookMs: Date.now() - startedAt,
          strategy: 'empty',
        },
      }
    }

    const isNumericQuery = /^\d+$/.test(normalizedQuery)
    const userSearchTerm = resolveUserSearchTerm(parsedQuery).trim()
    const ticketSearchTerm = resolveTicketSearchTerm(parsedQuery).trim()
    const messageSearchTerm = resolveMessageSearchTerm(parsedQuery).trim()
    const exactUserIdTerm = resolveUserExactIdTerm(parsedQuery)
    const numericTicketTerm = parsedQuery.ticketTerm?.trim() || parsedQuery.channelTerm?.trim() || normalizedQuery
    const exactUsers = new Map<string, GlobalSearchUserResult>()
    const ticketResults = new Map<number, GlobalSearchTicketResult>()
    const messageResults = new Map<string, GlobalSearchMessageResult>()

    const addTicket = (result: GlobalSearchTicketResult) => {
      if (!ticketResults.has(result.id)) {
        ticketResults.set(result.id, result)
      }
    }

    if (exactUserIdTerm) {
      const exactUser = await db.select().from(users).where(eq(users.discordId, BigInt(exactUserIdTerm))).limit(1)

      if (exactUser[0]) {
        const result = buildUserResult(exactUser[0], 'discord_id')
        exactUsers.set(result.id, result)
      }
    }

    if (/^\d+$/.test(numericTicketTerm)) {
      const discordId = BigInt(numericTicketTerm)
      const safeInteger = Number(numericTicketTerm)
      const ticketConditions = [eq(tickets.channelId, discordId)]

      if (Number.isSafeInteger(safeInteger)) {
        ticketConditions.push(eq(tickets.id, safeInteger))
        ticketConditions.push(eq(tickets.sequence, safeInteger))
      }

      const exactTicketMatches = await db
          .select({
            ticket: tickets,
            author: users,
            channel: channels,
            panel: panels,
          })
          .from(tickets)
          .leftJoin(users, eq(tickets.authorId, users.discordId))
          .leftJoin(channels, eq(tickets.channelId, channels.channelId))
          .leftJoin(panels, eq(tickets.panelId, panels.id))
          .where(and(or(...ticketConditions)))
          .limit(5)

      exactTicketMatches.forEach((row) => {
        const matchReason: SearchMatchReason = row.channel?.channelId.toString() === numericTicketTerm
          ? 'channel_id'
          : Number.isSafeInteger(safeInteger) && row.ticket.id === safeInteger
            ? 'ticket_id'
            : Number.isSafeInteger(safeInteger) && row.ticket.sequence === safeInteger
              ? 'ticket_sequence'
              : row.author?.discordId.toString() === numericTicketTerm
                ? 'ticket_author'
                : 'ticket_id'

        addTicket(buildTicketResult({ ...row, matchReason }))
      })
    }

    const [matchedUsers, matchedTickets, matchedMessages] = await Promise.all([
      userSearchTerm.length >= 2 ? searchUsers({ query: userSearchTerm, limit: 8 }) : Promise.resolve([]),
      ticketSearchTerm.length >= 1 ? getTickets({ search: ticketSearchTerm, limit: 8, sortBy: 'createdAt', sortOrder: 'desc' }) : Promise.resolve([]),
      messageSearchTerm.length >= 3 ? searchMessages({ query: messageSearchTerm, limit: 8 }) : Promise.resolve([]),
    ])

    matchedUsers.forEach((result) => {
      const reason: SearchMatchReason = /^\d+$/.test(userSearchTerm) && result.user.discordId.toString() === userSearchTerm
        ? 'discord_id'
        : 'username'
      const userResult = buildUserResult(result.user, reason)
      if (!exactUsers.has(userResult.id)) {
        exactUsers.set(userResult.id, userResult)
      }
    })

    matchedTickets.forEach((result) => {
      const effectiveTicketQuery = ticketSearchTerm.toLowerCase()
      const authorMatch = [result.author?.displayName, result.author?.name]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(effectiveTicketQuery))

      const channelMatch = Boolean(result.channel?.channelId.toString() === ticketSearchTerm)
      const ticketIdMatch = /^\d+$/.test(ticketSearchTerm) && result.ticket.id === Number(ticketSearchTerm)
      const sequenceMatch = /^\d+$/.test(ticketSearchTerm) && result.ticket.sequence === Number(ticketSearchTerm)

      const matchReason: SearchMatchReason = channelMatch
        ? 'channel_id'
        : ticketIdMatch
          ? 'ticket_id'
          : sequenceMatch
            ? 'ticket_sequence'
            : result.searchMatchedByParticipant
              ? 'participant'
              : authorMatch || result.author?.discordId.toString() === ticketSearchTerm
                ? 'ticket_author'
                : 'ticket_id'

      addTicket({
        id: result.ticket.id,
        sequence: result.ticket.sequence,
        status: result.ticket.status,
        createdAt: result.ticket.createdAt.toISOString(),
        channelId: result.channel?.channelId.toString() ?? result.ticket.channelId?.toString() ?? null,
        channelName: result.channel?.name ?? null,
        panelTitle: result.panel?.title ?? null,
        author: result.author
          ? {
              id: result.author.discordId.toString(),
              name: result.author.name,
              displayName: result.author.displayName,
              displayAvatar: result.author.displayAvatar,
            }
          : null,
        matchReason,
      })
    })

    matchedMessages.forEach((result) => {
      if (!result.ticket) {
        return
      }

      const effectiveMessageQuery = messageSearchTerm.toLowerCase()
      const authorMatch = [result.author?.displayName, result.author?.name]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(effectiveMessageQuery))
      const highlightTerm = parsedQuery.containsTerm || messageSearchTerm || null

      const messageResult: GlobalSearchMessageResult = {
        id: result.message.messageId.toString(),
        content: result.message.content ?? '',
        preview: createMessagePreview(result.message.content ?? '', highlightTerm),
        highlightTerm,
        createdAt: result.message.createdAt.toISOString(),
        author: result.author
          ? {
              id: result.author.discordId.toString(),
              name: result.author.name,
              displayName: result.author.displayName,
              displayAvatar: result.author.displayAvatar,
            }
          : null,
        ticketId: result.ticket.id,
        ticketSequence: result.ticket.sequence,
        channelId: result.channel?.channelId.toString() ?? result.ticket.channelId?.toString() ?? null,
        channelName: result.channel?.name ?? null,
        matchReason: authorMatch ? 'message_author' : 'message_content',
      }

      if (!messageResults.has(messageResult.id)) {
        messageResults.set(messageResult.id, messageResult)
      }
    })

    const sortedUsers = Array.from(exactUsers.values()).sort((left, right) => {
      if (left.matchReason !== right.matchReason) {
        return left.matchReason === 'discord_id' ? -1 : 1
      }

      const leftName = (left.displayName || left.name || '').toLowerCase()
      const rightName = (right.displayName || right.name || '').toLowerCase()
      return leftName.localeCompare(rightName)
    })

    const sortedTickets = Array.from(ticketResults.values()).sort((left, right) => {
      const rankDifference = getTicketRank(left.matchReason) - getTicketRank(right.matchReason)
      if (rankDifference !== 0) {
        return rankDifference
      }

      const leftValue = left.sequence ?? left.id
      const rightValue = right.sequence ?? right.id
      return leftValue - rightValue
    })

    const sortedMessages = Array.from(messageResults.values()).sort((left, right) => {
      const rankDifference = getMessageRank(left.matchReason) - getMessageRank(right.matchReason)
      if (rankDifference !== 0) {
        return rankDifference
      }

      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    })

    return {
      query: normalizedQuery,
      users: sortedUsers.slice(0, 5),
      tickets: sortedTickets.slice(0, 5),
      messages: sortedMessages.slice(0, 5),
      meta: {
        tookMs: Date.now() - startedAt,
        strategy: isNumericQuery ? 'numeric-fast-path' : 'text-search',
      },
    }
  }, { modAuth: true })