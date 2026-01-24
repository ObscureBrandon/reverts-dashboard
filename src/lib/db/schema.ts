/**
 * Unified Database Schema
 * 
 * This file contains all Drizzle ORM table definitions:
 * - Auth tables (auth_*) - Dashboard-owned, Drizzle manages migrations
 * - Bot tables - Bot-owned via Prisma, dashboard has read/write access
 * 
 * Migration Strategy:
 * - Auth tables: Use drizzle-kit for migrations
 * - Bot tables: Managed by bot's Prisma migrations (reference only here)
 */

import { relations } from 'drizzle-orm';
import {
    bigint,
    boolean,
    foreignKey,
    index,
    integer,
    jsonb,
    pgEnum,
    pgTable,
    text,
    timestamp,
    unique,
    varchar
} from "drizzle-orm/pg-core";

// ============================================================================
// ENUMS
// ============================================================================

export const ticketStatusEnum = pgEnum("TicketStatus", ['OPEN', 'CLOSED', 'DELETED']);

export const assignmentStatusEnum = pgEnum("AssignmentStatusEnum", [
  'NEEDS_SUPPORT', 
  'INACTIVE', 
  'SELF_SUFFICIENT', 
  'PAUSED', 
  'NOT_READY'
]);

export const supervisionNeedEnum = pgEnum("SupervisionNeedEnum", [
  'PRAYER_HELP',
  'QURAN_LEARNING',
  'FAMILY_ISSUES',
  'NEW_CONVERT_QUESTIONS',
  'ARABIC_LEARNING',
  'ISLAMIC_HISTORY',
  'COMMUNITY_INTEGRATION',
  'SPIRITUAL_GUIDANCE'
]);

export const infractionTypeEnum = pgEnum("InfractionType", [
  'NOTE', 
  'WARNING', 
  'TIMEOUT', 
  'KICK', 
  'BAN', 
  'JAIL', 
  'VOICE_MUTE', 
  'VOICE_BAN'
]);

export const infractionStatusEnum = pgEnum("InfractionStatus", [
  'ACTIVE', 
  'EXPIRED', 
  'PARDONED',
  'APPEALED',
  'APPEAL_APPROVED',
  'APPEAL_DENIED'
]);

// ============================================================================
// AUTH TABLES (Dashboard-owned, Drizzle migrations)
// ============================================================================

