import type { Config } from 'drizzle-kit';

/**
 * Drizzle Config - Auth Tables Only
 * 
 * IMPORTANT: This config is for auth table migrations ONLY.
 * 
 * The dashboard database has two types of tables:
 * 1. Auth tables (auth_*) - Managed by this dashboard using Drizzle
 * 2. Bot tables (User, Message, Ticket, etc.) - Managed by the bot using Prisma
 * 
 * Migration Strategy:
 * - DO NOT use `drizzle-kit generate` or `drizzle-kit push` for schema diffing
 *   (these will try to drop bot tables since they're not in auth-schema.ts)
 * - ONLY use `drizzle-kit migrate` to apply manually written migrations
 * - For auth table changes, write migrations manually in drizzle/ folder
 * 
 * Runtime Queries:
 * - lib/db/schema.ts exports BOTH auth and bot schemas for type-safe queries
 * - This config file only affects drizzle-kit tooling, not runtime behavior
 */

export default {
  schema: './lib/db/auth-schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // Only manage auth tables - bot tables are managed by the bot's Prisma setup
  tablesFilter: ['auth_*'],
} satisfies Config;
