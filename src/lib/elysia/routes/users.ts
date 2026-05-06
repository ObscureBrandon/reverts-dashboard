import { db } from '@/lib/db'
import {
  AssignmentMutationError,
  type AssignmentStatusValue,
  type SupportStateReasonValue,
  SUPPORT_STATE_REASONS_BY_STATE,
    addCheckIn,
  assignUserToSupervisor,
  claimUserAssignment,
    assignTagToUser,
    createUserSupervisorEntry,
    getStaffCount,
    getStaffDetails,
    getTickets,
    getUserAssignmentHistory,
    getUserCheckIns,
    getUserCount,
    getUserInfractions,
    getUserRoles,
    getUserShahadas,
    getUserSupervisorEntries,
    getUserSupervisors,
    getUserTagAssignments,
    getUserTicketStats,
    removeTagFromUser,
    searchStaffWithSupervisees,
    searchUsers,
    transferUserAssignment,
    unassignUser,
    updateUserSupportState,
} from '@/lib/db/queries'
import { authAccount, users } from '@/lib/db/schema'
import { CHECK_IN_PANEL_ID } from '@/lib/ticket-panels'
import { authMacro } from '@/lib/elysia/auth'
import { getActiveSupervisorId } from '@/lib/user-role'
import { eq } from 'drizzle-orm'
import { Elysia } from 'elysia'

function serializeDateValue(value: Date | string | null | undefined) {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  return value
}

function serializeAssignmentMutationResult(result: Awaited<ReturnType<typeof claimUserAssignment>>) {
  return {
    success: true,
    assignmentStatus: result.assignmentStatus,
    assignmentReason: result.assignmentReason,
    primarySupervisor: result.primarySupervisor
      ? {
          id: result.primarySupervisor.id,
          active: result.primarySupervisor.active,
          createdAt: result.primarySupervisor.createdAt.toISOString(),
          supervisor: {
            id: result.primarySupervisor.supervisorId.toString(),
            name: result.primarySupervisor.supervisorName,
            displayName: result.primarySupervisor.supervisorDisplayName,
            avatar: result.primarySupervisor.supervisorAvatar,
          },
        }
      : null,
  }
}

function getAssignmentRouteError(error: unknown, set: { status?: number | string }) {
  if (error instanceof AssignmentMutationError) {
    set.status = error.status
    return {
      error: error.message,
      code: error.code,
    }
  }

  return null
}

const MAX_SUPERVISOR_NOTE_LENGTH = 4000

function parseSupportStateReason(nextState: AssignmentStatusValue, reason?: string) {
  const trimmedReason = reason?.trim()

  if (!trimmedReason) {
    return null
  }

  const allowedReasons = SUPPORT_STATE_REASONS_BY_STATE[nextState]

  if (!allowedReasons.includes(trimmedReason as SupportStateReasonValue)) {
    return null
  }

  return trimmedReason as SupportStateReasonValue
}

const validAssignmentStatuses: AssignmentStatusValue[] = [
  'OPEN',
  'ON_HOLD',
  'CLOSED',
]

type StaffAccess = {
  role: string
  discordId: string
}

function denyAccess(set: { status?: number | string }) {
  set.status = 403
  return { error: 'Access denied' }
}

async function getUserMutationScope(access: StaffAccess, userId: bigint) {
  const actorDiscordId = BigInt(access.discordId)
  const activeSupervisorId = await getActiveSupervisorId(userId)

  return {
    actorDiscordId,
    activeSupervisorId,
    isMod: access.role === 'mod',
    isAssignedToActor: activeSupervisorId === actorDiscordId,
    isUnassigned: activeSupervisorId === null,
  }
}

