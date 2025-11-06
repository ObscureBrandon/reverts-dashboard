import { pgTable, text, boolean, timestamp, unique, foreignKey } from "drizzle-orm/pg-core";

/**
 * Auth Schema - Dashboard-owned tables
 * 
 * These tables are managed by Drizzle migrations.
 * The bot does not interact with these tables.
 */

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
