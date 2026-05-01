import { and, asc, desc, eq, exists, ilike, inArray, isNotNull, isNull, or, SQL, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from './index';
import { isRevertLikeRelation } from '@/lib/revert-status';
import {
  REVERT_TAG_CATEGORY_VALUES,
  slugifyRevertTagName,
  SUPPORT_RELEVANT_STATES,
  SUPPORT_STATE_REASONS_BY_STATE,
  SUPPORT_STATE_VALUES,
  SYSTEM_REVERT_TAG_SEED_ACTOR_ID,
  SYSTEM_REVERT_TAGS,
  type RevertTagCategoryValue,
  type SupportStateReasonValue,
  type SupportStateValue,
} from '@/lib/revert-support';
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
  tickets,
  userRoles,
  users,
  userSupervisorEntries,
  userSupervisors
} from './schema';
import { CHECK_IN_PANEL_ID } from '@/lib/ticket-panels';

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

export { SUPPORT_STATE_REASONS_BY_STATE };
export type { SupportStateReasonValue };

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

export type AssignmentStatusValue = SupportStateValue;
export type TicketQueue = 'stale' | 'waiting_staff' | 'waiting_user';
export type TicketWaitingOn = 'staff' | 'user' | 'none';
export type TicketQueueState = TicketQueue | 'recent';

export class AssignmentMutationError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = 'ASSIGNMENT_MUTATION_ERROR') {
    super(message);
    this.name = 'AssignmentMutationError';
    this.status = status;
    this.code = code;
  }
}

const CHECK_IN_OVERDUE_DAYS = 14;
const DASHBOARD_STALE_TICKET_THRESHOLD_HOURS = 48;
const SUPPORT_RELEVANT_ASSIGNMENT_STATUSES: AssignmentStatusValue[] = SUPPORT_RELEVANT_STATES;

function buildRevertLikeUserCondition() {
  return or(
    ilike(users.relationToIslam, '%revert%'),
    ilike(users.relationToIslam, '%convert%')
  )!;
}

function buildSupportRelevantAssignmentStatusList() {
  return sql.join(
    SUPPORT_RELEVANT_ASSIGNMENT_STATUSES.map(status => sql`${status}`),
    sql`, `
  );
}

function buildNeedsAssignmentCondition() {
  return sql`(
    ${buildRevertLikeUserCondition()}
    AND NOT EXISTS (
      SELECT 1 FROM ${userSupervisors}
      WHERE ${userSupervisors.userId} = ${users.discordId}
      AND ${userSupervisors.active} = true
    )
    AND EXISTS (
      SELECT 1 FROM ${assignmentStatuses}
      WHERE ${assignmentStatuses.userId} = ${users.discordId}
      AND ${assignmentStatuses.active} = true
      AND ${assignmentStatuses.status} IN (${buildSupportRelevantAssignmentStatusList()})
    )
  )`;
}

function buildStaffRoleNameCondition() {
  return or(
    ilike(roles.name, '%staff%'),
    ilike(roles.name, '%mod%'),
    ilike(roles.name, '%moderator%'),
    ilike(roles.name, '%admin%'),
    ilike(roles.name, '%helper%')
  )!;
}

