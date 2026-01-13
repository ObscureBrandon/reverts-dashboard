/**
 * Main Schema Export
 * 
 * This file re-exports tables from both:
 * - auth-schema.ts (Dashboard-owned, Drizzle manages migrations)
 * - bot-schema.ts (Bot-owned, read-only access)
 * 
 * All existing imports remain unchanged - this maintains backward compatibility.
 */

import { relations, sql } from 'drizzle-orm';

// Re-export auth tables (Dashboard-owned)
export * from './auth-schema';

// Re-export bot tables (Bot-owned, read-only)
export * from './bot-schema';

// Import for relations
import { 
  users, 
  messages, 
  channels, 
  tickets, 
  panels, 
  userRoles, 
  roles 
} from './bot-schema';
import {
  pgTable,
  bigint,
  integer,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";

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

export const supportNotifications = pgTable("SupportNotification", {
  id: integer("id").primaryKey().default(sql`nextval('SupportNotification_id_seq')`),

  userId: bigint("user_id", { mode: "bigint" }).notNull(),
  messageId: bigint("message_id", { mode: "bigint" }).notNull(),
  channelId: bigint("channel_id", { mode: "bigint" }).notNull(),

  assignedById: bigint("assigned_by_id", { mode: "bigint" }),
  assignedAt: timestamp("assigned_at"),

  assignmentStatusId: integer("assignment_status_id").notNull(),

  createdAt: timestamp("created_at").notNull(),
  active: boolean("active").notNull(),
});

