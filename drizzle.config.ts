import type { Config } from 'drizzle-kit';

/**
 * Drizzle Config - Auth Tables Migrations Only
 * 
 * IMPORTANT: The tablesFilter ensures drizzle-kit only manages auth_* tables.
 * 
 * Schema Structure:
 * - lib/db/schema.ts contains ALL tables (auth + bot) for runtime queries
 * - Drizzle-kit migrations only affect auth_* tables (tablesFilter)
 * - Bot tables (User, Message, Ticket, etc.) are managed by bot's Prisma
 * 
 * Migration Commands:
 * - `drizzle-kit generate` - Generate migrations for auth_* tables only
 * - `drizzle-kit migrate` - Apply migrations
 * - DO NOT use `drizzle-kit push` (use explicit migrations instead)
 */

export default {
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // Only manage auth tables - bot tables are managed by the bot's Prisma setup
  tablesFilter: ['auth_*'],
} satisfies Config;
