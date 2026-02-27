import { and, eq } from 'drizzle-orm';
import { db } from './db';
import * as schema from './db/schema';

export type UserRole = 'mod' | 'user';

/**
 * Get Discord ID from a better-auth session user ID.
 * Looks up the auth_account table to find the Discord provider account.
 */
export async function getDiscordIdFromSession(userId: string): Promise<string | null> {
  const account = await db
    .select({ accountId: schema.authAccount.accountId })
    .from(schema.authAccount)
    .where(
      and(
        eq(schema.authAccount.userId, userId),
        eq(schema.authAccount.providerId, 'discord')
      )
    )
    .limit(1);

  return account[0]?.accountId ?? null;
}

/**
 * Check if a Discord user has the moderator role.
 */
export async function hasModRole(discordId: string): Promise<boolean> {
  const modRoleId = process.env.MOD_ROLE_ID;

  if (!modRoleId) {
    console.error('MOD_ROLE_ID environment variable not configured');
    return false;
  }

  const result = await db
    .select({ exists: schema.userRoles.userId })
    .from(schema.userRoles)
    .where(
      and(
        eq(schema.userRoles.userId, BigInt(discordId)),
        eq(schema.userRoles.roleId, BigInt(modRoleId))
      )
    )
    .limit(1);

  return result.length > 0;
}

/**
 * Get the role and Discord ID for a better-auth session user.
 */
export async function getUserRole(userId: string): Promise<{ role: UserRole; discordId: string } | null> {
  const discordId = await getDiscordIdFromSession(userId);

  if (!discordId) {
    return null;
  }

  const isMod = await hasModRole(discordId);

  return {
    role: isMod ? 'mod' : 'user',
    discordId,
  };
}
