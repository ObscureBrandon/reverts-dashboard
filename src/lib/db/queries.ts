import { and, asc, desc, eq, exists, ilike, inArray, isNotNull, isNull, or, SQL, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from './index';
import {
  assignmentStatuses,
  channels,
  infractions,
  messages,
  panels,
  revertCheckIns,
  revertTagAssignments,
  revertTags,
  roles,
  shahadas,
  supervisionNeeds,
  tickets,
  userRoles,
  users,
  userSupervisorEntries,
  userSupervisors
} from './schema';

export type MessageSearchParams = {
  query?: string;
  staffOnly?: boolean;
  ticketId?: number;
  channelId?: bigint;
  limit?: number;
  offset?: number;
  staffRoleIds?: bigint[];
  sortOrder?: 'asc' | 'desc';
};

export type MessageSearchResult = {
  message: typeof messages.$inferSelect;
  author: typeof users.$inferSelect | null;
  channel: typeof channels.$inferSelect | null;
  ticket: typeof tickets.$inferSelect | null;
  isStaff: boolean;
};

function buildMessageSearchCondition(search: string) {
  const trimmedSearch = search.trim();

  if (!trimmedSearch) {
    return undefined;
  }

  const searchPattern = `%${trimmedSearch}%`;
  const textConditions = [
    ilike(messages.content, searchPattern),
    ilike(users.name, searchPattern),
    ilike(users.displayName, searchPattern),
  ];

  if (/^\d+$/.test(trimmedSearch)) {
    return or(...textConditions, eq(messages.authorId, BigInt(trimmedSearch)));
  }

  return or(...textConditions);
}

function buildStaffRoleExistsCondition(staffRoleIds: bigint[]) {
  if (staffRoleIds.length === 0) {
    return undefined;
  }

  return exists(
    db
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .where(
        and(
          eq(userRoles.userId, messages.authorId),
          inArray(userRoles.roleId, staffRoleIds)
        )
      )
  );
}

function toIsoString(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : value;
}

export async function searchMessages(params: MessageSearchParams) {
  const {
    query,
    staffOnly = false,
    ticketId,
    channelId,
    limit = 50,
    offset = 0,
    staffRoleIds = [],
    sortOrder = 'desc',
  } = params;

  // Build where conditions
  const conditions = [];
  
  // Only search non-deleted messages
  conditions.push(eq(messages.isDeleted, false));
  
  if (query) {
    const searchCondition = buildMessageSearchCondition(query);

    if (searchCondition) {
      conditions.push(searchCondition);
    }
  }
  
  if (channelId) {
    conditions.push(eq(messages.channelId, channelId));
  }

  const staffRoleExistsCondition = buildStaffRoleExistsCondition(staffRoleIds);

  // Build base query with staff check
  const queryBuilder = db
    .select({
      message: messages,
      author: users,
      channel: channels,
      ticket: tickets,
      isStaff: staffRoleExistsCondition ? sql<boolean>`${staffRoleExistsCondition}` : sql<boolean>`false`,
    })
    .from(messages)
    .leftJoin(users, eq(messages.authorId, users.discordId))
    .leftJoin(channels, eq(messages.channelId, channels.channelId))
    .leftJoin(tickets, eq(channels.channelId, tickets.channelId));

  // Add staff filter at SQL level using EXISTS subquery
  if (staffOnly && staffRoleExistsCondition) {
    conditions.push(staffRoleExistsCondition);
  }

  // Add ticket filter at SQL level
  if (ticketId !== undefined) {
    conditions.push(eq(tickets.id, ticketId));
  }

  const results = await queryBuilder
    .where(and(...conditions))
    .orderBy(sortOrder === 'asc' ? asc(messages.createdAt) : desc(messages.createdAt))
    .limit(limit)
    .offset(offset);

  return results;
}

export async function getMessageCount(params: {
  query?: string;
  staffOnly?: boolean;
  ticketId?: number;
  channelId?: bigint;
  staffRoleIds?: bigint[];
}) {
  const { query, staffOnly = false, ticketId, channelId, staffRoleIds = [] } = params;
  const conditions = [eq(messages.isDeleted, false)];
  
  if (query) {
    const searchCondition = buildMessageSearchCondition(query);

    if (searchCondition) {
      conditions.push(searchCondition);
    }
  }

  if (channelId) {
    conditions.push(eq(messages.channelId, channelId));
  }

  const staffRoleExistsCondition = buildStaffRoleExistsCondition(staffRoleIds);

  // Add staff filter at SQL level using EXISTS subquery
  if (staffOnly && staffRoleExistsCondition) {
    conditions.push(staffRoleExistsCondition);
  }

  // If ticketId filter is needed, join with channels and tickets
  if (ticketId !== undefined) {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .leftJoin(users, eq(messages.authorId, users.discordId))
      .leftJoin(channels, eq(messages.channelId, channels.channelId))
      .leftJoin(tickets, eq(channels.channelId, tickets.channelId))
      .where(and(...conditions, eq(tickets.id, ticketId)));
    
    return result[0]?.count ?? 0;
  }

  // Otherwise, simple query without joins
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(messages)
    .leftJoin(users, eq(messages.authorId, users.discordId))
    .where(and(...conditions));

  return result[0]?.count ?? 0;
}

export async function getStaffRoles() {
  // Identify staff roles by name patterns
  // You can customize this based on your server's role naming
  return db
    .select()
    .from(roles)
    .where(
      or(
        ilike(roles.name, '%staff%'),
        ilike(roles.name, '%mod%'),
        ilike(roles.name, '%moderator%'),
        ilike(roles.name, '%admin%'),
        ilike(roles.name, '%helper%')
      )
    );
}

export async function getTicketChannels() {
  // Get all channels that are linked to tickets
  return db
    .select({
      channelId: channels.channelId,
      channelName: channels.name,
      ticketId: tickets.id,
      ticketSequence: tickets.sequence,
      ticketStatus: tickets.status,
    })
    .from(channels)
    .innerJoin(tickets, eq(channels.channelId, tickets.channelId))
    .where(eq(channels.deleted, false))
    .orderBy(desc(tickets.createdAt))
    .limit(100);
}

export async function getTicketById(ticketId: number) {
  const result = await db
    .select({
      ticket: tickets,
      author: users,
      channel: channels,
      panel: panels,
      messageCount: sql<number>`(
        SELECT COUNT(*)::int 
        FROM ${messages} 
        WHERE ${messages.channelId} = ${tickets.channelId}
        AND ${messages.isDeleted} = false
      )`,
    })
    .from(tickets)
    .leftJoin(users, eq(tickets.authorId, users.discordId))
    .leftJoin(channels, eq(tickets.channelId, channels.channelId))
    .leftJoin(panels, eq(tickets.panelId, panels.id))
    .where(eq(tickets.id, ticketId))
    .limit(1);

  return result[0] ?? null;
}

export type TicketListParams = {
  status?: 'OPEN' | 'CLOSED' | 'DELETED';
  authorId?: bigint;
  panelIds?: number[];
  limit?: number;
  offset?: number;
  search?: string;
  sortBy?: 'newest' | 'oldest' | 'messages' | 'fewestMessages' | 'sequence' | 'createdAt' | 'messageCount';
  sortOrder?: 'asc' | 'desc';
};

function buildTicketSearchCondition(search: string) {
  const trimmedSearch = search.trim();

  if (!trimmedSearch) {
    return undefined;
  }

  if (/^\d+$/.test(trimmedSearch)) {
    const numericSearch = Number(trimmedSearch);
    const discordIdSearch = BigInt(trimmedSearch);
    const numericConditions = [];

    if (Number.isSafeInteger(numericSearch)) {
      numericConditions.push(eq(tickets.id, numericSearch));
      numericConditions.push(eq(tickets.sequence, numericSearch));
    }

    numericConditions.push(eq(tickets.authorId, discordIdSearch));
    numericConditions.push(sql<boolean>`EXISTS (
      SELECT 1
      FROM ${messages}
      WHERE ${messages.channelId} = ${tickets.channelId}
      AND ${messages.isDeleted} = false
      AND ${messages.authorId} = ${discordIdSearch}
    )`);

    return or(...numericConditions);
  }

  const searchPattern = `%${trimmedSearch}%`;

  return or(
    ilike(users.name, searchPattern),
    ilike(users.displayName, searchPattern),
    sql<boolean>`EXISTS (
      SELECT 1
      FROM ${messages} participant_messages
      INNER JOIN ${users} participant_users ON participant_messages.author_id = participant_users.discord_id
      WHERE participant_messages.channel_id = ${tickets.channelId}
      AND participant_messages.is_deleted = false
      AND (
        participant_users.name ILIKE ${searchPattern}
        OR participant_users.display_name ILIKE ${searchPattern}
      )
    )`
  );
}

export async function getTickets(params: TicketListParams = {}) {
  const {
    status,
    authorId,
    panelIds,
    limit = 50,
    offset = 0,
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = params;

  const conditions = [];

  if (status) {
    conditions.push(eq(tickets.status, status));
  }

  if (authorId) {
    conditions.push(eq(tickets.authorId, authorId));
  }

  if (panelIds && panelIds.length > 0) {
    conditions.push(inArray(tickets.panelId, panelIds));
  }

  if (search) {
    const searchCondition = buildTicketSearchCondition(search);

    if (searchCondition) {
      conditions.push(searchCondition);
    }
  }

  // Use CTE to compute message counts once, then JOIN instead of N+1 subqueries
  const messageCounts = db
    .$with('message_counts')
    .as(
      db
        .select({
          channelId: messages.channelId,
          count: sql<number>`COUNT(*)::int`.as('count'),
        })
        .from(messages)
        .where(eq(messages.isDeleted, false))
        .groupBy(messages.channelId)
    );

  const normalizedSort = (() => {
    if (sortBy === 'newest') {
      return { sortBy: 'createdAt' as const, sortOrder: 'desc' as const };
    }

    if (sortBy === 'oldest') {
      return { sortBy: 'createdAt' as const, sortOrder: 'asc' as const };
    }

    if (sortBy === 'messages') {
      return { sortBy: 'messageCount' as const, sortOrder: 'desc' as const };
    }

    if (sortBy === 'fewestMessages') {
      return { sortBy: 'messageCount' as const, sortOrder: 'asc' as const };
    }

    return {
      sortBy: (sortBy === 'sequence' || sortBy === 'messageCount' || sortBy === 'createdAt' ? sortBy : 'createdAt') as 'sequence' | 'messageCount' | 'createdAt',
      sortOrder,
    };
  })();

  let orderByClause;
  if (normalizedSort.sortBy === 'sequence') {
    orderByClause = normalizedSort.sortOrder === 'asc'
      ? sql`COALESCE(${tickets.sequence}, ${tickets.id}) ASC`
      : sql`COALESCE(${tickets.sequence}, ${tickets.id}) DESC`;
  } else if (normalizedSort.sortBy === 'messageCount') {
    orderByClause = normalizedSort.sortOrder === 'asc'
      ? sql`COALESCE(${messageCounts.count}, 0) ASC`
      : sql`COALESCE(${messageCounts.count}, 0) DESC`;
  } else {
    orderByClause = normalizedSort.sortOrder === 'asc'
      ? asc(tickets.createdAt)
      : desc(tickets.createdAt);
  }

  const results = await db
    .with(messageCounts)
    .select({
      ticket: tickets,
      author: users,
      channel: channels,
      panel: panels,
      messageCount: sql<number>`COALESCE(${messageCounts.count}, 0)`,
      searchMatchedByParticipant: search
        ? /^\d+$/.test(search.trim())
          ? sql<boolean>`EXISTS (
              SELECT 1
              FROM ${messages}
              WHERE ${messages.channelId} = ${tickets.channelId}
              AND ${messages.isDeleted} = false
              AND ${messages.authorId} = ${BigInt(search.trim())}
              AND ${tickets.authorId} <> ${BigInt(search.trim())}
            )`
          : sql<boolean>`EXISTS (
              SELECT 1
              FROM ${messages} participant_messages
              INNER JOIN ${users} participant_users ON participant_messages.author_id = participant_users.discord_id
              WHERE participant_messages.channel_id = ${tickets.channelId}
              AND participant_messages.is_deleted = false
              AND participant_messages.author_id <> ${tickets.authorId}
              AND (
                participant_users.name ILIKE ${`%${search.trim()}%`}
                OR participant_users.display_name ILIKE ${`%${search.trim()}%`}
              )
            )`
        : sql<boolean>`false`,
    })
    .from(tickets)
    .leftJoin(users, eq(tickets.authorId, users.discordId))
    .leftJoin(channels, eq(tickets.channelId, channels.channelId))
    .leftJoin(panels, eq(tickets.panelId, panels.id))
    .leftJoin(messageCounts, eq(tickets.channelId, messageCounts.channelId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(orderByClause)
    .limit(limit)
    .offset(offset);

  return results;
}

export async function getTicketCount(params: TicketListParams = {}) {
  const { status, authorId, panelIds, search } = params;
  
  const conditions = [];

  if (status) {
    conditions.push(eq(tickets.status, status));
  }

  if (authorId) {
    conditions.push(eq(tickets.authorId, authorId));
  }

  if (panelIds && panelIds.length > 0) {
    conditions.push(inArray(tickets.panelId, panelIds));
  }

  if (search) {
    const searchCondition = buildTicketSearchCondition(search);

    if (searchCondition) {
      conditions.push(searchCondition);
    }
  }

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tickets)
    .leftJoin(users, eq(tickets.authorId, users.discordId))
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return result[0]?.count ?? 0;
}

export type MentionLookup = {
  users: Record<string, { name: string; displayName: string | null; displayAvatar: string | null }>;
  roles: Record<string, { name: string; color: number }>;
  channels: Record<string, { name: string }>;
};

export async function getMentionsForMessages(messageResults: MessageSearchResult[]): Promise<MentionLookup> {
  // Collect all unique mention IDs from all messages
  const userIds = new Set<bigint>();
  const roleIds = new Set<bigint>();
  const channelIds = new Set<bigint>();
  type MessageEmbedLike = {
    description?: string;
    title?: string;
    author?: { name?: string };
    footer?: { text?: string };
    fields?: Array<{ name?: string; value?: string }>;
  };

  // Helper function to extract mention IDs from text
  const extractMentionIds = (text: string) => {
    if (!text) return;
    const mentionPattern = /<@!?(\d+)>|<@&(\d+)>|<#(\d+)>/g;
    let match;
    while ((match = mentionPattern.exec(text)) !== null) {
      if (match[1]) userIds.add(BigInt(match[1])); // User mention
      if (match[2]) roleIds.add(BigInt(match[2])); // Role mention
      if (match[3]) channelIds.add(BigInt(match[3])); // Channel mention
    }
  };

  for (const result of messageResults) {
    // Extract from stored mention arrays
    result.message.memberMentions?.forEach(id => userIds.add(id));
    result.message.roleMentions?.forEach(id => roleIds.add(id));
    result.message.channelMentions?.forEach(id => channelIds.add(id));

    // Extract from message content
    extractMentionIds(result.message.content || '');

    // Extract from embeds
    if (result.message.embeds) {
      const embeds = Array.isArray(result.message.embeds) ? result.message.embeds : [result.message.embeds];
      for (const embed of embeds) {
        if (typeof embed === 'object' && embed !== null) {
          const embedData = embed as MessageEmbedLike;

          extractMentionIds(embedData.description || '');
          extractMentionIds(embedData.title || '');
          if (embedData.author?.name) extractMentionIds(embedData.author.name);
          if (embedData.footer?.text) extractMentionIds(embedData.footer.text);
          if (embedData.fields && Array.isArray(embedData.fields)) {
            for (const field of embedData.fields) {
              extractMentionIds(field.name || '');
              extractMentionIds(field.value || '');
            }
          }
        }
      }
    }
  }

  // Fetch all mentioned entities in parallel
  const [mentionedUsers, mentionedRoles, mentionedChannels] = await Promise.all([
    userIds.size > 0
      ? db.select().from(users).where(inArray(users.discordId, Array.from(userIds)))
      : Promise.resolve([]),
    roleIds.size > 0
      ? db.select().from(roles).where(inArray(roles.roleId, Array.from(roleIds)))
      : Promise.resolve([]),
    channelIds.size > 0
      ? db.select().from(channels).where(inArray(channels.channelId, Array.from(channelIds)))
      : Promise.resolve([]),
  ]);

  // Build lookup maps
  const mentionLookup: MentionLookup = {
    users: {},
    roles: {},
    channels: {},
  };

  for (const user of mentionedUsers) {
    mentionLookup.users[user.discordId.toString()] = {
      name: user.name || user.displayName || 'Unknown User',
      displayName: user.displayName,
      displayAvatar: user.displayAvatar,
    };
  }

  for (const role of mentionedRoles) {
    mentionLookup.roles[role.roleId.toString()] = {
      name: role.name,
      color: role.color,
    };
  }

  for (const channel of mentionedChannels) {
    mentionLookup.channels[channel.channelId.toString()] = {
      name: channel.name,
    };
  }

  return mentionLookup;
}

/**
 * Get all roles for a specific user, ordered by position (highest first)
 */
export async function getUserRoles(userId: bigint) {
  return db
    .select({
      role: roles,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.roleId))
    .where(eq(userRoles.userId, userId))
    .orderBy(desc(roles.position));
}

/**
 * Get all panels for ticket filtering
 */
export async function getAllPanels() {
  return db
    .select({
      id: panels.id,
      title: panels.title,
    })
    .from(panels)
    .orderBy(asc(panels.title));
}

/**
 * Get ticket statistics for a specific user (optimized single query)
 * Returns counts for open, closed, and deleted tickets
 */
export async function getUserTicketStats(userId: bigint) {
  const result = await db
    .select({
      openCount: sql<number>`COUNT(*) FILTER (WHERE ${tickets.status} = 'OPEN')::int`,
      closedCount: sql<number>`COUNT(*) FILTER (WHERE ${tickets.status} = 'CLOSED')::int`,
      deletedCount: sql<number>`COUNT(*) FILTER (WHERE ${tickets.status} = 'DELETED')::int`,
    })
    .from(tickets)
    .where(eq(tickets.authorId, userId));

  const stats = result[0];
  return {
    open: stats?.openCount || 0,
    closed: stats?.closedCount || 0,
    deleted: stats?.deletedCount || 0,
  };
}

// ============================================================================
// USER MANAGEMENT QUERIES
// ============================================================================


/**
 * Get all roles for filter dropdown (non-deleted roles)
 */
export async function getAllRoles() {
  return db
    .select({
      id: roles.roleId,
      name: roles.name,
      color: roles.color,
      position: roles.position,
    })
    .from(roles)
    .where(eq(roles.deleted, false))
    .orderBy(desc(roles.position));
}

export type UserSearchParams = {
  query?: string;
  assignmentStatus?: 'NEEDS_SUPPORT' | 'INACTIVE' | 'SELF_SUFFICIENT' | 'PAUSED' | 'NOT_READY';
  relationToIslam?: string;
  inGuild?: boolean;
  verified?: boolean;
  voiceVerified?: boolean;
  roleId?: bigint;
  supervisorId?: bigint;
  hasShahada?: boolean;
  hasSupport?: boolean;
  sortBy?: 'name' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
};

type UserFilterParams = Omit<UserSearchParams, 'sortBy' | 'sortOrder' | 'limit' | 'offset'>;

function buildUserFilterConditions(params: UserFilterParams): SQL[] {
  const {
    query,
    assignmentStatus,
    relationToIslam,
    inGuild,
    verified,
    voiceVerified,
    roleId,
    supervisorId,
    hasShahada,
    hasSupport,
  } = params;

  const conditions: SQL[] = [];

  if (query) {
    conditions.push(
      or(
        ilike(users.displayName, `%${query}%`),
        ilike(users.name, `%${query}%`)
      )!
    );
  }

  if (relationToIslam) {
    conditions.push(eq(users.relationToIslam, relationToIslam));
  }

  if (inGuild !== undefined) {
    conditions.push(eq(users.inGuild, inGuild));
  }

  if (verified !== undefined) {
    conditions.push(eq(users.isVerified, verified));
  }

  if (voiceVerified !== undefined) {
    conditions.push(eq(users.isVoiceVerified, voiceVerified));
  }

  if (roleId) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM ${userRoles}
        WHERE ${userRoles.userId} = ${users.discordId}
        AND ${userRoles.roleId} = ${roleId}
      )`
    );
  }

  if (assignmentStatus) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM ${assignmentStatuses}
        WHERE ${assignmentStatuses.userId} = ${users.discordId}
        AND ${assignmentStatuses.active} = true
        AND ${assignmentStatuses.status} = ${assignmentStatus}
      )`
    );
  }

  if (supervisorId) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM ${userSupervisors}
        WHERE ${userSupervisors.userId} = ${users.discordId}
        AND ${userSupervisors.supervisorId} = ${supervisorId}
        AND ${userSupervisors.active} = true
      )`
    );
  }

  if (hasShahada) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM ${shahadas}
        WHERE ${shahadas.userId} = ${users.discordId}
      )`
    );
  }

  if (hasSupport) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM ${userSupervisors}
        WHERE ${userSupervisors.userId} = ${users.discordId}
        AND ${userSupervisors.active} = true
      )`
    );
  }

  return conditions;
}

/**
 * Search users with filters for the users list
 * Searches display_name first, then name
 */
export async function searchUsers(params: UserSearchParams) {
  const {
    sortBy = 'createdAt',
    sortOrder = 'desc',
    limit = 50,
    offset = 0,
    ...filters
  } = params;

  const conditions = buildUserFilterConditions(filters);
  const supervisorUsers = alias(users, 'supervisor_users');

  const currentAssignmentStatuses = db
    .selectDistinctOn([assignmentStatuses.userId], {
      userId: assignmentStatuses.userId,
      currentAssignmentStatus: assignmentStatuses.status,
    })
    .from(assignmentStatuses)
    .where(eq(assignmentStatuses.active, true))
    .orderBy(assignmentStatuses.userId, desc(assignmentStatuses.createdAt))
    .as('current_assignment_statuses');

  const activeSupervisorCounts = db
    .select({
      userId: userSupervisors.userId,
      activeSupervisorCount: sql<number>`COUNT(*)::int`.as('activeSupervisorCount'),
    })
    .from(userSupervisors)
    .where(eq(userSupervisors.active, true))
    .groupBy(userSupervisors.userId)
    .as('active_supervisor_counts');

  const latestActiveSupervisors = db
    .selectDistinctOn([userSupervisors.userId], {
      userId: userSupervisors.userId,
      supervisorName: supervisorUsers.name,
      supervisorDisplayName: supervisorUsers.displayName,
      supervisorAvatar: supervisorUsers.displayAvatar,
    })
    .from(userSupervisors)
    .innerJoin(supervisorUsers, eq(userSupervisors.supervisorId, supervisorUsers.discordId))
    .where(eq(userSupervisors.active, true))
    .orderBy(userSupervisors.userId, desc(userSupervisors.createdAt))
    .as('latest_active_supervisors');

  const activeSupportNeedsCounts = db
    .select({
      userId: supervisionNeeds.userId,
      activeSupportNeedsCount: sql<number>`COUNT(*)::int`.as('activeSupportNeedsCount'),
    })
    .from(supervisionNeeds)
    .where(isNull(supervisionNeeds.resolvedAt))
    .groupBy(supervisionNeeds.userId)
    .as('active_support_needs_counts');

  const activeInfractionCounts = db
    .select({
      userId: infractions.userId,
      activeInfractionCount: sql<number>`COUNT(*)::int`.as('activeInfractionCount'),
    })
    .from(infractions)
    .where(eq(infractions.status, 'ACTIVE'))
    .groupBy(infractions.userId)
    .as('active_infraction_counts');

  const lastCheckIns = db
    .select({
      userId: revertCheckIns.userId,
      lastCheckInAt: sql<Date | null>`MAX(${revertCheckIns.checkedInAt})`.as('lastCheckInAt'),
    })
    .from(revertCheckIns)
    .groupBy(revertCheckIns.userId)
    .as('last_check_ins');

  const openTicketCounts = db
    .select({
      userId: tickets.authorId,
      openTicketCount: sql<number>`COUNT(*)::int`.as('openTicketCount'),
    })
    .from(tickets)
    .where(eq(tickets.status, 'OPEN'))
    .groupBy(tickets.authorId)
    .as('open_ticket_counts');

  // Build sort order
  const orderByClause = sortBy === 'name'
    ? (sortOrder === 'asc' ? asc(sql`COALESCE(${users.displayName}, ${users.name})`) : desc(sql`COALESCE(${users.displayName}, ${users.name})`))
    : (sortOrder === 'asc' ? asc(users.createdAt) : desc(users.createdAt));

  // Single query with joined aggregates for derived fields and a compact top-role subquery.
  const results = await db
    .select({
      user: users,
      currentAssignmentStatus: currentAssignmentStatuses.currentAssignmentStatus,
      activeSupervisorCount: sql<number>`COALESCE(${activeSupervisorCounts.activeSupervisorCount}, 0)`,
      supervisorName: latestActiveSupervisors.supervisorName,
      supervisorDisplayName: latestActiveSupervisors.supervisorDisplayName,
      supervisorAvatar: latestActiveSupervisors.supervisorAvatar,
      activeSupportNeedsCount: sql<number>`COALESCE(${activeSupportNeedsCounts.activeSupportNeedsCount}, 0)`,
      activeInfractionCount: sql<number>`COALESCE(${activeInfractionCounts.activeInfractionCount}, 0)`,
      lastCheckInAt: lastCheckIns.lastCheckInAt,
      openTicketCount: sql<number>`COALESCE(${openTicketCounts.openTicketCount}, 0)`,
      topRoles: sql<Array<{ id: string; name: string; color: number }> | null>`(
        SELECT COALESCE(json_agg(role_data), '[]'::json)
        FROM (
          SELECT 
            r.role_id::text as id,
            r.name,
            r.color
          FROM ${userRoles} ur
          INNER JOIN ${roles} r ON ur.role_id = r.role_id
          WHERE ur.user_id = ${users.discordId}
          ORDER BY r.position DESC
          LIMIT 3
        ) role_data
      )`,
    })
    .from(users)
    .leftJoin(currentAssignmentStatuses, eq(currentAssignmentStatuses.userId, users.discordId))
    .leftJoin(activeSupervisorCounts, eq(activeSupervisorCounts.userId, users.discordId))
    .leftJoin(latestActiveSupervisors, eq(latestActiveSupervisors.userId, users.discordId))
    .leftJoin(activeSupportNeedsCounts, eq(activeSupportNeedsCounts.userId, users.discordId))
    .leftJoin(activeInfractionCounts, eq(activeInfractionCounts.userId, users.discordId))
    .leftJoin(lastCheckIns, eq(lastCheckIns.userId, users.discordId))
    .leftJoin(openTicketCounts, eq(openTicketCounts.userId, users.discordId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(orderByClause)
    .limit(limit)
    .offset(offset);

  return results.map(r => ({
    ...r,
    topRoles: r.topRoles || [],
  }));
}

/**
 * Get total user count for pagination
 */
export async function getUserCount(params: Omit<UserSearchParams, 'sortBy' | 'sortOrder' | 'limit' | 'offset'>) {
  const conditions = buildUserFilterConditions(params);

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return result[0]?.count ?? 0;
}

// ============================================================================
// USER PROFILE QUERIES
// ============================================================================

/**
 * Get shahadas for a user (when they took shahada)
 */
export async function getUserShahadas(userId: bigint) {
  return db
    .select({
      id: shahadas.id,
      createdAt: shahadas.createdAt,
      supervisorId: shahadas.supervisorId,
      supervisorName: users.name,
      supervisorDisplayName: users.displayName,
      supervisorAvatar: users.displayAvatar,
    })
    .from(shahadas)
    .leftJoin(users, eq(shahadas.supervisorId, users.discordId))
    .where(eq(shahadas.userId, userId))
    .orderBy(desc(shahadas.createdAt));
}

/**
 * Get current supervisors for a user
 */
export async function getUserSupervisors(userId: bigint) {
  return db
    .select({
      id: userSupervisors.id,
      supervisorId: userSupervisors.supervisorId,
      active: userSupervisors.active,
      createdAt: userSupervisors.createdAt,
      supervisorName: users.name,
      supervisorDisplayName: users.displayName,
      supervisorAvatar: users.displayAvatar,
    })
    .from(userSupervisors)
    .leftJoin(users, eq(userSupervisors.supervisorId, users.discordId))
    .where(eq(userSupervisors.userId, userId))
    .orderBy(desc(userSupervisors.createdAt));
}

/**
 * Get assignment status history for a user
 */
export async function getUserAssignmentHistory(userId: bigint) {
  return db
    .select({
      id: assignmentStatuses.id,
      status: assignmentStatuses.status,
      priority: assignmentStatuses.priority,
      notes: assignmentStatuses.notes,
      active: assignmentStatuses.active,
      createdAt: assignmentStatuses.createdAt,
      resolvedAt: assignmentStatuses.resolvedAt,
      addedById: assignmentStatuses.addedById,
      addedByName: sql<string | null>`(
        SELECT name FROM "User" WHERE discord_id = ${assignmentStatuses.addedById}
      )`,
      resolvedById: assignmentStatuses.resolvedById,
      resolvedByName: sql<string | null>`(
        SELECT name FROM "User" WHERE discord_id = ${assignmentStatuses.resolvedById}
      )`,
    })
    .from(assignmentStatuses)
    .where(eq(assignmentStatuses.userId, userId))
    .orderBy(desc(assignmentStatuses.createdAt));
}

/**
 * Get supervision needs for a user
 */
export async function getUserSupervisionNeeds(userId: bigint) {
  return db
    .select({
      id: supervisionNeeds.id,
      needType: supervisionNeeds.needType,
      severity: supervisionNeeds.severity,
      notes: supervisionNeeds.notes,
      createdAt: supervisionNeeds.createdAt,
      resolvedAt: supervisionNeeds.resolvedAt,
      addedById: supervisionNeeds.addedBy,
      addedByName: sql<string | null>`(
        SELECT name FROM "User" WHERE discord_id = ${supervisionNeeds.addedBy}
      )`,
    })
    .from(supervisionNeeds)
    .where(eq(supervisionNeeds.userId, userId))
    .orderBy(desc(supervisionNeeds.createdAt));
}

/**
 * Get infractions for a user
 */
export async function getUserInfractions(userId: bigint) {
  return db
    .select({
      id: infractions.id,
      type: infractions.type,
      status: infractions.status,
      reason: infractions.reason,
      hidden: infractions.hidden,
      jumpUrl: infractions.jumpUrl,
      expiresAt: infractions.expiresAt,
      createdAt: infractions.createdAt,
      moderatorId: infractions.moderatorId,
      moderatorName: sql<string | null>`(
        SELECT name FROM "User" WHERE discord_id = ${infractions.moderatorId}
      )`,
      pardonedById: infractions.pardonedById,
      pardonedAt: infractions.pardonedAt,
      pardonReason: infractions.pardonReason,
    })
    .from(infractions)
    .where(eq(infractions.userId, userId))
    .orderBy(desc(infractions.createdAt));
}

/**
 * Get supervisor entries/notes for a user
 */
export async function getUserSupervisorEntries(userId: bigint) {
  return db
    .select({
      id: userSupervisorEntries.id,
      note: userSupervisorEntries.note,
      createdAt: userSupervisorEntries.createdAt,
      supervisorId: userSupervisorEntries.supervisorId,
      supervisorName: sql<string | null>`(
        SELECT name FROM "User" WHERE discord_id = ${userSupervisorEntries.supervisorId}
      )`,
      supervisorDisplayName: sql<string | null>`(
        SELECT display_name FROM "User" WHERE discord_id = ${userSupervisorEntries.supervisorId}
      )`,
    })
    .from(userSupervisorEntries)
    .where(eq(userSupervisorEntries.userId, userId))
    .orderBy(desc(userSupervisorEntries.createdAt));
}

/**
 * Get distinct relation_to_islam values for filter dropdown
 */
export async function getDistinctRelationsToIslam() {
  const result = await db
    .selectDistinct({ relationToIslam: users.relationToIslam })
    .from(users)
    .where(isNotNull(users.relationToIslam))
    .orderBy(asc(users.relationToIslam));
  
  return result.map(r => r.relationToIslam).filter(Boolean) as string[];
}

// ============================================================================
// STAFF QUERIES
// ============================================================================

export type StaffSearchParams = {
  query?: string;
  sortBy?: 'name' | 'superviseeCount';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
};

/**
 * Get staff members with their active supervisees
 * Staff = users who have at least one active supervisee in UserSupervisor table
 */
export async function searchStaffWithSupervisees(params: StaffSearchParams) {
  const {
    query,
    sortBy = 'superviseeCount',
    sortOrder = 'desc',
    limit = 50,
    offset = 0,
  } = params;

  // First, get unique supervisor IDs with active supervisees
  const conditions = [];

  // Base condition - must have active supervisees
  conditions.push(eq(userSupervisors.active, true));

  // Build query to get staff with supervisee counts
  const superviseeCountsQuery = db
    .$with('supervisee_counts')
    .as(
      db
        .select({
          supervisorId: userSupervisors.supervisorId,
          count: sql<number>`COUNT(*)::int`.as('count'),
        })
        .from(userSupervisors)
        .where(eq(userSupervisors.active, true))
        .groupBy(userSupervisors.supervisorId)
    );

  // Search conditions for staff
  const staffConditions = [];
  if (query) {
    staffConditions.push(
      or(
        ilike(users.displayName, `%${query}%`),
        ilike(users.name, `%${query}%`)
      )
    );
  }

  // Get staff with counts
  const orderByClause = sortBy === 'name'
    ? (sortOrder === 'asc' ? asc(sql`COALESCE(${users.displayName}, ${users.name})`) : desc(sql`COALESCE(${users.displayName}, ${users.name})`))
    : (sortOrder === 'asc' ? asc(superviseeCountsQuery.count) : desc(superviseeCountsQuery.count));

  const results = await db
    .with(superviseeCountsQuery)
    .select({
      user: users,
      superviseeCount: superviseeCountsQuery.count,
    })
    .from(users)
    .innerJoin(superviseeCountsQuery, eq(users.discordId, superviseeCountsQuery.supervisorId))
    .where(staffConditions.length > 0 ? and(...staffConditions) : undefined)
    .orderBy(orderByClause)
    .limit(limit)
    .offset(offset);

  // Batch fetch roles and supervisees for all staff
  const staffIds = results.map(r => r.user.discordId);
  
  const staffRolesMap: Record<string, Array<{ id: string; name: string; color: number }>> = {};
  const superviseesMap: Record<string, Array<{ id: string; name: string | null; displayName: string | null }>> = {};

  if (staffIds.length > 0) {
    // Fetch roles
    const rolesData = await db
      .select({
        userId: userRoles.userId,
        roleId: roles.roleId,
        roleName: roles.name,
        roleColor: roles.color,
        rolePosition: roles.position,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.roleId))
      .where(inArray(userRoles.userId, staffIds))
      .orderBy(desc(roles.position));

    // Group by user, take top 3
    for (const row of rolesData) {
      const key = row.userId.toString();
      if (!staffRolesMap[key]) {
        staffRolesMap[key] = [];
      }
      if (staffRolesMap[key].length < 3) {
        staffRolesMap[key].push({
          id: row.roleId.toString(),
          name: row.roleName,
          color: row.roleColor,
        });
      }
    }

    // Fetch supervisees for each staff member
    const superviseesData = await db
      .select({
        supervisorId: userSupervisors.supervisorId,
        userId: userSupervisors.userId,
        userName: users.name,
        userDisplayName: users.displayName,
      })
      .from(userSupervisors)
      .innerJoin(users, eq(userSupervisors.userId, users.discordId))
      .where(and(
        inArray(userSupervisors.supervisorId, staffIds),
        eq(userSupervisors.active, true)
      ))
      .orderBy(asc(users.displayName));

    // Group supervisees by supervisor
    for (const row of superviseesData) {
      const key = row.supervisorId.toString();
      if (!superviseesMap[key]) {
        superviseesMap[key] = [];
      }
      superviseesMap[key].push({
        id: row.userId.toString(),
        name: row.userName,
        displayName: row.userDisplayName,
      });
    }
  }

  return results.map(r => ({
    ...r,
    topRoles: staffRolesMap[r.user.discordId.toString()] || [],
    supervisees: superviseesMap[r.user.discordId.toString()] || [],
  }));
}

/**
 * Get count of staff members for pagination
 */
export async function getStaffCount(params: { query?: string }) {
  const { query } = params;

  const conditions = [];
  
  if (query) {
    conditions.push(
      or(
        ilike(users.displayName, `%${query}%`),
        ilike(users.name, `%${query}%`)
      )
    );
  }

  // Count users who have at least one active supervisee
  const result = await db
    .select({ count: sql<number>`count(DISTINCT ${userSupervisors.supervisorId})::int` })
    .from(userSupervisors)
    .innerJoin(users, eq(userSupervisors.supervisorId, users.discordId))
    .where(and(
      eq(userSupervisors.active, true),
      ...(conditions.length > 0 ? conditions : [])
    ));

  return result[0]?.count ?? 0;
}

/**
 * Get detailed staff member information including their supervisees with status
 * Used for the staff details side panel
 */
export async function getStaffDetails(staffId: bigint) {
  // Fetch staff user basic info
  const staffResult = await db
    .select()
    .from(users)
    .where(eq(users.discordId, staffId))
    .limit(1);

  if (!staffResult[0]) {
    return null;
  }

  const staffUser = staffResult[0];

  // Fetch supervisees with their assignment status and avatar
  const superviseesData = await db
    .select({
      userId: userSupervisors.userId,
      userName: users.name,
      userDisplayName: users.displayName,
      userAvatar: users.displayAvatar,
      inGuild: users.inGuild,
      isVerified: users.isVerified,
      assignedAt: userSupervisors.createdAt,
      currentAssignmentStatus: sql<string | null>`(
        SELECT ${assignmentStatuses.status}
        FROM ${assignmentStatuses}
        WHERE ${assignmentStatuses.userId} = ${users.discordId}
        AND ${assignmentStatuses.active} = true
        ORDER BY ${assignmentStatuses.createdAt} DESC
        LIMIT 1
      )`,
    })
    .from(userSupervisors)
    .innerJoin(users, eq(userSupervisors.userId, users.discordId))
    .where(and(
      eq(userSupervisors.supervisorId, staffId),
      eq(userSupervisors.active, true)
    ))
    .orderBy(asc(users.displayName));

  // Fetch staff roles
  const rolesData = await db
    .select({
      roleId: roles.roleId,
      roleName: roles.name,
      roleColor: roles.color,
      rolePosition: roles.position,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.roleId))
    .where(eq(userRoles.userId, staffId))
    .orderBy(desc(roles.position));

  return {
    staff: {
      id: staffUser.discordId.toString(),
      name: staffUser.name,
      displayName: staffUser.displayName,
      displayAvatar: staffUser.displayAvatar,
      inGuild: staffUser.inGuild,
      isVerified: staffUser.isVerified,
      isVoiceVerified: staffUser.isVoiceVerified,
    },
    supervisees: superviseesData.map(s => ({
      id: s.userId.toString(),
      name: s.userName,
      displayName: s.userDisplayName,
      displayAvatar: s.userAvatar,
      inGuild: s.inGuild,
      isVerified: s.isVerified,
      assignmentStatus: s.currentAssignmentStatus,
      assignedAt: s.assignedAt.toISOString(),
    })),
    roles: rolesData.map(r => ({
      id: r.roleId.toString(),
      name: r.roleName,
      color: r.roleColor,
      position: r.rolePosition,
    })),
    stats: {
      totalSupervisees: superviseesData.length,
      needsSupport: superviseesData.filter(s => s.currentAssignmentStatus === 'NEEDS_SUPPORT').length,
    },
  };
}

// ============================================================================
// REVERT TAG QUERIES
// ============================================================================

/**
 * Get all non-archived tags
 */
export async function getRevertTags() {
  return db
    .select()
    .from(revertTags)
    .where(eq(revertTags.isArchived, false))
    .orderBy(asc(revertTags.category), asc(revertTags.name));
}

/**
 * Get all tags including archived (for admin page)
 */
export async function getAllRevertTags() {
  return db
    .select({
      tag: revertTags,
      activeCount: sql<number>`(
        SELECT COUNT(*)::int FROM revert_tag_assignment
        WHERE tag_id = ${revertTags.id} AND removed_at IS NULL
      )`,
    })
    .from(revertTags)
    .orderBy(asc(revertTags.category), asc(revertTags.name));
}

/**
 * Create a new tag
 */
export async function createRevertTag(data: {
  name: string;
  description?: string;
  color: string;
  emoji?: string;
  category?: string;
  createdById: bigint;
}) {
  const result = await db
    .insert(revertTags)
    .values({
      name: data.name,
      description: data.description || null,
      color: data.color,
      emoji: data.emoji || null,
      category: data.category || null,
      createdById: data.createdById,
    })
    .returning();

  return result[0];
}

/**
 * Update a tag
 */
export async function updateRevertTag(tagId: number, data: {
  name?: string;
  description?: string;
  color?: string;
  emoji?: string;
  category?: string;
}) {
  const result = await db
    .update(revertTags)
    .set(data)
    .where(eq(revertTags.id, tagId))
    .returning();

  return result[0];
}

/**
 * Archive a tag (soft-delete)
 */
export async function archiveRevertTag(tagId: number) {
  const result = await db
    .update(revertTags)
    .set({ isArchived: true })
    .where(eq(revertTags.id, tagId))
    .returning();

  return result[0];
}

/**
 * Get active tags and full assignment history for a user
 */
export async function getUserTagAssignments(userId: bigint) {
  return db
    .select({
      id: revertTagAssignments.id,
      tagId: revertTagAssignments.tagId,
      tagName: revertTags.name,
      tagColor: revertTags.color,
      tagEmoji: revertTags.emoji,
      tagCategory: revertTags.category,
      assignedAt: revertTagAssignments.assignedAt,
      assignedById: revertTagAssignments.assignedById,
      assignedByName: sql<string | null>`(
        SELECT COALESCE(display_name, name) FROM "User" WHERE discord_id = ${revertTagAssignments.assignedById}
      )`,
      removedAt: revertTagAssignments.removedAt,
      removedById: revertTagAssignments.removedById,
      removedByName: sql<string | null>`(
        SELECT COALESCE(display_name, name) FROM "User" WHERE discord_id = ${revertTagAssignments.removedById}
      )`,
      note: revertTagAssignments.note,
      removalNote: revertTagAssignments.removalNote,
    })
    .from(revertTagAssignments)
    .innerJoin(revertTags, eq(revertTagAssignments.tagId, revertTags.id))
    .where(eq(revertTagAssignments.userId, userId))
    .orderBy(desc(revertTagAssignments.assignedAt));
}

/**
 * Assign a tag to a user. Enforces one active instance per tag per user.
 */
export async function assignTagToUser(data: {
  userId: bigint;
  tagId: number;
  assignedById: bigint;
  note?: string;
}) {
  // Check for existing active assignment
  const existing = await db
    .select({ id: revertTagAssignments.id })
    .from(revertTagAssignments)
    .where(and(
      eq(revertTagAssignments.userId, data.userId),
      eq(revertTagAssignments.tagId, data.tagId),
      isNull(revertTagAssignments.removedAt)
    ))
    .limit(1);

  if (existing.length > 0) {
    throw new Error('Tag is already active for this user');
  }

  const result = await db
    .insert(revertTagAssignments)
    .values({
      userId: data.userId,
      tagId: data.tagId,
      assignedById: data.assignedById,
      note: data.note || null,
    })
    .returning();

  return result[0];
}

/**
 * Remove a tag from a user (set removedAt and removedById)
 */
export async function removeTagFromUser(data: {
  assignmentId: number;
  removedById: bigint;
  removalNote?: string;
}) {
  const result = await db
    .update(revertTagAssignments)
    .set({
      removedAt: new Date(),
      removedById: data.removedById,
      removalNote: data.removalNote || null,
    })
    .where(and(
      eq(revertTagAssignments.id, data.assignmentId),
      isNull(revertTagAssignments.removedAt) // Only remove active assignments
    ))
    .returning();

  return result[0];
}

// ============================================================================
// REVERT CHECK-IN QUERIES
// ============================================================================

/**
 * Get check-ins for a user, newest first
 */
export async function getUserCheckIns(userId: bigint, limit = 50) {
  return db
    .select({
      id: revertCheckIns.id,
      staffId: revertCheckIns.staffId,
      staffName: sql<string | null>`(
        SELECT COALESCE(display_name, name) FROM "User" WHERE discord_id = ${revertCheckIns.staffId}
      )`,
      staffAvatar: sql<string | null>`(
        SELECT display_avatar FROM "User" WHERE discord_id = ${revertCheckIns.staffId}
      )`,
      method: revertCheckIns.method,
      summary: revertCheckIns.summary,
      checkedInAt: revertCheckIns.checkedInAt,
    })
    .from(revertCheckIns)
    .where(eq(revertCheckIns.userId, userId))
    .orderBy(desc(revertCheckIns.checkedInAt))
    .limit(limit);
}

/**
 * Add a check-in
 */
export async function addCheckIn(data: {
  userId: bigint;
  staffId: bigint;
  method: string;
  summary?: string;
}) {
  const result = await db
    .insert(revertCheckIns)
    .values({
      userId: data.userId,
      staffId: data.staffId,
      method: data.method,
      summary: data.summary || null,
    })
    .returning();

  return result[0];
}

// ============================================================================
// DASHBOARD QUERIES
// ============================================================================

/**
 * Get dashboard data for a staff member
 */
export async function getMyDashboardData(staffDiscordId: bigint) {
  const dashboardSupervisorUsers = alias(users, 'dashboard_supervisor_users');
  const dashboardTicketAuthors = alias(users, 'dashboard_ticket_authors');

  const currentAssignmentStatuses = db
    .selectDistinctOn([assignmentStatuses.userId], {
      userId: assignmentStatuses.userId,
      currentAssignmentStatus: assignmentStatuses.status,
    })
    .from(assignmentStatuses)
    .where(eq(assignmentStatuses.active, true))
    .orderBy(assignmentStatuses.userId, desc(assignmentStatuses.createdAt))
    .as('dashboard_current_assignment_statuses');

  const userLastCheckIns = db
    .select({
      userId: revertCheckIns.userId,
      lastCheckIn: sql<string | null>`MAX(${revertCheckIns.checkedInAt})::text`.as('lastCheckIn'),
    })
    .from(revertCheckIns)
    .groupBy(revertCheckIns.userId)
    .as('dashboard_user_last_check_ins');

  const activeUserTags = db
    .select({
      userId: revertTagAssignments.userId,
      activeTags: sql<Array<{ id: number; name: string; color: string; emoji: string | null }> | null>`
        COALESCE(
          json_agg(
            json_build_object(
              'id', ${revertTags.id},
              'name', ${revertTags.name},
              'color', ${revertTags.color},
              'emoji', ${revertTags.emoji}
            )
          ),
          '[]'::json
        )
      `.as('activeTags'),
    })
    .from(revertTagAssignments)
    .innerJoin(revertTags, eq(revertTagAssignments.tagId, revertTags.id))
    .where(isNull(revertTagAssignments.removedAt))
    .groupBy(revertTagAssignments.userId)
    .as('dashboard_active_user_tags');

  const latestActiveAssignees = db
    .selectDistinctOn([userSupervisors.userId], {
      userId: userSupervisors.userId,
      assigneeId: sql<string | null>`${userSupervisors.supervisorId}::text`.as('assigneeId'),
      assigneeName: sql<string | null>`COALESCE(${dashboardSupervisorUsers.displayName}, ${dashboardSupervisorUsers.name})`.as('assigneeName'),
      assigneeAvatar: dashboardSupervisorUsers.displayAvatar,
    })
    .from(userSupervisors)
    .innerJoin(
      dashboardSupervisorUsers,
      eq(userSupervisors.supervisorId, dashboardSupervisorUsers.discordId)
    )
    .where(eq(userSupervisors.active, true))
    .orderBy(userSupervisors.userId, desc(userSupervisors.createdAt))
    .as('dashboard_latest_active_assignees');

  const activeAssigneeCounts = db
    .select({
      userId: userSupervisors.userId,
      activeAssigneeCount: sql<number>`COUNT(*)::int`.as('activeAssigneeCount'),
    })
    .from(userSupervisors)
    .where(eq(userSupervisors.active, true))
    .groupBy(userSupervisors.userId)
    .as('dashboard_active_assignee_counts');

  const recentTicketActivity = db
    .select({
      channelId: messages.channelId,
      latestRelevantActivityAt: sql<Date | null>`MAX(${messages.createdAt})`.as('latestRelevantActivityAt'),
    })
    .from(messages)
    .where(
      or(
        eq(messages.authorId, staffDiscordId),
        sql`array_position(${messages.memberMentions}, ${staffDiscordId}) IS NOT NULL`
      )
    )
    .groupBy(messages.channelId)
    .as('dashboard_recent_ticket_activity');

  const staffTicketMessages = db
    .select({
      channelId: messages.channelId,
      lastMessageAt: sql<Date | null>`MAX(${messages.createdAt})`.as('lastMessageAt'),
    })
    .from(messages)
    .where(eq(messages.authorId, staffDiscordId))
    .groupBy(messages.channelId)
    .as('dashboard_staff_ticket_messages');

  const shahadaWithMeDates = db
    .select({
      userId: shahadas.userId,
      shahadaAt: sql<string | null>`MAX(${shahadas.createdAt})::text`.as('shahadaAt'),
    })
    .from(shahadas)
    .where(eq(shahadas.supervisorId, staffDiscordId))
    .groupBy(shahadas.userId)
    .as('dashboard_shahada_with_me_dates');

  // 1. Get assigned reverts with their status, active tags, and last check-in
  const assignedReverts = await db
    .select({
      userId: userSupervisors.userId,
      userName: users.name,
      userDisplayName: users.displayName,
      userAvatar: users.displayAvatar,
      inGuild: users.inGuild,
      assignedAt: userSupervisors.createdAt,
      currentAssignmentStatus: currentAssignmentStatuses.currentAssignmentStatus,
      lastCheckIn: userLastCheckIns.lastCheckIn,
      activeTags: activeUserTags.activeTags,
    })
    .from(userSupervisors)
    .innerJoin(users, eq(userSupervisors.userId, users.discordId))
    .leftJoin(currentAssignmentStatuses, eq(currentAssignmentStatuses.userId, users.discordId))
    .leftJoin(userLastCheckIns, eq(userLastCheckIns.userId, users.discordId))
    .leftJoin(activeUserTags, eq(activeUserTags.userId, users.discordId))
    .where(and(
      eq(userSupervisors.supervisorId, staffDiscordId),
      eq(userSupervisors.active, true)
    ))
    .orderBy(asc(users.displayName));

  // 2. Shahada count
  const shahadaResult = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(shahadas)
    .where(eq(shahadas.supervisorId, staffDiscordId));

  const relevantOpenTicketCount = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(tickets)
    .innerJoin(recentTicketActivity, eq(recentTicketActivity.channelId, tickets.channelId))
    .where(eq(tickets.status, 'OPEN'));

  // 3. Get recent tickets where staff replied or was mentioned
  const staffTickets = await db
    .select({
      ticketId: tickets.id,
      ticketSequence: tickets.sequence,
      ticketStatus: tickets.status,
      ticketCreatedAt: tickets.createdAt,
      authorId: tickets.authorId,
      authorName: sql<string | null>`COALESCE(${dashboardTicketAuthors.displayName}, ${dashboardTicketAuthors.name})`,
      authorAvatar: dashboardTicketAuthors.displayAvatar,
      latestRelevantActivityAt: recentTicketActivity.latestRelevantActivityAt,
      lastMessageAt: staffTicketMessages.lastMessageAt,
    })
    .from(tickets)
    .innerJoin(recentTicketActivity, eq(recentTicketActivity.channelId, tickets.channelId))
    .leftJoin(staffTicketMessages, eq(staffTicketMessages.channelId, tickets.channelId))
    .leftJoin(dashboardTicketAuthors, eq(tickets.authorId, dashboardTicketAuthors.discordId))
    .where(
      or(
        eq(tickets.status, 'OPEN'),
        eq(tickets.status, 'CLOSED')
      )
    )
    .orderBy(
      desc(recentTicketActivity.latestRelevantActivityAt),
      desc(tickets.createdAt)
    )
    .limit(10);

  // 4. Shahada-with-me list (latest shahada per user)
  const shahadaWithMe = await db
    .select({
      userId: users.discordId,
      userName: users.name,
      userDisplayName: users.displayName,
      userAvatar: users.displayAvatar,
      inGuild: users.inGuild,
      shahadaAt: shahadaWithMeDates.shahadaAt,
      activeTags: activeUserTags.activeTags,
      assigneeId: latestActiveAssignees.assigneeId,
      assigneeName: latestActiveAssignees.assigneeName,
      assigneeAvatar: latestActiveAssignees.assigneeAvatar,
      activeAssigneeCount: sql<number>`COALESCE(${activeAssigneeCounts.activeAssigneeCount}, 0)`,
    })
    .from(users)
    .innerJoin(shahadaWithMeDates, eq(shahadaWithMeDates.userId, users.discordId))
    .leftJoin(activeUserTags, eq(activeUserTags.userId, users.discordId))
    .leftJoin(latestActiveAssignees, eq(latestActiveAssignees.userId, users.discordId))
    .leftJoin(activeAssigneeCounts, eq(activeAssigneeCounts.userId, users.discordId))
    .orderBy(asc(users.displayName));

  // Compute stats
  const totalReverts = assignedReverts.length;
  const needsSupport = assignedReverts.filter(r => r.currentAssignmentStatus === 'NEEDS_SUPPORT').length;
  const now = new Date();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const overdueCheckIns = assignedReverts.filter(r => {
    if (!r.lastCheckIn) return true; // Never checked in
    return new Date(r.lastCheckIn) < fourteenDaysAgo;
  }).length;
  const openTickets = relevantOpenTicketCount[0]?.count || 0;
  const shahadaCount = shahadaResult[0]?.count || 0;

  return {
    stats: {
      totalReverts,
      needsSupport,
      overdueCheckIns,
      openTickets,
      shahadaCount,
    },
    assignedReverts: assignedReverts.map(r => ({
      id: r.userId.toString(),
      name: r.userName,
      displayName: r.userDisplayName,
      displayAvatar: r.userAvatar,
      inGuild: r.inGuild,
      assignedAt: r.assignedAt.toISOString(),
      assignmentStatus: r.currentAssignmentStatus,
      lastCheckIn: r.lastCheckIn,
      activeTags: r.activeTags || [],
    })),
    recentTickets: staffTickets.map(t => ({
      id: t.ticketId,
      sequence: t.ticketSequence,
      status: t.ticketStatus,
      createdAt: t.ticketCreatedAt.toISOString(),
      author: {
        id: t.authorId.toString(),
        name: t.authorName,
        avatar: t.authorAvatar,
      },
      lastStaffMessageAt: toIsoString(t.lastMessageAt),
    })),
    shahadaWithMe: shahadaWithMe.map(r => ({
      id: r.userId.toString(),
      name: r.userName,
      displayName: r.userDisplayName,
      displayAvatar: r.userAvatar,
      inGuild: r.inGuild,
      shahadaAt: r.shahadaAt,
      activeTags: r.activeTags || [],
      assignee: r.assigneeId
        ? {
          id: r.assigneeId,
          name: r.assigneeName,
          avatar: r.assigneeAvatar,
        }
        : null,
      activeAssigneeCount: r.activeAssigneeCount,
      isAssignedToYou: r.assigneeId === staffDiscordId.toString(),
    })),
  };
}
