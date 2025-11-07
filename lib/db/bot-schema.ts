import { pgTable, bigint, varchar, integer, boolean, timestamp, text, jsonb, index, pgEnum } from "drizzle-orm/pg-core";

/**
 * Bot Schema - Bot-owned tables (READ-ONLY)
 * 
 * These tables are managed by the bot's Prisma migrations.
 * The dashboard only READS from these tables.
 * 
 * IMPORTANT: 
 * - Only fields actually queried by the dashboard are defined here
 * - NO foreign key constraints (bot owns these tables)
 * - Array fields are nullable to handle actual data
 * - Do NOT use drizzle-kit to generate migrations for these tables
 */

// Enums used by bot tables
export const ticketStatusEnum = pgEnum("TicketStatus", ['OPEN', 'CLOSED', 'DELETED']);
export const infractionTypeEnum = pgEnum("InfractionType", ['NOTE', 'WARNING', 'TIMEOUT', 'KICK', 'BAN', 'JAIL', 'VOICE_MUTE', 'VOICE_BAN']);
export const infractionStatusEnum = pgEnum("InfractionStatus", ['ACTIVE', 'EXPIRED', 'PARDONED']);

// Bot Tables - Minimal definitions for read-only access

export const users = pgTable("User", {
  discordId: bigint("discord_id", { mode: "bigint" }).primaryKey(),
  name: varchar({ length: 255 }),
  displayName: varchar("display_name", { length: 255 }),
  displayAvatar: varchar("display_avatar", { length: 512 }),
  nick: varchar({ length: 255 }),
  inGuild: boolean("in_guild").default(true).notNull(),
  isVerified: boolean("is_verified").default(false).notNull(),
  isVoiceVerified: boolean("is_voice_verified").default(false).notNull(),
  // User profile fields
  relationToIslam: varchar("relation_to_islam", { length: 255 }),
  gender: varchar({ length: 50 }),
  age: varchar({ length: 50 }),
  region: varchar({ length: 255 }),
  religiousAffiliation: varchar("religious_affiliation", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Add other fields as needed when queries require them
});

export const messages = pgTable("Message", {
  messageId: bigint("message_id", { mode: "bigint" }).primaryKey(),
  categoryId: bigint("category_id", { mode: "bigint" }),
  content: text(),
  embeds: jsonb("embeds").array().$type<any[]>(),
  attachments: text("attachments").array(),
  memberMentions: bigint("member_mentions", { mode: "bigint" }).array(),
  channelMentions: bigint("channel_mentions", { mode: "bigint" }).array(),
  roleMentions: bigint("role_mentions", { mode: "bigint" }).array(),
  authorId: bigint("author_id", { mode: "bigint" }).notNull(),
  channelId: bigint("channel_id", { mode: "bigint" }).notNull(),
  isDeleted: boolean("is_deleted").default(false).notNull(),
  deletedAt: timestamp("deleted_at"),
  isDm: boolean("is_dm").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  authorIdx: index("message_author_idx").on(table.authorId),
  channelIdx: index("message_channel_idx").on(table.channelId),
  createdAtIdx: index("message_created_at_idx").on(table.createdAt),
}));

export const channels = pgTable("Channel", {
  channelId: bigint("channel_id", { mode: "bigint" }).primaryKey(),
  name: varchar({ length: 255 }).notNull(),
  categoryId: bigint("category_id", { mode: "bigint" }),
  position: integer().notNull(),
  isCategory: boolean("is_category").default(false).notNull(),
  isDm: boolean("is_dm").default(false).notNull(),
  deleted: boolean().default(false).notNull(),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  categoryIdx: index("channel_category_idx").on(table.categoryId),
}));

export const panels = pgTable("Panel", {
  id: integer("id").primaryKey(),
  title: varchar({ length: 255 }).notNull(),
  description: text(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tickets = pgTable("Ticket", {
  id: integer("id").primaryKey(),
  channelId: bigint("channel_id", { mode: "bigint" }),
  authorId: bigint("author_id", { mode: "bigint" }).notNull(),
  panelId: integer("panel_id").notNull(),
  status: ticketStatusEnum("status").default('OPEN'),
  transcriptMessageId: bigint("transcript_message_id", { mode: "bigint" }),
  ticketViewMessageId: bigint("ticket_view_message_id", { mode: "bigint" }),
  controlsViewMessageId: bigint("controls_view_message_id", { mode: "bigint" }),
  sequence: integer(),
  closedById: bigint("closed_by_id", { mode: "bigint" }),
  deletedById: bigint("deleted_by_id", { mode: "bigint" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  closedAt: timestamp("closed_at"),
  deletedAt: timestamp("deleted_at"),
  // AI summary fields
  summary: text(),
  summaryGeneratedAt: timestamp("summary_generated_at"),
  summaryModel: varchar("summary_model", { length: 100 }),
  summaryTokensUsed: integer("summary_tokens_used"),
}, (table) => ({
  channelIdx: index("ticket_channel_idx").on(table.channelId),
  authorStatusPanelIdx: index("ticket_author_status_panel_idx").on(table.authorId, table.status, table.panelId),
}));

export const roles = pgTable("Role", {
  roleId: bigint("role_id", { mode: "bigint" }).primaryKey(),
  name: varchar({ length: 255 }).notNull(),
  permissions: bigint("permissions", { mode: "bigint" }).notNull(),
  color: integer().notNull(),
  hoist: boolean().notNull(),
  managed: boolean().notNull(),
  mentionable: boolean().notNull(),
  position: integer().notNull(),
  deleted: boolean().default(false).notNull(),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userRoles = pgTable("UserRoles", {
  userId: bigint("user_id", { mode: "bigint" }).notNull(),
  roleId: bigint("role_id", { mode: "bigint" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  roleIdIdx: index("user_roles_role_id_idx").on(table.roleId),
}));

export const infractions = pgTable("Infraction", {
  id: integer("id").primaryKey(),
  userId: bigint("user_id", { mode: "bigint" }).notNull(),
  moderatorId: bigint("moderator_id", { mode: "bigint" }).notNull(),
  type: infractionTypeEnum("type").notNull(),
  status: infractionStatusEnum("status").default('ACTIVE').notNull(),
  reason: text(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  pardonedById: bigint("pardoned_by_id", { mode: "bigint" }),
  pardonedAt: timestamp("pardoned_at"),
  pardonReason: text("pardon_reason"),
  hidden: boolean().default(false).notNull(),
  jumpUrl: text("jump_url"),
}, (table) => ({
  userIdStatusIdx: index("Infraction_user_id_status_idx").on(table.userId, table.status),
  userIdTypeIdx: index("Infraction_user_id_type_idx").on(table.userId, table.type),
}));

export const infractionAppeals = pgTable("InfractionAppeal", {
  id: integer("id").primaryKey(),
  infractionId: integer("infraction_id").notNull(),
  appealText: text("appeal_text").notNull(),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  reviewedById: bigint("reviewed_by_id", { mode: "bigint" }),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  approved: boolean(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  infractionIdIdx: index("InfractionAppeal_infraction_id_idx").on(table.infractionId),
}));