export const usersRoutes = new Elysia({ prefix: '/users' })
  // GET /users - List/search users with pagination
  .use(authMacro)
  .get('/', async ({ query, user }) => {
    try {
      // Parse query parameters
      const q = query.q || undefined
      const assignmentStatus = query.assignmentStatus as
        'OPEN' | 'ON_HOLD' | 'CLOSED' | undefined
      const relationToIslam = query.relationToIslam || undefined
      const inGuildParam = query.inGuild
      const verifiedParam = query.verified
      const voiceVerifiedParam = query.voiceVerified
      const roleIdParam = query.roleId
      const tagIdParam = query.tagId
      const assignedStaffIdParam = query.assignedStaffId
      const needsAssignmentParam = query.needsAssignment
      const overdueCheckInParam = query.overdueCheckIn
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
      const tagId = tagIdParam ? parseInt(tagIdParam, 10) : undefined
      const needsAssignment = needsAssignmentParam === 'true' ? true : needsAssignmentParam === 'false' ? false : undefined
      const overdueCheckIn = overdueCheckInParam === 'true' ? true : overdueCheckInParam === 'false' ? false : undefined
      const hasShahada = hasShahadaParam === 'true' ? true : undefined
      const hasSupport = hasSupportParam === 'true' ? true : undefined
      const assignedStaffId = assignedStaffIdParam ? BigInt(assignedStaffIdParam) : undefined

      // Get the current user's Discord ID if assignedToMe filter is active
      let supervisorId = assignedStaffId
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
        assignedStaffId: supervisorId,
        tagId: Number.isNaN(tagId) ? undefined : tagId,
        needsAssignment,
        overdueCheckIn,
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
          currentAssignmentReason: result.currentAssignmentReason,
          activeSupervisorCount: result.activeSupervisorCount,
          supervisorName: result.supervisorName,
          supervisorDisplayName: result.supervisorDisplayName,
          supervisorAvatar: result.supervisorAvatar,
          activeInfractionCount: result.activeInfractionCount,
          lastCheckInAt: serializeDateValue(result.lastCheckInAt),
          activeTags: result.activeTags,
          needsAssignment: result.needsAssignment,
          isOverdueCheckIn: result.isOverdueCheckIn,
          openTicketCount: result.openTicketCount,
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
  }, { staffAuth: true })

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
  }, { staffAuth: true })

  // GET /users/:id/staff-details - Get staff member details with supervisees
  .get('/:id/staff-details', async ({ params, set }) => {
    try {
      const staffId = BigInt(params.id)
      const result = await getStaffDetails(staffId)

      if (!result) {
        set.status = 404
        return { error: 'Staff member not found' }
      }

      set.headers['Cache-Control'] = 'private, s-maxage=120, stale-while-revalidate=300'

      return result
    } catch (err) {
      console.error('Error fetching staff details:', err)
      throw new Error('Failed to fetch staff details')
    }
  }, { staffAuth: true })

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
          infractions,
          supervisorNotes,
          ticketStats,
          recentTicketsResult,
        ] = await Promise.all([
          getUserShahadas(userId),
          getUserSupervisors(userId),
          getUserAssignmentHistory(userId),
          getUserInfractions(userId),
          getUserSupervisorEntries(userId),
          getUserTicketStats(userId),
          getTickets({
            authorId: userId,
            sortBy: 'newest',
          }),
        ])

        // Check if user is staff by matching role names
        const isStaff = userRolesResult.some(r => 
          /staff|mod|moderator|admin|helper/i.test(r.role.name)
        )
        const openCheckInTicket = recentTicketsResult.find(
          ticket => ticket.ticket.status === 'OPEN' && ticket.ticket.panelId === CHECK_IN_PANEL_ID,
        )

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
            isStaff,
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
            reason: a.reason,
            priority: a.priority,
            notes: a.notes,
            active: a.active,
            createdAt: a.createdAt.toISOString(),
            resolvedAt: a.resolvedAt?.toISOString() || null,
            addedBy: a.addedById ? {
              id: a.addedById.toString(),
              name: a.addedByName,
              displayName: a.addedByDisplayName,
              avatar: a.addedByAvatar,
            } : null,
            resolvedBy: a.resolvedById ? {
              id: a.resolvedById.toString(),
              name: a.resolvedByName,
              displayName: a.resolvedByDisplayName,
              avatar: a.resolvedByAvatar,
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
          supervisorNotes: supervisorNotes.map(e => ({
            id: e.id,
            note: e.note,
            createdAt: e.createdAt.toISOString(),
            supervisor: e.supervisorId ? {
              id: e.supervisorId.toString(),
              name: e.supervisorName,
              displayName: e.supervisorDisplayName,
              avatar: e.supervisorAvatar,
            } : null,
          })),
          ticketStats: {
            open: ticketStats.open,
            closed: ticketStats.closed,
            deleted: ticketStats.deleted,
          },
          openCheckInTicketId: openCheckInTicket?.ticket.id ?? null,
          recentTickets: recentTicketsResult.map(t => ({
            id: t.ticket.id,
            sequence: t.ticket.sequence,
            status: t.ticket.status,
            createdAt: t.ticket.createdAt.toISOString(),
          })),
        }
      }

      // Basic response (backwards compatible)
      set.headers['Cache-Control'] = 'private, s-maxage=120, stale-while-revalidate=300'

      // Check if user is staff by matching role names
      const isStaff = userRolesResult.some(r => 
        /staff|mod|moderator|admin|helper/i.test(r.role.name)
      )

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
          isStaff,
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
  }, { staffAuth: true })

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

      set.headers['Cache-Control'] = 'private, s-maxage=60, stale-while-revalidate=120'

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
  }, { modAuth: true })

  // GET /users/:id/ticket-stats - User ticket statistics
  .get('/:id/ticket-stats', async ({ params, set }) => {
    try {
      const userId = BigInt(params.id)

      const stats = await getUserTicketStats(userId)

      set.headers['Cache-Control'] = 'private, s-maxage=60, stale-while-revalidate=120'

      return {
        open: stats.open,
        closed: stats.closed,
      }
    } catch (error) {
      console.error('User ticket stats fetch error:', error)
      throw new Error('Failed to fetch ticket stats')
    }
  }, { staffAuth: true })

  .post('/:id/supervisor-notes', async ({ access, params, body, discordId, set }) => {
    try {
      const userId = BigInt(params.id)
      const rawNote = typeof (body as { note?: unknown })?.note === 'string'
        ? (body as { note?: string }).note
        : undefined
      const note = rawNote?.trim()

      if (!note) {
        set.status = 400
        return { error: 'A non-empty note is required' }
      }

      if (note.length > MAX_SUPERVISOR_NOTE_LENGTH) {
        set.status = 400
        return { error: `Note must be ${MAX_SUPERVISOR_NOTE_LENGTH} characters or fewer` }
      }

      const scope = await getUserMutationScope(access, userId)

      if (!scope.isMod && !scope.isUnassigned && !scope.isAssignedToActor) {
        return denyAccess(set)
      }

      const createdNote = await createUserSupervisorEntry({
        userId,
        supervisorId: BigInt(discordId),
        note,
      })

      return {
        supervisorNote: {
          id: createdNote.id,
          note: createdNote.note,
          createdAt: createdNote.createdAt.toISOString(),
          supervisorId: createdNote.supervisorId.toString(),
          userId: createdNote.userId.toString(),
        },
      }
    } catch (error) {
      console.error('Error creating supervisor note:', error)
      throw new Error('Failed to create supervisor note')
    }
  }, { staffAuth: true })

  .post('/:id/assignment/claim', async ({ access, params, discordId, set }) => {
    try {
      const userId = BigInt(params.id)
      const scope = await getUserMutationScope(access, userId)

      if (!scope.isMod && !scope.isUnassigned && !scope.isAssignedToActor) {
        return denyAccess(set)
      }

      const result = await claimUserAssignment(userId, BigInt(discordId))

      return serializeAssignmentMutationResult(result)
    } catch (error) {
      const routeError = getAssignmentRouteError(error, set)

      if (routeError) {
        return routeError
      }

      console.error('Error claiming user assignment:', error)
      throw new Error('Failed to claim assignment')
    }
  }, { staffAuth: true })

  .post('/:id/assignment/assign', async ({ access, params, body, discordId, set }) => {
    try {
      const userId = BigInt(params.id)
      const { supervisorId, note } = body as { supervisorId?: string; note?: string }

      if (!supervisorId || !/^\d+$/.test(supervisorId)) {
        set.status = 400
        return { error: 'A valid supervisorId is required' }
      }

      const scope = await getUserMutationScope(access, userId)

      if (!scope.isMod) {
        if (!scope.isUnassigned && !scope.isAssignedToActor) {
          return denyAccess(set)
        }

        if (BigInt(supervisorId) !== scope.actorDiscordId) {
          return denyAccess(set)
        }
      }

      const result = await assignUserToSupervisor(
        userId,
        BigInt(supervisorId),
        BigInt(discordId),
        note,
      )

      return serializeAssignmentMutationResult(result)
    } catch (error) {
      const routeError = getAssignmentRouteError(error, set)

      if (routeError) {
        return routeError
      }

      console.error('Error assigning user supervisor:', error)
      throw new Error('Failed to assign supervisor')
    }
  }, { staffAuth: true })

  .post('/:id/assignment/transfer', async ({ access, params, body, discordId, set }) => {
    try {
      const userId = BigInt(params.id)
      const { supervisorId, note } = body as { supervisorId?: string; note?: string }

      if (!supervisorId || !/^\d+$/.test(supervisorId)) {
        set.status = 400
        return { error: 'A valid supervisorId is required' }
      }

      if (access.role !== 'mod') {
        return denyAccess(set)
      }

      const result = await transferUserAssignment(
        userId,
        BigInt(supervisorId),
        BigInt(discordId),
        note,
      )

      return serializeAssignmentMutationResult(result)
    } catch (error) {
      const routeError = getAssignmentRouteError(error, set)

      if (routeError) {
        return routeError
      }

      console.error('Error transferring user assignment:', error)
      throw new Error('Failed to transfer assignment')
    }
  }, { staffAuth: true })

  .post('/:id/assignment/unassign', async ({ access, params, body, discordId, set }) => {
    try {
      const userId = BigInt(params.id)
      const { nextState, reason, note } = body as {
        nextState?: AssignmentStatusValue
        reason?: string
        note?: string
      }

      if (!nextState || !validAssignmentStatuses.includes(nextState)) {
        set.status = 400
        return { error: 'A valid nextState is required' }
      }

      const normalizedReason = parseSupportStateReason(nextState, reason)

      if (reason?.trim() && !normalizedReason) {
        set.status = 400
        return { error: 'A valid reason is required for the selected nextState' }
      }

      const scope = await getUserMutationScope(access, userId)

      if (!scope.isMod && !scope.isAssignedToActor) {
        return denyAccess(set)
      }

      const result = await unassignUser(
        userId,
        BigInt(discordId),
        nextState,
        normalizedReason ?? undefined,
        note,
      )

      return serializeAssignmentMutationResult(result)
    } catch (error) {
      const routeError = getAssignmentRouteError(error, set)

      if (routeError) {
        return routeError
      }

      console.error('Error unassigning user supervisor:', error)
      throw new Error('Failed to unassign supervisor')
    }
  }, { staffAuth: true })

  .post('/:id/assignment/status', async ({ access, params, body, discordId, set }) => {
    try {
      const userId = BigInt(params.id)
      const { nextState, reason } = body as {
        nextState?: AssignmentStatusValue
        reason?: string
      }

      if (!nextState || !validAssignmentStatuses.includes(nextState)) {
        set.status = 400
        return { error: 'A valid nextState is required' }
      }

      const normalizedReason = parseSupportStateReason(nextState, reason)

      if (reason?.trim() && !normalizedReason) {
        set.status = 400
        return { error: 'A valid reason is required for the selected nextState' }
      }

      const scope = await getUserMutationScope(access, userId)

      if (!scope.isMod && !scope.isUnassigned && !scope.isAssignedToActor) {
        return denyAccess(set)
      }

      await updateUserSupportState(
        userId,
        BigInt(discordId),
        nextState,
        normalizedReason ?? undefined,
      )

      return { success: true }
    } catch (error) {
      console.error('Error updating support state:', error)
      throw new Error('Failed to update support state')
    }
  }, { staffAuth: true })

  // GET /users/:id/tags - Get user's active tags + full history
  .get('/:id/tags', async ({ params }) => {
    try {
      const userId = BigInt(params.id)
      const assignments = await getUserTagAssignments(userId)

      const activeTags = assignments
        .filter(a => !a.removedAt)
        .map(a => ({
          assignmentId: a.id,
          tagId: a.tagId,
          name: a.tagName,
          slug: a.tagSlug,
          kind: a.tagKind,
          color: a.tagColor,
          emoji: a.tagEmoji,
          category: a.tagCategory,
          assignedAt: a.assignedAt.toISOString(),
          assignedBy: a.assignedByName,
          note: a.note,
        }))

      const history = assignments.map(a => ({
        id: a.id,
        tagId: a.tagId,
        tagName: a.tagName,
        tagSlug: a.tagSlug,
        tagKind: a.tagKind,
        tagColor: a.tagColor,
        tagEmoji: a.tagEmoji,
        assignedAt: a.assignedAt.toISOString(),
        assignedBy: a.assignedByName,
        note: a.note,
        removedAt: a.removedAt?.toISOString() || null,
        removedBy: a.removedByName || null,
        removalNote: a.removalNote,
      }))

      return { activeTags, history }
    } catch (error) {
      console.error('Error fetching user tags:', error)
      throw new Error('Failed to fetch user tags')
    }
  }, { staffAuth: true })

  // POST /users/:id/tags - Assign a tag to a user
  .post('/:id/tags', async ({ access, params, body, discordId, set }) => {
    try {
      const userId = BigInt(params.id)
      const { tagId, note } = body as { tagId: number; note?: string }

      if (!tagId) {
        set.status = 400
        return { error: 'tagId is required' }
      }

      const scope = await getUserMutationScope(access, userId)

      if (!scope.isMod && !scope.isUnassigned && !scope.isAssignedToActor) {
        return denyAccess(set)
      }

      const assignment = await assignTagToUser({
        userId,
        tagId,
        assignedById: BigInt(discordId),
        note,
      })

      return {
        assignment: {
          ...assignment,
          userId: assignment.userId.toString(),
          assignedById: assignment.assignedById.toString(),
          removedById: assignment.removedById?.toString() ?? null,
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('already active')) {
        set.status = 409
        return { error: error.message }
      }
      console.error('Error assigning tag:', error)
      throw new Error('Failed to assign tag')
    }
  }, { staffAuth: true })

  // DELETE /users/:id/tags/:assignmentId - Remove a tag from a user
  .delete('/:id/tags/:assignmentId', async ({ access, params, body, discordId, set }) => {
    try {
      const userId = BigInt(params.id)
      const assignmentId = parseInt(params.assignmentId)
      if (isNaN(assignmentId)) {
        set.status = 400
        return { error: 'Invalid assignment ID' }
      }

      const { removalNote } = (body || {}) as { removalNote?: string }

      const scope = await getUserMutationScope(access, userId)

      if (!scope.isMod && !scope.isUnassigned && !scope.isAssignedToActor) {
        return denyAccess(set)
      }

      const result = await removeTagFromUser({
        assignmentId,
        removedById: BigInt(discordId),
        removalNote,
      })

      if (!result) {
        set.status = 404
        return { error: 'Active assignment not found' }
      }

      return { success: true }
    } catch (error) {
      console.error('Error removing tag:', error)
      throw new Error('Failed to remove tag')
    }
  }, { staffAuth: true })

  // GET /users/:id/check-ins - List check-ins for a user
  .get('/:id/check-ins', async ({ params }) => {
    try {
      const userId = BigInt(params.id)
      const checkIns = await getUserCheckIns(userId)

      return {
        checkIns: checkIns.map(c => ({
          id: c.id,
          staffId: c.staffId.toString(),
          staffName: c.staffName,
          staffAvatar: c.staffAvatar,
          method: c.method,
          summary: c.summary,
          checkedInAt: c.checkedInAt.toISOString(),
        }))
      }
    } catch (error) {
      console.error('Error fetching check-ins:', error)
      throw new Error('Failed to fetch check-ins')
    }
  }, { staffAuth: true })

  // POST /users/:id/check-ins - Log a new check-in
  .post('/:id/check-ins', async ({ access, params, body, discordId, set }) => {
    try {
      const userId = BigInt(params.id)
      const { method, summary } = body as { method: string; summary?: string }

      if (!method) {
        set.status = 400
        return { error: 'method is required' }
      }

      const scope = await getUserMutationScope(access, userId)

      if (!scope.isMod && !scope.isUnassigned && !scope.isAssignedToActor) {
        return denyAccess(set)
      }

      const checkIn = await addCheckIn({
        userId,
        staffId: BigInt(discordId),
        method,
        summary,
      })

      return {
        checkIn: {
          ...checkIn,
          userId: checkIn.userId.toString(),
          staffId: checkIn.staffId.toString(),
        }
      }
    } catch (error) {
      console.error('Error adding check-in:', error)
      throw new Error('Failed to add check-in')
    }
  }, { staffAuth: true })