export const authUser = pgTable("auth_user", {
  id: text().primaryKey().notNull(),
  email: text().notNull(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  name: text().notNull(),
  image: text(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  unique("auth_user_email_unique").on(table.email),
]);

export const authAccount = pgTable("auth_account", {
  id: text().primaryKey().notNull(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text(),
  password: text(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.userId],
    foreignColumns: [authUser.id],
    name: "auth_account_user_id_auth_user_id_fk"
  }),
]);

export const authSession = pgTable("auth_session", {
  id: text().primaryKey().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull(),
}, (table) => [
  foreignKey({
    columns: [table.userId],
    foreignColumns: [authUser.id],
    name: "auth_session_user_id_auth_user_id_fk"
  }),
  unique("auth_session_token_unique").on(table.token),
]);

export const authVerification = pgTable("auth_verification", {
  id: text().primaryKey().notNull(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================================
// BOT TABLES (Bot-owned via Prisma, dashboard has read/write access)
// ============================================================================

// --- Core User & Role Tables ---

export const users = pgTable("User", {
  discordId: bigint("discord_id", { mode: "bigint" }).primaryKey(),
  name: varchar({ length: 255 }),
  displayName: varchar("display_name", { length: 255 }),
  displayAvatar: varchar("display_avatar", { length: 512 }),
  displayAvatarKey: varchar("display_avatar_key", { length: 255 }),
  nick: varchar({ length: 255 }),
  inGuild: boolean("in_guild").default(true).notNull(),
  isVerified: boolean("is_verified").default(false).notNull(),
  isVoiceVerified: boolean("is_voice_verified").default(false).notNull(),
  verifiedBy: bigint("verified_by", { mode: "bigint" }),
  voiceVerifiedBy: bigint("voice_verified_by", { mode: "bigint" }),
  // User profile fields
  relationToIslam: varchar("relation_to_islam", { length: 255 }),
  gender: varchar({ length: 50 }),
  age: varchar({ length: 50 }),
  referralSource: varchar("referral_source", { length: 255 }),
  region: varchar({ length: 255 }),
  religiousAffiliation: varchar("religious_affiliation", { length: 255 }),
  wantsDiscussion: varchar("wants_discussion", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
  userRoleIdx: index("user_roles_user_role_idx").on(table.userId, table.roleId),
}));

// --- Channel & Message Tables ---

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

// --- Ticket System Tables ---

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
  summaryGeneratedAtIdx: index("ticket_summary_generated_at_idx").on(table.summaryGeneratedAt),
  authorCreatedAtIdx: index("ticket_author_created_at_idx").on(table.authorId, table.createdAt),
}));

// --- Shahada & Revert Support Tables ---

export const shahadas = pgTable("Shahada", {
  id: integer("id").primaryKey(),
  userId: bigint("user_id", { mode: "bigint" }).notNull(),
  supervisorId: bigint("supervisor_id", { mode: "bigint" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const revertUserInfo = pgTable("RevertUserInfo", {
  discordId: bigint("discord_id", { mode: "bigint" }).primaryKey(),
  support: boolean().notNull(),
  prayer: boolean().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userSupervisors = pgTable("UserSupervisor", {
  id: integer("id").primaryKey(),
  userId: bigint("user_id", { mode: "bigint" }).notNull(),
  supervisorId: bigint("supervisor_id", { mode: "bigint" }).notNull(),
  active: boolean().default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("user_supervisor_user_id_idx").on(table.userId),
  supervisorIdIdx: index("user_supervisor_supervisor_id_idx").on(table.supervisorId),
}));

export const userSupervisorEntries = pgTable("UserSupervisorEntries", {
  id: integer("id").primaryKey(),
  userId: bigint("user_id", { mode: "bigint" }).notNull(),
  supervisorId: bigint("supervisor_id", { mode: "bigint" }).notNull(),
  note: text(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("user_supervisor_entries_user_id_idx").on(table.userId),
}));

export const revertNotions = pgTable("RevertNotion", {
  id: integer("id").primaryKey(),
  userId: bigint("user_id", { mode: "bigint" }).notNull(),
  notionPageId: varchar("notion_page_id", { length: 255 }).notNull(),
  notionPageUrl: varchar("notion_page_url", { length: 512 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("revert_notion_user_id_idx").on(table.userId),
}));

// --- Assignment & Support Tables ---

export const campaigns = pgTable("Campaign", {
  id: integer("id").primaryKey(),
  name: varchar({ length: 255 }).notNull(),
  description: text(),
  startDate: timestamp("start_date").defaultNow().notNull(),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const reachoutLogs = pgTable("ReachoutLog", {
  id: integer("id").primaryKey(),
  userId: bigint("user_id", { mode: "bigint" }).notNull(),
  messageId: bigint("message_id", { mode: "bigint" }),
  channelId: bigint("channel_id", { mode: "bigint" }),
  trigger: varchar({ length: 100 }).notNull(),
  active: boolean().default(true).notNull(),
  campaignId: integer("campaign_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("reachout_log_user_id_idx").on(table.userId),
  messageIdIdx: index("reachout_log_message_id_idx").on(table.messageId),
}));

export const assignmentStatuses = pgTable("AssignmentStatus", {
  id: integer("id").primaryKey(),
  userId: bigint("user_id", { mode: "bigint" }).notNull(),
  reachoutLogId: integer("reachout_log_id"),
  addedById: bigint("added_by_id", { mode: "bigint" }).notNull(),
  status: assignmentStatusEnum("status").notNull(),
  priority: integer().default(0).notNull(),
  notes: text(),
  active: boolean().default(true).notNull(),
  resolvedAt: timestamp("resolved_at"),
  resolvedById: bigint("resolved_by_id", { mode: "bigint" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("assignment_status_user_id_idx").on(table.userId),
  statusIdx: index("assignment_status_status_idx").on(table.status),
}));

export const supervisionNeeds = pgTable("SupervisionNeed", {
  id: integer("id").primaryKey(),
  userId: bigint("user_id", { mode: "bigint" }).notNull(),
  needType: supervisionNeedEnum("need_type").notNull(),
  severity: integer().default(1).notNull(),
  addedBy: bigint("added_by", { mode: "bigint" }),
  notes: text(),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("supervision_need_user_id_idx").on(table.userId),
  needTypeIdx: index("supervision_need_need_type_idx").on(table.needType),
}));

export const supportNotifications = pgTable("SupportNotification", {
  id: integer("id").primaryKey(),
  userId: bigint("user_id", { mode: "bigint" }).notNull(),
  messageId: bigint("message_id", { mode: "bigint" }),
  channelId: bigint("channel_id", { mode: "bigint" }).notNull(),
  assignedById: bigint("assigned_by_id", { mode: "bigint" }),
  assignedAt: timestamp("assigned_at"),
  assignmentStatusId: integer("assignment_status_id"),
  active: boolean().default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("support_notification_user_id_idx").on(table.userId),
  messageIdIdx: index("support_notification_message_id_idx").on(table.messageId),
  assignedByIdIdx: index("support_notification_assigned_by_id_idx").on(table.assignedById),
  activeIdx: index("support_notification_active_idx").on(table.active),
}));

// --- Infraction System Tables ---

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
  moderatorIdIdx: index("Infraction_moderator_id_idx").on(table.moderatorId),
  createdAtIdx: index("Infraction_created_at_idx").on(table.createdAt),
  expiresAtIdx: index("Infraction_expires_at_idx").on(table.expiresAt),
  statusExpiresAtIdx: index("Infraction_status_expires_at_idx").on(table.status, table.expiresAt),
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
  approvedIdx: index("InfractionAppeal_approved_idx").on(table.approved),
}));

export const jailRoles = pgTable("JailRoles", {
  id: integer("id").primaryKey(),
  infractionId: integer("infraction_id").notNull(),
  storedRoleId: bigint("stored_role_id", { mode: "bigint" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  infractionIdIdx: index("JailRoles_infraction_id_idx").on(table.infractionId),
}));

// ============================================================================
// RELATIONS
// ============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  messages: many(messages),
  tickets: many(tickets),
  roles: many(userRoles),
  shahadas: many(shahadas, { relationName: "takenShahadas" }),
  supervisedShahadas: many(shahadas, { relationName: "supervisedShahadas" }),
  revertUserInfo: many(revertUserInfo),
  userSupervisors: many(userSupervisors),
  userSupervisorEntries: many(userSupervisorEntries),
  revertNotions: many(revertNotions),
  assignmentStatuses: many(assignmentStatuses, { relationName: "revertAssignment" }),
  assignmentStatusesGiven: many(assignmentStatuses, { relationName: "supervisorAssignment" }),
  assignmentStatusesResolved: many(assignmentStatuses, { relationName: "resolvingSupervisor" }),
  supervisionNeeds: many(supervisionNeeds),
  reachoutLogs: many(reachoutLogs),
  supportNotificationsReceived: many(supportNotifications, { relationName: "revertSupportNotifications" }),
  supportAssignmentsFulfilled: many(supportNotifications, { relationName: "staffSupportAssignments" }),
  infractionsReceived: many(infractions, { relationName: "userReceivedInfractions" }),
  infractionsGiven: many(infractions, { relationName: "userGivenInfractions" }),
  pardonsGiven: many(infractions, { relationName: "userGivenPardons" }),
  appealReviews: many(infractionAppeals),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  author: one(users, {
    fields: [messages.authorId],
    references: [users.discordId],
  }),
  channel: one(channels, {
    fields: [messages.channelId],
    references: [channels.channelId],
  }),
}));

export const channelsRelations = relations(channels, ({ many, one }) => ({
  messages: many(messages),
  ticket: one(tickets, {
    fields: [channels.channelId],
    references: [tickets.channelId],
  }),
}));

export const ticketsRelations = relations(tickets, ({ one }) => ({
  author: one(users, {
    fields: [tickets.authorId],
    references: [users.discordId],
  }),
  channel: one(channels, {
    fields: [tickets.channelId],
    references: [channels.channelId],
  }),
  panel: one(panels, {
    fields: [tickets.panelId],
    references: [panels.id],
  }),
}));

export const panelsRelations = relations(panels, ({ many }) => ({
  tickets: many(tickets),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.discordId],
  }),
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.roleId],
  }),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  userRoles: many(userRoles),
  jailRoles: many(jailRoles),
}));

