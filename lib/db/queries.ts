import { db } from './index';
import { messages, users, channels, tickets, userRoles, roles, panels } from './schema';
import { eq, and, like, inArray, sql, desc, asc, ilike, or, isNotNull } from 'drizzle-orm';

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
    // Fuzzy search using ILIKE (case-insensitive)
    conditions.push(ilike(messages.content, `%${query}%`));
    
    // For full-text search, you could use:
    // sql`to_tsvector('english', ${messages.content}) @@ plainto_tsquery('english', ${query})`
  }
  
  if (channelId) {
    conditions.push(eq(messages.channelId, channelId));
  }

  // Build base query with staff check
  let queryBuilder = db
    .select({
      message: messages,
      author: users,
      channel: channels,
      ticket: tickets,
      isStaff: staffRoleIds.length > 0
        ? sql<boolean>`EXISTS (
            SELECT 1 FROM ${userRoles} 
            WHERE ${userRoles.userId} = ${messages.authorId} 
            AND ${userRoles.roleId} = ANY(${sql.raw(`ARRAY[${staffRoleIds.join(',')}]::bigint[]`)})
          )`
        : sql<boolean>`false`,
    })
    .from(messages)
    .leftJoin(users, eq(messages.authorId, users.discordId))
    .leftJoin(channels, eq(messages.channelId, channels.channelId))
    .leftJoin(tickets, eq(channels.channelId, tickets.channelId));

  // Add staff filter at SQL level using EXISTS subquery
  if (staffOnly && staffRoleIds.length > 0) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM ${userRoles} 
        WHERE ${userRoles.userId} = ${messages.authorId} 
        AND ${userRoles.roleId} = ANY(${sql.raw(`ARRAY[${staffRoleIds.join(',')}]::bigint[]`)})
      )`
    );
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
    conditions.push(ilike(messages.content, `%${query}%`));
  }

  if (channelId) {
    conditions.push(eq(messages.channelId, channelId));
  }

  // Add staff filter at SQL level using EXISTS subquery
  if (staffOnly && staffRoleIds.length > 0) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM ${userRoles} 
        WHERE ${userRoles.userId} = ${messages.authorId} 
        AND ${userRoles.roleId} = ANY(${sql.raw(`ARRAY[${staffRoleIds.join(',')}]::bigint[]`)})
      )`
    );
  }

  // If ticketId filter is needed, join with channels and tickets
  if (ticketId !== undefined) {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .leftJoin(channels, eq(messages.channelId, channels.channelId))
      .leftJoin(tickets, eq(channels.channelId, tickets.channelId))
      .where(and(...conditions, eq(tickets.id, ticketId)));
    
    return result[0]?.count ?? 0;
  }

  // Otherwise, simple query without joins
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(messages)
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
  panelId?: number;
  limit?: number;
  offset?: number;
  search?: string;
  sortBy?: 'newest' | 'oldest' | 'messages';
};

export async function getTickets(params: TicketListParams = {}) {
  const {
    status,
    authorId,
    panelId,
    limit = 50,
    offset = 0,
    search,
    sortBy = 'newest',
  } = params;

  const conditions = [];

  if (status) {
    conditions.push(eq(tickets.status, status));
  }

  if (authorId) {
    conditions.push(eq(tickets.authorId, authorId));
  }

  if (panelId) {
    conditions.push(eq(tickets.panelId, panelId));
  }

  if (search) {
    // Search by sequence number or author name
    const searchNum = parseInt(search);
    if (!isNaN(searchNum)) {
      conditions.push(eq(tickets.sequence, searchNum));
    } else {
      conditions.push(
        or(
          ilike(users.name, `%${search}%`),
          ilike(users.displayName, `%${search}%`)
        )
      );
    }
  }

  // Determine the sort order
  let orderByClause;
  if (sortBy === 'oldest') {
    orderByClause = asc(tickets.createdAt);
  } else if (sortBy === 'messages') {
    // Sort by the message count from the CTE
    orderByClause = sql`COALESCE(message_counts.count, 0) DESC`;
  } else {
    // Default: newest
    orderByClause = desc(tickets.createdAt);
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

  const results = await db
    .with(messageCounts)
    .select({
      ticket: tickets,
      author: users,
      channel: channels,
      panel: panels,
      messageCount: sql<number>`COALESCE(${messageCounts.count}, 0)`,
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
  const { status, authorId, panelId, search } = params;
  
  const conditions = [];

  if (status) {
    conditions.push(eq(tickets.status, status));
  }

  if (authorId) {
    conditions.push(eq(tickets.authorId, authorId));
  }

  if (panelId) {
    conditions.push(eq(tickets.panelId, panelId));
  }

  if (search) {
    const searchNum = parseInt(search);
    if (!isNaN(searchNum)) {
      conditions.push(eq(tickets.sequence, searchNum));
    } else {
      conditions.push(
        or(
          ilike(users.name, `%${search}%`),
          ilike(users.displayName, `%${search}%`)
        )
      );
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
          extractMentionIds(embed.description || '');
          extractMentionIds(embed.title || '');
          if (embed.author?.name) extractMentionIds(embed.author.name);
          if (embed.footer?.text) extractMentionIds(embed.footer.text);
          if (embed.fields && Array.isArray(embed.fields)) {
            for (const field of embed.fields) {
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
    .where(and(
      eq(userRoles.userId, userId),
      eq(roles.deleted, false)
    ))
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
    closed: (stats?.closedCount || 0) + (stats?.deletedCount || 0),
  };
}
