import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import * as schema from "./db/schema";
import { eq, and } from "drizzle-orm";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      // Map better-auth schema objects to our custom table names
      user: schema.authUser,
      session: schema.authSession,
      account: schema.authAccount,
      verification: schema.authVerification,
    },
  }),

  socialProviders: {
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    },
  },

  // Database hooks to verify staff role before allowing account creation
  databaseHooks: {
    user: {
      create: {
        async before(user) {
          // Log the user object to see what's available
          console.log('[Better Auth] User creation data:', JSON.stringify(user, null, 2));

          // The user.id at this point is the Better Auth internal ID, not Discord ID
          // We need to get the Discord ID from the account being created
          // For now, let's allow user creation and check account separately

          // Return the user data wrapped in a data object
          return { data: user };
        },
      },
    },
    account: {
      create: {
        async before(account) {
          // Log account creation data
          console.log('[Better Auth] Account creation data:', JSON.stringify(account, null, 2));

          // The account.accountId should be the Discord user ID
          const discordId = account.accountId;

          if (!discordId) {
            throw new Error("Discord ID not found in account data");
          }

          // Check if user has the required moderator role in the database
          const modRoleId = process.env.MOD_ROLE_ID;

          if (!modRoleId) {
            throw new Error("MOD_ROLE_ID environment variable not configured");
          }

          const roles = await db.select().from(schema.userRoles).where(eq(schema.userRoles.userId, BigInt(discordId)));
          console.log(roles);

          const hasModRole = await db
            .select({ exists: schema.userRoles.userId })
            .from(schema.userRoles)
            .where(
              and(
                eq(schema.userRoles.userId, BigInt(discordId)),
                eq(schema.userRoles.roleId, BigInt(modRoleId))
              )
            )
            .limit(1);

          if (hasModRole.length === 0) {
            throw new Error("Access denied: You must have a moderator role to access this dashboard");
          }

          // Return the account data wrapped in a data object
          return { data: account };
        },
      },
    },
  },

  secret: process.env.BETTER_AUTH_SECRET!,

  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
});

export type Session = typeof auth.$Infer.Session;