export const shahadasRelations = relations(shahadas, ({ one }) => ({
  user: one(users, {
    fields: [shahadas.userId],
    references: [users.discordId],
    relationName: "takenShahadas",
  }),
  supervisor: one(users, {
    fields: [shahadas.supervisorId],
    references: [users.discordId],
    relationName: "supervisedShahadas",
  }),
}));

export const revertUserInfoRelations = relations(revertUserInfo, ({ one }) => ({
  user: one(users, {
    fields: [revertUserInfo.discordId],
    references: [users.discordId],
  }),
}));

export const userSupervisorsRelations = relations(userSupervisors, ({ one }) => ({
  user: one(users, {
    fields: [userSupervisors.userId],
    references: [users.discordId],
  }),
}));

export const userSupervisorEntriesRelations = relations(userSupervisorEntries, ({ one }) => ({
  user: one(users, {
    fields: [userSupervisorEntries.userId],
    references: [users.discordId],
  }),
}));

export const revertNotionsRelations = relations(revertNotions, ({ one }) => ({
  user: one(users, {
    fields: [revertNotions.userId],
    references: [users.discordId],
  }),
}));

export const campaignsRelations = relations(campaigns, ({ many }) => ({
  reachoutLogs: many(reachoutLogs),
}));

export const reachoutLogsRelations = relations(reachoutLogs, ({ one, many }) => ({
  user: one(users, {
    fields: [reachoutLogs.userId],
    references: [users.discordId],
  }),
  campaign: one(campaigns, {
    fields: [reachoutLogs.campaignId],
    references: [campaigns.id],
  }),
  assignmentStatuses: many(assignmentStatuses),
}));

