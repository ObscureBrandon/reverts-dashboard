import { db } from '@/lib/db'
import {
  getStaffCount,
  getTickets,
  getUserAssignmentHistory,
  getUserCount,
  getUserInfractions,
  getUserRoles,
  getUserShahadas,
  getUserSupervisionNeeds,
  getUserSupervisorEntries,
  getUserSupervisors,
  getUserTicketStats,
  searchStaffWithSupervisees,
  searchUsers
} from '@/lib/db/queries'
import { authAccount, users } from '@/lib/db/schema'
import { authMacro } from '@/lib/elysia/auth'
import { eq } from 'drizzle-orm'
import { Elysia } from 'elysia'

export const usersRoutes = new Elysia({ prefix: '/users' })
  // GET /users - List/search users with pagination
  .use(authMacro)
  .get('/', async ({ query, user }) => {
    try {
      // Parse query parameters
      const q = query.q || undefined
      const assignmentStatus = query.assignmentStatus as
        'NEEDS_SUPPORT' | 'INACTIVE' | 'SELF_SUFFICIENT' | 'PAUSED' | 'NOT_READY' | undefined
      const relationToIslam = query.relationToIslam || undefined
      const inGuildParam = query.inGuild
      const verifiedParam = query.verified
      const voiceVerifiedParam = query.voiceVerified
      const roleIdParam = query.roleId
      const assignedToMeParam = query.assignedToMe
      const hasShahadaParam = query.hasShahada
      const hasSupportParam = query.hasSupport
      const sortBy = (query.sortBy || 'createdAt') as 'name' | 'createdAt'
      const sortOrder = (query.sortOrder || 'desc') as 'asc' | 'desc'
      const page = parseInt(query.page || '1')
      const limit = Math.min(parseInt(query.limit || '50'), 100)
      const offset = (page - 1) * limit

      // Convert string params to proper types
      const inGuild = inGuildParam === 'true' ? true : inGuildParam === 'false' ? false : undefined
      const verified = verifiedParam === 'true' ? true : verifiedParam === 'false' ? false : undefined
      const voiceVerified = voiceVerifiedParam === 'true' ? true : voiceVerifiedParam === 'false' ? false : undefined
      const roleId = roleIdParam ? BigInt(roleIdParam) : undefined
      const hasShahada = hasShahadaParam === 'true' ? true : undefined
      const hasSupport = hasSupportParam === 'true' ? true : undefined

      // Get the current user's Discord ID if assignedToMe filter is active
      let supervisorId: bigint | undefined
      if (assignedToMeParam === 'true' && user?.id) {
        const account = await db
          .select({ accountId: authAccount.accountId })
          .from(authAccount)
          .where(eq(authAccount.userId, user.id))
          .limit(1)

        if (account.length > 0) {
          supervisorId = BigInt(account[0].accountId)
        }
      }

      const params = {
        query: q,
        assignmentStatus,
        relationToIslam,
        inGuild,
        verified,
        voiceVerified,
        roleId,
        supervisorId,
        hasShahada,
        hasSupport,
        sortBy,
        sortOrder,
        limit,
        offset,
      }

      // Fetch users and count in parallel
      const [usersResult, total] = await Promise.all([
        searchUsers(params),
        getUserCount(params),
      ])

      const totalPages = Math.ceil(total / limit)

      return {
        users: usersResult.map(result => ({
          id: result.user.discordId.toString(),
          name: result.user.name,
          displayName: result.user.displayName,
          displayAvatar: result.user.displayAvatar,
          inGuild: result.user.inGuild,
          isVerified: result.user.isVerified,
          isVoiceVerified: result.user.isVoiceVerified,
          relationToIslam: result.user.relationToIslam,
          gender: result.user.gender,
          age: result.user.age,
          region: result.user.region,
          currentAssignmentStatus: result.currentAssignmentStatus,
          topRoles: result.topRoles,
          createdAt: result.user.createdAt.toISOString(),
        })),
        pagination: {
          total,
          page,
          limit,
          totalPages,
        },
      }
    } catch (err) {
      console.error('Error fetching users:', err)
      throw new Error('Failed to fetch users')
    }
  }, { auth: true })

  // GET /users/staff - Get staff members with supervisees
  .get('/staff', async ({ query }) => {
    try {
      const q = query.q || undefined
      const sortBy = (query.sortBy || 'superviseeCount') as 'name' | 'superviseeCount'
      const sortOrder = (query.sortOrder || 'desc') as 'asc' | 'desc'
      const page = parseInt(query.page || '1')
      const limit = Math.min(parseInt(query.limit || '50'), 100)
      const offset = (page - 1) * limit

      const params = {
        query: q,
        sortBy,
        sortOrder,
        limit,
        offset,
      }

      // Fetch staff and count in parallel
      const [staffResult, total] = await Promise.all([
        searchStaffWithSupervisees(params),
        getStaffCount({ query: q }),
      ])

      const totalPages = Math.ceil(total / limit)

      return {
        staff: staffResult.map(result => ({
          id: result.user.discordId.toString(),
          name: result.user.name,
          displayName: result.user.displayName,
          displayAvatar: result.user.displayAvatar,
          superviseeCount: result.superviseeCount,
          supervisees: result.supervisees,
          topRoles: result.topRoles,
        })),
        pagination: {
          total,
          page,
          limit,
          totalPages,
        },
      }
    } catch (err) {
      console.error('Error fetching staff:', err)
      throw new Error('Failed to fetch staff')
    }
  }, { auth: true })

  // GET /users/:id - Get user by ID
  .get('/:id', async ({ params, query, set }) => {
    try {
      const userId = BigInt(params.id)
      const fullProfile = query.full === 'true'

      // Fetch user details
      const userResult = await db
        .select()
        .from(users)
        .where(eq(users.discordId, userId))
        .limit(1)

      if (!userResult[0]) {
        set.status = 404
        return { error: 'User not found' }
      }

      const user = userResult[0]

      // Fetch user roles (always included)
      const userRolesResult = await getUserRoles(userId)

      // For full profile, fetch all related data in parallel
      if (fullProfile) {
        const [
          shahadas,
          supervisors,
          assignmentHistory,
          supervisionNeeds,
          infractions,
          supervisorEntries,
          ticketStats,
        ] = await Promise.all([
          getUserShahadas(userId),
          getUserSupervisors(userId),
          getUserAssignmentHistory(userId),
          getUserSupervisionNeeds(userId),
          getUserInfractions(userId),
          getUserSupervisorEntries(userId),
          getUserTicketStats(userId),
        ])

        return {
          user: {
            id: user.discordId.toString(),
            name: user.name,
            displayName: user.displayName,
            displayAvatar: user.displayAvatar,
            nick: user.nick,
            inGuild: user.inGuild,
            isVerified: user.isVerified,
            isVoiceVerified: user.isVoiceVerified,
            relationToIslam: user.relationToIslam,
            gender: user.gender,
            age: user.age,
            region: user.region,
            religiousAffiliation: user.religiousAffiliation,
            wantsDiscussion: user.wantsDiscussion,
            createdAt: user.createdAt.toISOString(),
          },
          roles: userRolesResult.map(r => ({
            id: r.role.roleId.toString(),
            name: r.role.name,
            color: r.role.color,
            position: r.role.position,
          })),
          shahadas: shahadas.map(s => ({
            id: s.id,
            createdAt: s.createdAt.toISOString(),
            supervisor: s.supervisorId ? {
              id: s.supervisorId.toString(),
              name: s.supervisorName,
              displayName: s.supervisorDisplayName,
              avatar: s.supervisorAvatar,
            } : null,
          })),
          supervisors: supervisors.map(s => ({
            id: s.id,
            active: s.active,
            createdAt: s.createdAt.toISOString(),
            supervisor: s.supervisorId ? {
              id: s.supervisorId.toString(),
              name: s.supervisorName,
              displayName: s.supervisorDisplayName,
              avatar: s.supervisorAvatar,
            } : null,
          })),
          assignmentHistory: assignmentHistory.map(a => ({
            id: a.id,
            status: a.status,
            priority: a.priority,
            notes: a.notes,
            active: a.active,
            createdAt: a.createdAt.toISOString(),
            resolvedAt: a.resolvedAt?.toISOString() || null,
            addedBy: a.addedById ? {
              id: a.addedById.toString(),
              name: a.addedByName,
            } : null,
            resolvedBy: a.resolvedById ? {
              id: a.resolvedById.toString(),
              name: a.resolvedByName,
            } : null,
          })),
          supervisionNeeds: supervisionNeeds.map(n => ({
            id: n.id,
            needType: n.needType,
            severity: n.severity,
            notes: n.notes,
            createdAt: n.createdAt.toISOString(),
            resolvedAt: n.resolvedAt?.toISOString() || null,
            addedBy: n.addedById ? {
              id: n.addedById.toString(),
              name: n.addedByName,
            } : null,
          })),
          infractions: infractions.map(i => ({
            id: i.id,
            type: i.type,
            status: i.status,
            reason: i.reason,
            hidden: i.hidden,
            jumpUrl: i.jumpUrl,
            expiresAt: i.expiresAt?.toISOString() || null,
            createdAt: i.createdAt.toISOString(),
            moderator: i.moderatorId ? {
              id: i.moderatorId.toString(),
              name: i.moderatorName,
            } : null,
            pardonedBy: i.pardonedById ? {
              id: i.pardonedById.toString(),
              at: i.pardonedAt?.toISOString() || null,
              reason: i.pardonReason,
            } : null,
          })),
          supervisorEntries: supervisorEntries.map(e => ({
            id: e.id,
            note: e.note,
            createdAt: e.createdAt.toISOString(),
            supervisor: e.supervisorId ? {
              id: e.supervisorId.toString(),
              name: e.supervisorName,
              displayName: e.supervisorDisplayName,
            } : null,
          })),
          ticketStats,
        }
      }

      // Basic response (backwards compatible)
      set.headers['Cache-Control'] = 'public, s-maxage=120, stale-while-revalidate=300'

      return {
        user: {
          id: user.discordId.toString(),
          name: user.name,
          displayName: user.displayName,
          displayAvatar: user.displayAvatar,
          nick: user.nick,
          inGuild: user.inGuild,
          isVerified: user.isVerified,
          isVoiceVerified: user.isVoiceVerified,
        },
        roles: userRolesResult.map(r => ({
          id: r.role.roleId.toString(),
          name: r.role.name,
          color: r.role.color,
          position: r.role.position,
        })),
      }
    } catch (error) {
      console.error('User fetch error:', error)
      throw new Error('Failed to fetch user')
    }
  }, { auth: true })

  // GET /users/:id/popover - User popover data
  .get('/:id/popover', async ({ params, set }) => {
    try {
      const userId = BigInt(params.id)

      // Fetch all data in parallel for maximum performance
      const [userResult, userRolesResult, ticketStats, recentTicketsResult] = await Promise.all([
        db
          .select()
          .from(users)
          .where(eq(users.discordId, userId))
          .limit(1),
        getUserRoles(userId),
        getUserTicketStats(userId),
        getTickets({
          authorId: userId,
          limit: 5,
          sortBy: 'newest',
        }),
      ])

      if (!userResult[0]) {
        set.status = 404
        return { error: 'User not found' }
      }

      const user = userResult[0]

      set.headers['Cache-Control'] = 'public, s-maxage=60, stale-while-revalidate=120'

      return {
        user: {
          id: user.discordId.toString(),
          name: user.name,
          displayName: user.displayName,
          displayAvatar: user.displayAvatar,
          nick: user.nick,
          inGuild: user.inGuild,
          isVerified: user.isVerified,
          isVoiceVerified: user.isVoiceVerified,
        },
        roles: userRolesResult.map(r => ({
          id: r.role.roleId.toString(),
          name: r.role.name,
          color: r.role.color,
          position: r.role.position,
        })),
        ticketStats: {
          open: ticketStats.open,
          closed: ticketStats.closed,
        },
        recentTickets: recentTicketsResult.map(t => ({
          id: t.ticket.id,
          sequence: t.ticket.sequence,
          status: t.ticket.status,
          createdAt: t.ticket.createdAt.toISOString(),
        })),
      }
    } catch (error) {
      console.error('User popover data fetch error:', error)
      throw new Error('Failed to fetch user popover data')
    }
  }, { auth: true })

  // GET /users/:id/ticket-stats - User ticket statistics
  .get('/:id/ticket-stats', async ({ params, set }) => {
    try {
      const userId = BigInt(params.id)

      const stats = await getUserTicketStats(userId)

      set.headers['Cache-Control'] = 'public, s-maxage=60, stale-while-revalidate=120'

      return {
        open: stats.open,
        closed: stats.closed,
      }
    } catch (error) {
      console.error('User ticket stats fetch error:', error)
      throw new Error('Failed to fetch ticket stats')
    }
  }, { auth: true })
