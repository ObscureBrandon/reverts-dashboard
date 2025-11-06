import { pgTable, bigint, text, boolean, timestamp, integer, varchar, index, jsonb, pgEnum, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const ticketStatusEnum = pgEnum('TicketStatus', ['OPEN', 'CLOSED', 'DELETED']);

// User table - simplified for message search
export const users = pgTable('User', {
  discordId: bigint('discord_id', { mode: 'bigint' }).primaryKey(),
  name: varchar('name', { length: 255 }),
  displayName: varchar('display_name', { length: 255 }),
  displayAvatar: varchar('display_avatar', { length: 512 }),
  nick: varchar('nick', { length: 255 }),
  inGuild: boolean('in_guild').default(true).notNull(),
  
  // User profile fields for ticket context
  relationToIslam: varchar('relation_to_islam', { length: 255 }),
  gender: varchar('gender', { length: 50 }),
  age: varchar('age', { length: 50 }),
  referralSource: varchar('referral_source', { length: 255 }),
  region: varchar('region', { length: 255 }),
  religiousAffiliation: varchar('religious_affiliation', { length: 255 }),
  
  // Verification status
  isVerified: boolean('is_verified').default(false).notNull(),
  isVoiceVerified: boolean('is_voice_verified').default(false).notNull(),
  verifiedBy: bigint('verified_by', { mode: 'bigint' }),
  voiceVerifiedBy: bigint('voice_verified_by', { mode: 'bigint' }),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Role table
export const roles = pgTable('Role', {
  roleId: bigint('role_id', { mode: 'bigint' }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  permissions: bigint('permissions', { mode: 'bigint' }).notNull(),
  color: integer('color').notNull(),
  position: integer('position').notNull(),
  deleted: boolean('deleted').default(false).notNull(),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// UserRoles junction table
export const userRoles = pgTable('UserRoles', {
  userId: bigint('user_id', { mode: 'bigint' }).notNull().references(() => users.discordId),
  roleId: bigint('role_id', { mode: 'bigint' }).notNull().references(() => roles.roleId),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  roleIdIdx: index('user_roles_role_id_idx').on(table.roleId),
}));

// Channel table
export const channels = pgTable('Channel', {
  channelId: bigint('channel_id', { mode: 'bigint' }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  categoryId: bigint('category_id', { mode: 'bigint' }),
  position: integer('position').notNull(),
  isCategory: boolean('is_category').default(false).notNull(),
  isDm: boolean('is_dm').default(false).notNull(),
  deleted: boolean('deleted').default(false).notNull(),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  categoryIdx: index('channel_category_idx').on(table.categoryId),
}));

// Panel table (minimal)
export const panels = pgTable('Panel', {
  id: integer('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Ticket table
export const tickets = pgTable('Ticket', {
  id: integer('id').primaryKey(),
  channelId: bigint('channel_id', { mode: 'bigint' }).references(() => channels.channelId),
  authorId: bigint('author_id', { mode: 'bigint' }).notNull().references(() => users.discordId),
  panelId: integer('panel_id').notNull().references(() => panels.id),
  status: ticketStatusEnum('status').default('OPEN'),
  sequence: integer('sequence'),
  closedById: bigint('closed_by_id', { mode: 'bigint' }),
  deletedById: bigint('deleted_by_id', { mode: 'bigint' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  closedAt: timestamp('closed_at'),
  deletedAt: timestamp('deleted_at'),
  
  // AI summary fields
  summary: text('summary'),
  summaryGeneratedAt: timestamp('summary_generated_at'),
  summaryModel: varchar('summary_model', { length: 100 }),
  summaryTokensUsed: integer('summary_tokens_used'),
}, (table) => ({
  channelIdx: index('ticket_channel_idx').on(table.channelId),
  authorStatusPanelIdx: index('ticket_author_status_panel_idx').on(table.authorId, table.status, table.panelId),
  channelUnique: unique('Ticket_channel_id_key').on(table.channelId),
}));

// Message table - the core table
export const messages = pgTable('Message', {
  messageId: bigint('message_id', { mode: 'bigint' }).primaryKey(),
  categoryId: bigint('category_id', { mode: 'bigint' }),
  content: text('content'),
  embeds: jsonb('embeds').array().notNull().$type<any[]>(),
  attachments: text('attachments').array().notNull(),
  memberMentions: bigint('member_mentions', { mode: 'bigint' }).array().notNull(),
  channelMentions: bigint('channel_mentions', { mode: 'bigint' }).array().notNull(),
  roleMentions: bigint('role_mentions', { mode: 'bigint' }).array().notNull(),
  authorId: bigint('author_id', { mode: 'bigint' }).notNull().references(() => users.discordId),
  channelId: bigint('channel_id', { mode: 'bigint' }).notNull().references(() => channels.channelId),
  isDeleted: boolean('is_deleted').default(false).notNull(),
  deletedAt: timestamp('deleted_at'),
  isDm: boolean('is_dm').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  
  // For future semantic search
  // embedding: vector('embedding', { dimensions: 1536 }), // Uncomment when pgvector is set up
}, (table) => ({
  authorIdx: index('message_author_idx').on(table.authorId),
  channelIdx: index('message_channel_idx').on(table.channelId),
  createdAtIdx: index('message_created_at_idx').on(table.createdAt),
}));

// Relations for better TypeScript inference
export const usersRelations = relations(users, ({ many }) => ({
  messages: many(messages),
  tickets: many(tickets),
  roles: many(userRoles),
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
}));