function buildTicketQueueCtes() {
  const ticketStaffAuthors = db
    .$with('ticket_staff_authors')
    .as(
      db
        .selectDistinct({
          userId: userRoles.userId,
        })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.roleId))
        .where(buildStaffRoleNameCondition())
    );

  const ticketMessageMetrics = db
    .$with('ticket_message_metrics')
    .as(
      db
        .select({
          ticketId: tickets.id,
          messageCount: sql<number>`COUNT(${messages.messageId})::int`.as('message_count'),
          lastMessageAt: sql<Date | null>`MAX(${messages.createdAt})`.as('last_message_at'),
          lastStaffReplyAt: sql<Date | null>`MAX(CASE WHEN ${ticketStaffAuthors.userId} IS NOT NULL THEN ${messages.createdAt} END)`.as('last_staff_reply_at'),
          lastOwnerMessageAt: sql<Date | null>`MAX(CASE WHEN ${messages.authorId} = ${tickets.authorId} THEN ${messages.createdAt} END)`.as('last_owner_message_at'),
        })
        .from(tickets)
        .leftJoin(
          messages,
          and(
            eq(messages.channelId, tickets.channelId),
            eq(messages.isDeleted, false)
          )
        )
        .leftJoin(ticketStaffAuthors, eq(messages.authorId, ticketStaffAuthors.userId))
        .groupBy(tickets.id)
    );

  const waitingStaffCondition = sql`(
    ${ticketMessageMetrics.lastStaffReplyAt} IS NULL
    OR (
      ${ticketMessageMetrics.lastOwnerMessageAt} IS NOT NULL
      AND ${ticketMessageMetrics.lastOwnerMessageAt} > ${ticketMessageMetrics.lastStaffReplyAt}
    )
  )`;

  const waitingUserCondition = sql`(
    ${ticketMessageMetrics.lastStaffReplyAt} IS NOT NULL
    AND (
      ${ticketMessageMetrics.lastOwnerMessageAt} IS NULL
      OR ${ticketMessageMetrics.lastStaffReplyAt} >= ${ticketMessageMetrics.lastOwnerMessageAt}
    )
  )`;

  const staleCondition = sql`(
    ${tickets.status} = 'OPEN'
    AND ${waitingStaffCondition}
    AND COALESCE(${ticketMessageMetrics.lastOwnerMessageAt}, ${tickets.createdAt}) <= NOW() - ${DASHBOARD_STALE_TICKET_THRESHOLD_HOURS} * INTERVAL '1 hour'
  )`;

  const ticketQueueState = db
    .$with('ticket_queue_state')
    .as(
      db
        .select({
          ticketId: tickets.id,
          messageCount: sql<number>`COALESCE(${ticketMessageMetrics.messageCount}, 0)`.as('message_count'),
          lastMessageAt: sql<Date | null>`${ticketMessageMetrics.lastMessageAt}`.as('last_message_at'),
          lastStaffReplyAt: sql<Date | null>`${ticketMessageMetrics.lastStaffReplyAt}`.as('last_staff_reply_at'),
          lastOwnerMessageAt: sql<Date | null>`${ticketMessageMetrics.lastOwnerMessageAt}`.as('last_owner_message_at'),
          waitingOn: sql<TicketWaitingOn>`CASE
            WHEN ${waitingStaffCondition} THEN 'staff'
            WHEN ${waitingUserCondition} THEN 'user'
            ELSE 'none'
          END`.as('waiting_on'),
          isStale: sql<boolean>`CASE
            WHEN ${staleCondition} THEN true
            ELSE false
          END`.as('is_stale'),
          queueState: sql<TicketQueueState>`CASE
            WHEN ${staleCondition} THEN 'stale'
            WHEN ${tickets.status} = 'OPEN' AND ${waitingStaffCondition} THEN 'waiting_staff'
            WHEN ${tickets.status} = 'OPEN' AND ${waitingUserCondition} THEN 'waiting_user'
            ELSE 'recent'
          END`.as('queue_state'),
        })
        .from(tickets)
        .leftJoin(ticketMessageMetrics, eq(ticketMessageMetrics.ticketId, tickets.id))
    );

  return {
    ticketStaffAuthors,
    ticketMessageMetrics,
    ticketQueueState,
  };
}

function buildTicketListConditions(params: TicketListParams, ticketQueueState: ReturnType<typeof buildTicketQueueCtes>['ticketQueueState']) {
  const { status, authorId, panelIds, search, queue, ownedByUserId } = params;
  const conditions: SQL[] = [];

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

  if (queue) {
    conditions.push(eq(ticketQueueState.queueState, queue));
  }

  if (ownedByUserId) {
    conditions.push(sql`EXISTS (
      SELECT 1
      FROM ${messages}
      WHERE ${messages.channelId} = ${tickets.channelId}
      AND ${messages.isDeleted} = false
      AND ${messages.authorId} = ${ownedByUserId}
    )`);
  }

  return conditions;
}

function buildOverdueCheckInCondition() {
  return sql`EXISTS (
    SELECT 1 FROM ${revertCheckIns}
    WHERE ${revertCheckIns.userId} = ${users.discordId}
    GROUP BY ${revertCheckIns.userId}
    HAVING MAX(${revertCheckIns.checkedInAt}) <= NOW() - ${CHECK_IN_OVERDUE_DAYS} * INTERVAL '1 day'
  )`;
}

async function getPhaseOneAssignmentUser(userId: bigint) {
  const result = await db
    .select({
      discordId: users.discordId,
      relationToIslam: users.relationToIslam,
    })
    .from(users)
    .where(eq(users.discordId, userId))
    .limit(1);

  const targetUser = result[0];

  if (!targetUser) {
    throw new AssignmentMutationError('User not found', 404, 'USER_NOT_FOUND');
  }

  if (!isRevertLikeRelation(targetUser.relationToIslam)) {
    throw new AssignmentMutationError(
      'Phase 1 supervision actions are only available for revert-like users',
      403,
      'NOT_REVERT_LIKE'
    );
  }

  return targetUser;
}

async function getCurrentActiveAssignmentStatus(userId: bigint) {
  const result = await db
    .select({
      id: assignmentStatuses.id,
      status: assignmentStatuses.status,
      reason: assignmentStatuses.reason,
      priority: assignmentStatuses.priority,
      notes: assignmentStatuses.notes,
      reachoutLogId: assignmentStatuses.reachoutLogId,
      createdAt: assignmentStatuses.createdAt,
    })
    .from(assignmentStatuses)
    .where(and(
      eq(assignmentStatuses.userId, userId),
      eq(assignmentStatuses.active, true)
    ))
    .orderBy(desc(assignmentStatuses.createdAt))
    .limit(1);

  return result[0] ?? null;
}

async function buildAssignmentMutationResult(userId: bigint) {
  const [primarySupervisor, currentAssignmentStatus] = await Promise.all([
    getPrimaryActiveSupervisor(userId),
    getCurrentActiveAssignmentStatus(userId),
  ]);

  return {
    primarySupervisor,
    assignmentStatus: currentAssignmentStatus?.status ?? null,
    assignmentReason: currentAssignmentStatus?.reason ?? null,
  };
}

