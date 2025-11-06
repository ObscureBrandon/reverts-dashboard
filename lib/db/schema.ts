/**
 * Main Schema Export
 * 
 * This file re-exports tables from both:
 * - auth-schema.ts (Dashboard-owned, Drizzle manages migrations)
 * - bot-schema.ts (Bot-owned, read-only access)
 * 
 * All existing imports remain unchanged - this maintains backward compatibility.
 */

import { relations } from 'drizzle-orm';

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