export const assignmentStatusesRelations = relations(assignmentStatuses, ({ one, many }) => ({
  user: one(users, {
    fields: [assignmentStatuses.userId],
    references: [users.discordId],
    relationName: "revertAssignment",
  }),
  addedBy: one(users, {
    fields: [assignmentStatuses.addedById],
    references: [users.discordId],
    relationName: "supervisorAssignment",
  }),
  resolvedBy: one(users, {
    fields: [assignmentStatuses.resolvedById],
    references: [users.discordId],
    relationName: "resolvingSupervisor",
  }),
  reachoutLog: one(reachoutLogs, {
    fields: [assignmentStatuses.reachoutLogId],
    references: [reachoutLogs.id],
  }),
  supportNotifications: many(supportNotifications),
}));

export const supervisionNeedsRelations = relations(supervisionNeeds, ({ one }) => ({
  user: one(users, {
    fields: [supervisionNeeds.userId],
    references: [users.discordId],
  }),
}));

export const supportNotificationsRelations = relations(supportNotifications, ({ one }) => ({
  user: one(users, {
    fields: [supportNotifications.userId],
    references: [users.discordId],
    relationName: "revertSupportNotifications",
  }),
  assignedBy: one(users, {
    fields: [supportNotifications.assignedById],
    references: [users.discordId],
    relationName: "staffSupportAssignments",
  }),
  assignmentStatus: one(assignmentStatuses, {
    fields: [supportNotifications.assignmentStatusId],
    references: [assignmentStatuses.id],
  }),
}));

export const infractionsRelations = relations(infractions, ({ one, many }) => ({
  user: one(users, {
    fields: [infractions.userId],
    references: [users.discordId],
    relationName: "userReceivedInfractions",
  }),
  moderator: one(users, {
    fields: [infractions.moderatorId],
    references: [users.discordId],
    relationName: "userGivenInfractions",
  }),
  pardonedBy: one(users, {
    fields: [infractions.pardonedById],
    references: [users.discordId],
    relationName: "userGivenPardons",
  }),
  appeal: one(infractionAppeals, {
    fields: [infractions.id],
    references: [infractionAppeals.infractionId],
  }),
  jailRoles: many(jailRoles),
}));

export const infractionAppealsRelations = relations(infractionAppeals, ({ one }) => ({
  infraction: one(infractions, {
    fields: [infractionAppeals.infractionId],
    references: [infractions.id],
  }),
  reviewedBy: one(users, {
    fields: [infractionAppeals.reviewedById],
    references: [users.discordId],
  }),
}));

export const jailRolesRelations = relations(jailRoles, ({ one }) => ({
  infraction: one(infractions, {
    fields: [jailRoles.infractionId],
    references: [infractions.id],
  }),
  storedRole: one(roles, {
    fields: [jailRoles.storedRoleId],
    references: [roles.roleId],
  }),
}));
