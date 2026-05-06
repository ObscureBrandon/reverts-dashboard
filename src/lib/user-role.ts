import { and, eq } from 'drizzle-orm';
import { db } from './db';
import * as schema from './db/schema';

export type UserRole = 'mod' | 'trial_support' | 'user';

export type UserCapabilities = {
  canAccessDashboard: boolean;
  canAccessUsersPage: boolean;
  canAccessStaffOverview: boolean;
  canAccessTicketsPage: boolean;
  canAccessMessagesPage: boolean;
  canUseGlobalSearch: boolean;
  canManageTagCatalog: boolean;
  canAccessBotHealth: boolean;
  canPerformCrossStaffActions: boolean;
  canGenerateTicketSummary: boolean;
};

export type UserRoleResult = {
  role: UserRole;
  discordId: string;
  capabilities: UserCapabilities;
};

function getCapabilitiesForRole(role: UserRole): UserCapabilities {
  const isStaff = role === 'mod' || role === 'trial_support';
  const isMod = role === 'mod';

  return {
    canAccessDashboard: isStaff,
    canAccessUsersPage: isStaff,
    canAccessStaffOverview: isMod,
    canAccessTicketsPage: isStaff,
    canAccessMessagesPage: isMod,
    canUseGlobalSearch: isMod,
    canManageTagCatalog: true,
    canAccessBotHealth: true,
    canPerformCrossStaffActions: isMod,
    canGenerateTicketSummary: isMod,
  };
}

async function hasDiscordRole(discordId: string, roleId: string | undefined): Promise<boolean> {
  if (!roleId) {
    return false;
  }

  const result = await db
    .select({ exists: schema.userRoles.userId })
    .from(schema.userRoles)
    .where(
      and(
        eq(schema.userRoles.userId, BigInt(discordId)),
        eq(schema.userRoles.roleId, BigInt(roleId))
      )
    )
    .limit(1);

  return result.length > 0;
}

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

  return hasDiscordRole(discordId, modRoleId);
}

/**
 * Check if a Discord user has the trial support role.
 */
export async function hasTrialSupportRole(discordId: string): Promise<boolean> {
  return hasDiscordRole(discordId, process.env.TRIAL_SUPPORT_ROLE_ID);
}

/**
 * Get the role and Discord ID for a better-auth session user.
 */
export async function getUserRole(userId: string): Promise<UserRoleResult | null> {
  const discordId = await getDiscordIdFromSession(userId);

  if (!discordId) {
    return null;
  }

  const isMod = await hasModRole(discordId);
  const isTrialSupport = await hasTrialSupportRole(discordId);
  const role: UserRole = isMod ? 'mod' : isTrialSupport ? 'trial_support' : 'user';

  return {
    role,
    discordId,
    capabilities: getCapabilitiesForRole(role),
  };
}

/**
 * Check whether a Discord user owns a given ticket.
 */
export async function isTicketOwner(discordId: string, ticketId: number): Promise<boolean> {
  const result = await db
    .select({ authorId: schema.tickets.authorId })
    .from(schema.tickets)
    .where(eq(schema.tickets.id, ticketId))
    .limit(1);

  return result[0]?.authorId === BigInt(discordId);
}

/**
 * Check whether a Discord user has authored any non-deleted message in a ticket.
 */
export async function hasTicketActivity(discordId: string, ticketId: number): Promise<boolean> {
  const result = await db
    .select({ ticketId: schema.tickets.id })
    .from(schema.tickets)
    .innerJoin(
      schema.messages,
      and(
        eq(schema.messages.channelId, schema.tickets.channelId),
        eq(schema.messages.isDeleted, false),
        eq(schema.messages.authorId, BigInt(discordId))
      )
    )
    .where(eq(schema.tickets.id, ticketId))
    .limit(1);

  return result.length > 0;
}

/**
 * Get the currently active supervisor for a revert-like user.
 */
export async function getActiveSupervisorId(userId: bigint): Promise<bigint | null> {
  const result = await db
    .select({ supervisorId: schema.userSupervisors.supervisorId })
    .from(schema.userSupervisors)
    .where(
      and(
        eq(schema.userSupervisors.userId, userId),
        eq(schema.userSupervisors.active, true)
      )
    )
    .limit(1);

  return result[0]?.supervisorId ?? null;
}