function normalizeTagCategory(category?: string | null) {
  const normalized = category?.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  if (!REVERT_TAG_CATEGORY_VALUES.includes(normalized as RevertTagCategoryValue)) {
    throw new Error(`Invalid tag category: ${category}`);
  }

  return normalized as RevertTagCategoryValue;
}

async function ensureSeededSystemRevertTags() {
  await db
    .insert(revertTags)
    .values(
      SYSTEM_REVERT_TAGS.map((tag) => ({
        name: tag.name,
        slug: tag.slug,
        kind: 'system' as const,
        description: tag.description,
        color: tag.color,
        emoji: tag.emoji,
        category: tag.category,
        createdById: SYSTEM_REVERT_TAG_SEED_ACTOR_ID,
      }))
    )
    .onConflictDoNothing({ target: revertTags.slug });
}

async function getRevertTagById(tagId: number) {
  const result = await db
    .select()
    .from(revertTags)
    .where(eq(revertTags.id, tagId))
    .limit(1);

  return result[0] ?? null;
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
  queue?: TicketQueue;
  ownedByUserId?: bigint;
  limit?: number;
  offset?: number;
  search?: string;
  sortBy?: 'newest' | 'oldest' | 'messages' | 'fewestMessages' | 'sequence' | 'createdAt' | 'messageCount' | 'oldestActivity';
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
    limit = 50,
    offset = 0,
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = params;

  const { ticketStaffAuthors, ticketMessageMetrics, ticketQueueState } = buildTicketQueueCtes();
  const conditions = buildTicketListConditions(params, ticketQueueState);

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

    if (sortBy === 'oldestActivity') {
      return { sortBy: 'oldestActivity' as const, sortOrder: 'asc' as const };
    }

    return {
      sortBy: (sortBy === 'sequence' || sortBy === 'messageCount' || sortBy === 'createdAt' ? sortBy : 'createdAt') as 'sequence' | 'messageCount' | 'createdAt',
      sortOrder,
    };
  })();

  let orderByClause;
  if (normalizedSort.sortBy === 'oldestActivity') {
    orderByClause = sql`COALESCE(${ticketQueueState.lastOwnerMessageAt}, ${tickets.createdAt}) ASC`;
  } else if (normalizedSort.sortBy === 'sequence') {
    orderByClause = normalizedSort.sortOrder === 'asc'
      ? sql`COALESCE(${tickets.sequence}, ${tickets.id}) ASC`
      : sql`COALESCE(${tickets.sequence}, ${tickets.id}) DESC`;
  } else if (normalizedSort.sortBy === 'messageCount') {
    orderByClause = normalizedSort.sortOrder === 'asc'
      ? sql`COALESCE(${ticketQueueState.messageCount}, 0) ASC`
      : sql`COALESCE(${ticketQueueState.messageCount}, 0) DESC`;
  } else {
    orderByClause = normalizedSort.sortOrder === 'asc'
      ? asc(tickets.createdAt)
      : desc(tickets.createdAt);
  }

  const results = await db
    .with(ticketStaffAuthors, ticketMessageMetrics, ticketQueueState)
    .select({
      ticket: tickets,
      author: users,
      channel: channels,
      panel: panels,
      messageCount: sql<number>`COALESCE(${ticketQueueState.messageCount}, 0)`,
      lastMessageAt: ticketQueueState.lastMessageAt,
      lastStaffReplyAt: ticketQueueState.lastStaffReplyAt,
      lastOwnerMessageAt: ticketQueueState.lastOwnerMessageAt,
      waitingOn: ticketQueueState.waitingOn,
      isStale: ticketQueueState.isStale,
      queueState: ticketQueueState.queueState,
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
    .leftJoin(ticketQueueState, eq(tickets.id, ticketQueueState.ticketId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(orderByClause)
    .limit(limit)
    .offset(offset);

  return results;
}

export async function getTicketCount(params: TicketListParams = {}) {
  const { ticketStaffAuthors, ticketMessageMetrics, ticketQueueState } = buildTicketQueueCtes();
  const conditions = buildTicketListConditions(params, ticketQueueState);

  const result = await db
    .with(ticketStaffAuthors, ticketMessageMetrics, ticketQueueState)
    .select({ count: sql<number>`count(*)::int` })
    .from(tickets)
    .leftJoin(users, eq(tickets.authorId, users.discordId))
    .leftJoin(ticketQueueState, eq(tickets.id, ticketQueueState.ticketId))
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
  assignmentStatus?: AssignmentStatusValue;
  relationToIslam?: string;
  inGuild?: boolean;
  verified?: boolean;
  voiceVerified?: boolean;
  roleId?: bigint;
  assignedStaffId?: bigint;
  tagId?: number;
  needsAssignment?: boolean;
  overdueCheckIn?: boolean;
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
    assignedStaffId,
    tagId,
    needsAssignment,
    overdueCheckIn,
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

  if (tagId !== undefined) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM ${revertTagAssignments}
        WHERE ${revertTagAssignments.userId} = ${users.discordId}
        AND ${revertTagAssignments.tagId} = ${tagId}
        AND ${revertTagAssignments.removedAt} IS NULL
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

  if (assignedStaffId) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM ${userSupervisors}
        WHERE ${userSupervisors.userId} = ${users.discordId}
        AND ${userSupervisors.supervisorId} = ${assignedStaffId}
        AND ${userSupervisors.active} = true
      )`
    );
  }

  if (needsAssignment !== undefined) {
    const needsAssignmentCondition = buildNeedsAssignmentCondition();
    conditions.push(
      needsAssignment
        ? needsAssignmentCondition
        : sql`NOT ${needsAssignmentCondition}`
    );
  }

  if (overdueCheckIn !== undefined) {
    const overdueCheckInCondition = buildOverdueCheckInCondition();
    conditions.push(
      overdueCheckIn
        ? overdueCheckInCondition
        : sql`NOT ${overdueCheckInCondition}`
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
      currentAssignmentReason: assignmentStatuses.reason,
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
    .as('active_user_tags');

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
      currentAssignmentReason: currentAssignmentStatuses.currentAssignmentReason,
      activeSupervisorCount: sql<number>`COALESCE(${activeSupervisorCounts.activeSupervisorCount}, 0)`,
      supervisorName: latestActiveSupervisors.supervisorName,
      supervisorDisplayName: latestActiveSupervisors.supervisorDisplayName,
      supervisorAvatar: latestActiveSupervisors.supervisorAvatar,
      activeInfractionCount: sql<number>`COALESCE(${activeInfractionCounts.activeInfractionCount}, 0)`,
      lastCheckInAt: lastCheckIns.lastCheckInAt,
      activeTags: activeUserTags.activeTags,
      needsAssignment: sql<boolean>`
        CASE
          WHEN COALESCE(${activeSupervisorCounts.activeSupervisorCount}, 0) = 0
            AND ${buildRevertLikeUserCondition()}
            AND ${currentAssignmentStatuses.currentAssignmentStatus} IN (${buildSupportRelevantAssignmentStatusList()})
          THEN true
          ELSE false
        END
      `,
      isOverdueCheckIn: sql<boolean>`
        CASE
          WHEN ${lastCheckIns.lastCheckInAt} IS NULL THEN false
          WHEN ${lastCheckIns.lastCheckInAt} <= NOW() - ${CHECK_IN_OVERDUE_DAYS} * INTERVAL '1 day' THEN true
          ELSE false
        END
      `,
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
    .leftJoin(activeInfractionCounts, eq(activeInfractionCounts.userId, users.discordId))
    .leftJoin(lastCheckIns, eq(lastCheckIns.userId, users.discordId))
    .leftJoin(activeUserTags, eq(activeUserTags.userId, users.discordId))
    .leftJoin(openTicketCounts, eq(openTicketCounts.userId, users.discordId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(orderByClause)
    .limit(limit)
    .offset(offset);

  return results.map(r => ({
    ...r,
    activeTags: r.activeTags || [],
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

export async function getPrimaryActiveSupervisor(userId: bigint) {
  const result = await db
    .select({
      id: userSupervisors.id,
      userId: userSupervisors.userId,
      supervisorId: userSupervisors.supervisorId,
      active: userSupervisors.active,
      createdAt: userSupervisors.createdAt,
      supervisorName: users.name,
      supervisorDisplayName: users.displayName,
      supervisorAvatar: users.displayAvatar,
    })
    .from(userSupervisors)
    .leftJoin(users, eq(userSupervisors.supervisorId, users.discordId))
    .where(and(
      eq(userSupervisors.userId, userId),
      eq(userSupervisors.active, true)
    ))
    .orderBy(desc(userSupervisors.createdAt))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Get assignment status history for a user
 */
export async function getUserAssignmentHistory(userId: bigint) {
  return db
    .select({
      id: assignmentStatuses.id,
      status: assignmentStatuses.status,
      reason: assignmentStatuses.reason,
      priority: assignmentStatuses.priority,
      notes: assignmentStatuses.notes,
      active: assignmentStatuses.active,
      createdAt: assignmentStatuses.createdAt,
      resolvedAt: assignmentStatuses.resolvedAt,
      addedById: assignmentStatuses.addedById,
      addedByName: sql<string | null>`(
        SELECT name FROM "User" WHERE discord_id = ${assignmentStatuses.addedById}
      )`,
      addedByDisplayName: sql<string | null>`(
        SELECT display_name FROM "User" WHERE discord_id = ${assignmentStatuses.addedById}
      )`,
      addedByAvatar: sql<string | null>`(
        SELECT display_avatar FROM "User" WHERE discord_id = ${assignmentStatuses.addedById}
      )`,
      resolvedById: assignmentStatuses.resolvedById,
      resolvedByName: sql<string | null>`(
        SELECT name FROM "User" WHERE discord_id = ${assignmentStatuses.resolvedById}
      )`,
      resolvedByDisplayName: sql<string | null>`(
        SELECT display_name FROM "User" WHERE discord_id = ${assignmentStatuses.resolvedById}
      )`,
      resolvedByAvatar: sql<string | null>`(
        SELECT display_avatar FROM "User" WHERE discord_id = ${assignmentStatuses.resolvedById}
      )`,
    })
    .from(assignmentStatuses)
    .where(eq(assignmentStatuses.userId, userId))
    .orderBy(desc(assignmentStatuses.createdAt));
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
      supervisorAvatar: sql<string | null>`(
        SELECT display_avatar FROM "User" WHERE discord_id = ${userSupervisorEntries.supervisorId}
      )`,
    })
    .from(userSupervisorEntries)
    .where(eq(userSupervisorEntries.userId, userId))
    .orderBy(desc(userSupervisorEntries.createdAt));
}

export async function createUserSupervisorEntry(data: {
  userId: bigint;
  supervisorId: bigint;
  note: string;
}) {
  const result = await db
    .insert(userSupervisorEntries)
    .values({
      userId: data.userId,
      supervisorId: data.supervisorId,
      note: data.note,
    })
    .returning();

  return result[0];
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
      needsSupport: superviseesData.filter(s => s.currentAssignmentStatus === 'OPEN').length,
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
  await ensureSeededSystemRevertTags();

  return db
    .select()
    .from(revertTags)
    .where(eq(revertTags.isArchived, false))
    .orderBy(asc(revertTags.kind), asc(revertTags.category), asc(revertTags.name));
}

/**
 * Get all tags including archived (for admin page)
 */
export async function getAllRevertTags() {
  await ensureSeededSystemRevertTags();

  return db
    .select({
      tag: revertTags,
      activeCount: sql<number>`(
        SELECT COUNT(*)::int FROM revert_tag_assignment
        WHERE tag_id = ${revertTags.id} AND removed_at IS NULL
      )`,
    })
    .from(revertTags)
    .orderBy(asc(revertTags.kind), asc(revertTags.category), asc(revertTags.name));
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
  const slug = slugifyRevertTagName(data.name);
  if (!slug) {
    throw new Error('Tag name must contain at least one letter or number');
  }

  const category = normalizeTagCategory(data.category);

  const result = await db
    .insert(revertTags)
    .values({
      name: data.name,
      slug,
      kind: 'custom',
      description: data.description || null,
      color: data.color,
      emoji: data.emoji || null,
      category,
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
  const currentTag = await getRevertTagById(tagId);

  if (!currentTag) {
    return null;
  }

  if (currentTag.kind === 'system') {
    throw new Error('System tags cannot be edited');
  }

  const name = data.name?.trim();
  const category = data.category === undefined ? undefined : normalizeTagCategory(data.category);

  const result = await db
    .update(revertTags)
    .set({
      name,
      slug: name ? slugifyRevertTagName(name) : undefined,
      description: data.description,
      color: data.color,
      emoji: data.emoji,
      category,
    })
    .where(eq(revertTags.id, tagId))
    .returning();

  return result[0];
}

/**
 * Archive a tag (soft-delete)
 */
export async function archiveRevertTag(tagId: number) {
  const currentTag = await getRevertTagById(tagId);

  if (!currentTag) {
    return null;
  }

  if (currentTag.kind === 'system') {
    throw new Error('System tags cannot be archived');
  }

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
      tagSlug: revertTags.slug,
      tagKind: revertTags.kind,
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
  await ensureSeededSystemRevertTags();

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

export async function claimUserAssignment(userId: bigint, actorDiscordId: bigint) {
  await getPhaseOneAssignmentUser(userId);

  await db.transaction(async (tx) => {
    const [activeSupervisor] = await Promise.all([
      tx
        .select({ id: userSupervisors.id })
        .from(userSupervisors)
        .where(and(
          eq(userSupervisors.userId, userId),
          eq(userSupervisors.active, true)
        ))
        .limit(1),
    ]);

    if (activeSupervisor[0]) {
      throw new AssignmentMutationError('User already has an active supervisor', 409, 'ALREADY_ASSIGNED');
    }

    await tx
      .insert(userSupervisors)
      .values({
        userId,
        supervisorId: actorDiscordId,
        active: true,
      });
  });

  return buildAssignmentMutationResult(userId);
}

export async function assignUserToSupervisor(
  userId: bigint,
  supervisorId: bigint,
  actorDiscordId: bigint,
  note?: string
) {
  await getPhaseOneAssignmentUser(userId);

  await db.transaction(async (tx) => {
    const trimmedNote = note?.trim();
    const [activeSupervisor, currentAssignmentStatus] = await Promise.all([
      tx
        .select({ id: userSupervisors.id })
        .from(userSupervisors)
        .where(and(
          eq(userSupervisors.userId, userId),
          eq(userSupervisors.active, true)
        ))
        .limit(1),
      tx
        .select({
          id: assignmentStatuses.id,
          reachoutLogId: assignmentStatuses.reachoutLogId,
          status: assignmentStatuses.status,
          reason: assignmentStatuses.reason,
          priority: assignmentStatuses.priority,
        })
        .from(assignmentStatuses)
        .where(and(
          eq(assignmentStatuses.userId, userId),
          eq(assignmentStatuses.active, true)
        ))
        .orderBy(desc(assignmentStatuses.createdAt))
        .limit(1),
    ]);

    if (activeSupervisor[0]) {
      throw new AssignmentMutationError(
        'User already has an active supervisor; use transfer instead',
        409,
        'ALREADY_ASSIGNED'
      );
    }

    await tx
      .insert(userSupervisors)
      .values({
        userId,
        supervisorId,
        active: true,
      });

    if (trimmedNote && currentAssignmentStatus[0]) {
      const currentStatus = currentAssignmentStatus[0];

      await tx
        .update(assignmentStatuses)
        .set({
          active: false,
          resolvedAt: new Date(),
          resolvedById: actorDiscordId,
        })
        .where(and(
          eq(assignmentStatuses.userId, userId),
          eq(assignmentStatuses.active, true)
        ));

      await tx
        .insert(assignmentStatuses)
        .values({
          userId,
          reachoutLogId: currentStatus.reachoutLogId,
          addedById: actorDiscordId,
          status: currentStatus.status,
          reason: currentStatus.reason,
          priority: currentStatus.priority,
          notes: trimmedNote,
          active: true,
        });
    }
  });

  return buildAssignmentMutationResult(userId);
}

export async function transferUserAssignment(
  userId: bigint,
  supervisorId: bigint,
  actorDiscordId: bigint,
  note?: string
) {
  await getPhaseOneAssignmentUser(userId);

  await db.transaction(async (tx) => {
    const trimmedNote = note?.trim();
    const [activeSupervisors, currentAssignmentStatus] = await Promise.all([
      tx
        .select({
          id: userSupervisors.id,
          supervisorId: userSupervisors.supervisorId,
        })
        .from(userSupervisors)
        .where(and(
          eq(userSupervisors.userId, userId),
          eq(userSupervisors.active, true)
        )),
      tx
        .select({
          id: assignmentStatuses.id,
          reachoutLogId: assignmentStatuses.reachoutLogId,
          status: assignmentStatuses.status,
          reason: assignmentStatuses.reason,
          priority: assignmentStatuses.priority,
        })
        .from(assignmentStatuses)
        .where(and(
          eq(assignmentStatuses.userId, userId),
          eq(assignmentStatuses.active, true)
        ))
        .orderBy(desc(assignmentStatuses.createdAt))
        .limit(1),
    ]);

    if (activeSupervisors.length === 0) {
      throw new AssignmentMutationError(
        'User does not have an active supervisor; use assign instead',
        409,
        'NOT_ASSIGNED'
      );
    }

    const alreadyPrimary = activeSupervisors.length === 1 && activeSupervisors[0].supervisorId === supervisorId;

    if (!alreadyPrimary || activeSupervisors.length > 1) {
      await tx
        .update(userSupervisors)
        .set({ active: false })
        .where(and(
          eq(userSupervisors.userId, userId),
          eq(userSupervisors.active, true)
        ));

      await tx
        .insert(userSupervisors)
        .values({
          userId,
          supervisorId,
          active: true,
        });
    }

    if (trimmedNote && currentAssignmentStatus[0]) {
      const currentStatus = currentAssignmentStatus[0];

      await tx
        .update(assignmentStatuses)
        .set({
          active: false,
          resolvedAt: new Date(),
          resolvedById: actorDiscordId,
        })
        .where(and(
          eq(assignmentStatuses.userId, userId),
          eq(assignmentStatuses.active, true)
        ));

      await tx
        .insert(assignmentStatuses)
        .values({
          userId,
          reachoutLogId: currentStatus.reachoutLogId,
          addedById: actorDiscordId,
          status: currentStatus.status,
          reason: currentStatus.reason,
          priority: currentStatus.priority,
          notes: trimmedNote,
          active: true,
        });
    }
  });

  return buildAssignmentMutationResult(userId);
}

export async function unassignUser(
  userId: bigint,
  actorDiscordId: bigint,
  nextStatus: AssignmentStatusValue,
  reason?: SupportStateReasonValue,
  note?: string
) {
  await getPhaseOneAssignmentUser(userId);

  await db.transaction(async (tx) => {
    const trimmedNote = note?.trim();
    const [activeSupervisor, currentAssignmentStatus] = await Promise.all([
      tx
        .select({ id: userSupervisors.id })
        .from(userSupervisors)
        .where(and(
          eq(userSupervisors.userId, userId),
          eq(userSupervisors.active, true)
        ))
        .limit(1),
      tx
        .select({
          id: assignmentStatuses.id,
          reachoutLogId: assignmentStatuses.reachoutLogId,
          status: assignmentStatuses.status,
          reason: assignmentStatuses.reason,
          priority: assignmentStatuses.priority,
        })
        .from(assignmentStatuses)
        .where(and(
          eq(assignmentStatuses.userId, userId),
          eq(assignmentStatuses.active, true)
        ))
        .orderBy(desc(assignmentStatuses.createdAt))
        .limit(1),
    ]);

    if (!activeSupervisor[0]) {
      throw new AssignmentMutationError('User does not have an active supervisor', 409, 'NOT_ASSIGNED');
    }

    await tx
      .update(userSupervisors)
      .set({ active: false })
      .where(and(
        eq(userSupervisors.userId, userId),
        eq(userSupervisors.active, true)
      ));

    const currentStatus = currentAssignmentStatus[0];

    if (currentStatus) {
      const shouldWriteNewStatus = currentStatus.status !== nextStatus || currentStatus.reason !== (reason ?? null) || Boolean(trimmedNote);

      if (shouldWriteNewStatus) {
        await tx
          .update(assignmentStatuses)
          .set({
            active: false,
            resolvedAt: new Date(),
            resolvedById: actorDiscordId,
          })
          .where(and(
            eq(assignmentStatuses.userId, userId),
            eq(assignmentStatuses.active, true)
          ));

        await tx
          .insert(assignmentStatuses)
          .values({
            userId,
            reachoutLogId: currentStatus.reachoutLogId,
            addedById: actorDiscordId,
            status: nextStatus,
            reason: reason ?? null,
            priority: currentStatus.priority,
            notes: trimmedNote ?? null,
            active: true,
          });
      }

      return;
    }

    await tx
      .insert(assignmentStatuses)
      .values({
        userId,
        addedById: actorDiscordId,
        status: nextStatus,
        reason: reason ?? null,
        priority: 0,
        notes: trimmedNote ?? null,
        active: true,
      });
  });

  return buildAssignmentMutationResult(userId);
}

export async function updateUserSupportState(
  userId: bigint,
  actorDiscordId: bigint,
  nextState: AssignmentStatusValue,
  reason?: SupportStateReasonValue,
) {
  await getPhaseOneAssignmentUser(userId);

  if (reason && !SUPPORT_STATE_REASONS_BY_STATE[nextState].includes(reason)) {
    throw new AssignmentMutationError('Reason is not valid for the selected support state', 400, 'INVALID_REASON');
  }

  await db.transaction(async (tx) => {
    const currentStatus = await tx
      .select({
        id: assignmentStatuses.id,
        reachoutLogId: assignmentStatuses.reachoutLogId,
        status: assignmentStatuses.status,
        reason: assignmentStatuses.reason,
        priority: assignmentStatuses.priority,
        notes: assignmentStatuses.notes,
      })
      .from(assignmentStatuses)
      .where(and(
        eq(assignmentStatuses.userId, userId),
        eq(assignmentStatuses.active, true)
      ))
      .orderBy(desc(assignmentStatuses.createdAt))
      .limit(1);

    const current = currentStatus[0];

    if (current && current.status === nextState && current.reason === (reason ?? null)) {
      return;
    }

    if (current) {
      await tx
        .update(assignmentStatuses)
        .set({
          active: false,
          resolvedAt: new Date(),
          resolvedById: actorDiscordId,
        })
        .where(and(
          eq(assignmentStatuses.userId, userId),
          eq(assignmentStatuses.active, true)
        ));
    }

    await tx
      .insert(assignmentStatuses)
      .values({
        userId,
        reachoutLogId: current?.reachoutLogId ?? null,
        addedById: actorDiscordId,
        status: nextState,
        reason: reason ?? null,
        priority: current?.priority ?? 0,
        notes: current?.notes ?? null,
        active: true,
      });
  });
}

// ============================================================================
// DASHBOARD QUERIES
// ============================================================================

async function getDashboardStaleTicketCount() {
  const { ticketStaffAuthors, ticketMessageMetrics, ticketQueueState } = buildTicketQueueCtes();

  const result = await db
    .with(ticketStaffAuthors, ticketMessageMetrics, ticketQueueState)
    .select({
      count: sql<number>`COUNT(*) FILTER (WHERE ${ticketQueueState.queueState} = 'stale')::int`.as('count'),
    })
    .from(ticketQueueState);

  return result[0]?.count ?? 0;
}

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
      currentAssignmentStatusCreatedAt: assignmentStatuses.createdAt,
    })
    .from(assignmentStatuses)
    .where(eq(assignmentStatuses.active, true))
    .orderBy(assignmentStatuses.userId, desc(assignmentStatuses.createdAt))
    .as('dashboard_current_assignment_statuses');

  const userLastCheckIns = db
    .select({
      userId: revertCheckIns.userId,
      lastCheckIn: sql<Date | null>`MAX(${revertCheckIns.checkedInAt})`.as('lastCheckIn'),
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

  const openCheckInTickets = db
    .select({
      authorId: tickets.authorId,
      ticketId: sql<number>`MAX(${tickets.id})::int`.as('ticketId'),
    })
    .from(tickets)
    .where(and(
      eq(tickets.status, 'OPEN'),
      eq(tickets.panelId, CHECK_IN_PANEL_ID),
    ))
    .groupBy(tickets.authorId)
    .as('dashboard_open_check_in_tickets');

  const claimableReverts = await db
    .select({
      userId: users.discordId,
      userName: users.name,
      userDisplayName: users.displayName,
      userAvatar: users.displayAvatar,
      inGuild: users.inGuild,
      currentAssignmentStatus: currentAssignmentStatuses.currentAssignmentStatus,
      lastCheckIn: userLastCheckIns.lastCheckIn,
      activeTags: activeUserTags.activeTags,
      currentAssignmentStatusCreatedAt: currentAssignmentStatuses.currentAssignmentStatusCreatedAt,
    })
    .from(users)
    .leftJoin(currentAssignmentStatuses, eq(currentAssignmentStatuses.userId, users.discordId))
    .leftJoin(userLastCheckIns, eq(userLastCheckIns.userId, users.discordId))
    .leftJoin(activeUserTags, eq(activeUserTags.userId, users.discordId))
    .leftJoin(activeAssigneeCounts, eq(activeAssigneeCounts.userId, users.discordId))
    .where(and(
      buildRevertLikeUserCondition(),
      sql`COALESCE(${activeAssigneeCounts.activeAssigneeCount}, 0) = 0`,
      eq(currentAssignmentStatuses.currentAssignmentStatus, 'OPEN')
    ))
    .orderBy(
      asc(sql<number>`CASE WHEN ${userLastCheckIns.lastCheckIn} IS NULL THEN 0 ELSE 1 END`),
      asc(userLastCheckIns.lastCheckIn),
      asc(currentAssignmentStatuses.currentAssignmentStatusCreatedAt),
      asc(users.displayName)
    );

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
      openCheckInTicketId: openCheckInTickets.ticketId,
    })
    .from(userSupervisors)
    .innerJoin(users, eq(userSupervisors.userId, users.discordId))
    .leftJoin(currentAssignmentStatuses, eq(currentAssignmentStatuses.userId, users.discordId))
    .leftJoin(userLastCheckIns, eq(userLastCheckIns.userId, users.discordId))
    .leftJoin(activeUserTags, eq(activeUserTags.userId, users.discordId))
    .leftJoin(openCheckInTickets, eq(openCheckInTickets.authorId, users.discordId))
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

  const staleTicketCount = await getDashboardStaleTicketCount();

  // Stale ticket list — same definition as the count query, but returning rows for dashboard display
  const { ticketStaffAuthors: staleAuthors, ticketMessageMetrics: staleMetrics, ticketQueueState: staleQueueState } = buildTicketQueueCtes();
  const staleTicketsList = await db
    .with(staleAuthors, staleMetrics, staleQueueState)
    .select({
      ticketId: tickets.id,
      ticketSequence: tickets.sequence,
      ticketStatus: tickets.status,
      ticketCreatedAt: tickets.createdAt,
      authorId: tickets.authorId,
      authorName: sql<string | null>`COALESCE(${dashboardTicketAuthors.displayName}, ${dashboardTicketAuthors.name})`,
      authorAvatar: dashboardTicketAuthors.displayAvatar,
      lastStaffReplyAt: staleQueueState.lastStaffReplyAt,
      lastOwnerMessageAt: staleQueueState.lastOwnerMessageAt,
      lastMessageAt: staleQueueState.lastMessageAt,
    })
    .from(tickets)
    .innerJoin(staleQueueState, eq(staleQueueState.ticketId, tickets.id))
    .leftJoin(dashboardTicketAuthors, eq(tickets.authorId, dashboardTicketAuthors.discordId))
    .where(eq(staleQueueState.queueState, 'stale' as TicketQueueState))
    .orderBy(sql`COALESCE(${staleQueueState.lastOwnerMessageAt}, ${tickets.createdAt}) ASC`)
    .limit(10);

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
  const needsSupport = assignedReverts.filter(r => r.currentAssignmentStatus === 'OPEN').length;
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
    staleTicketCount,
    assignedReverts: assignedReverts.map(r => ({
      id: r.userId.toString(),
      name: r.userName,
      displayName: r.userDisplayName,
      displayAvatar: r.userAvatar,
      inGuild: r.inGuild,
      assignedAt: r.assignedAt.toISOString(),
      assignmentStatus: r.currentAssignmentStatus,
      lastCheckIn: toIsoString(r.lastCheckIn),
      activeTags: r.activeTags || [],
      openCheckInTicketId: r.openCheckInTicketId ?? null,
    })),
    claimableReverts: claimableReverts.map(r => ({
      id: r.userId.toString(),
      name: r.userName,
      displayName: r.userDisplayName,
      displayAvatar: r.userAvatar,
      inGuild: r.inGuild,
      assignmentStatus: r.currentAssignmentStatus,
      lastCheckIn: toIsoString(r.lastCheckIn),
      activeTags: r.activeTags || [],
    })),
    staleTickets: staleTicketsList.map(t => ({
      id: t.ticketId,
      sequence: t.ticketSequence,
      status: t.ticketStatus,
      createdAt: t.ticketCreatedAt.toISOString(),
      author: {
        id: t.authorId.toString(),
        name: t.authorName,
        avatar: t.authorAvatar,
      },
      lastStaffMessageAt: toIsoString(t.lastStaffReplyAt),
      lastOwnerMessageAt: toIsoString(t.lastOwnerMessageAt),
      lastMessageAt: toIsoString(t.lastMessageAt),
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
