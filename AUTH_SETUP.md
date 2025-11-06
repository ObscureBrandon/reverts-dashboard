# Discord OAuth Authentication Setup

This document outlines the Discord OAuth authentication implementation using better-auth.

## Overview

The Reverts Dashboard now requires authentication via Discord OAuth. Only users with the **moderator role** can access the dashboard.

## Files Created/Modified

### New Files
- `lib/auth.ts` - Better-auth server configuration with Discord provider
- `lib/auth-client.ts` - Better-auth client for frontend hooks
- `lib/auth-helpers.ts` - Server-side authentication helper functions
- `app/api/auth/[...all]/route.ts` - Auth API route handler
- `app/login/page.tsx` - Login page with Discord OAuth
- `middleware.ts` - Route protection middleware
- `migrations/002_add_better_auth_tables.sql` - Database migration for auth tables

### Modified Files
- `lib/db/schema.ts` - Added auth tables (auth_user, auth_session, auth_account, auth_verification)
- `.env.local.example` - Added auth environment variables
- `app/api/messages/route.ts` - Added auth check
- `app/api/tickets/route.ts` - Added auth check
- `app/api/tickets/[id]/summary/route.ts` - Added auth check
- `app/api/users/[id]/route.ts` - Added auth check
- `drizzle.config.ts` - Added auth tables to filter

## Setup Instructions

### 1. Create Discord Application

1. Go to https://discord.com/developers/applications
2. Click "New Application" and give it a name
3. Go to "OAuth2" section
4. Add redirect URL: `http://localhost:3000/api/auth/callback/discord`
5. Copy the Client ID and Client Secret

### 2. Configure Environment Variables

Add to your `.env.local` file:

```bash
# Discord OAuth
DISCORD_CLIENT_ID="your_discord_client_id_here"
DISCORD_CLIENT_SECRET="your_discord_client_secret_here"

# Better Auth
BETTER_AUTH_SECRET="your_random_secret_here"  # Generate with: openssl rand -base64 32
BETTER_AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_BETTER_AUTH_URL="http://localhost:3000"

# Discord Guild ID (already exists)
DISCORD_GUILD_ID="your_discord_server_id"
```

### 3. Run Database Migration

Apply the auth tables migration:

```bash
psql $DATABASE_URL -f migrations/002_add_better_auth_tables.sql
```

Or if you prefer, use drizzle-kit:

```bash
bun drizzle-kit push
```

### 4. Start the Application

```bash
bun dev
```

Visit `http://localhost:3000` - you'll be redirected to the login page.

## How It Works

### Role Verification

When a user signs in with Discord:

1. Discord OAuth redirects to `/api/auth/callback/discord`
2. Better-auth creates a session
3. **Before** creating the user account, the `databaseHooks.user.create.before` hook runs
4. The hook queries the `UserRoles` and `Role` tables
5. It checks if the Discord user has a role containing "mod" or "moderator"
6. If no mod role is found, the account creation is rejected with an error
7. If mod role exists, the user is created and can access the dashboard

### Route Protection

- **Middleware** (`middleware.ts`) - Protects all routes except `/login` and `/api/auth/*`
- **API Routes** - All API routes use `requireAuth()` helper to check session
- Unauthenticated requests are redirected to `/login` or return 401

### Database Schema

**Auth Tables:**
- `auth_user` - User accounts (from Discord OAuth)
- `auth_session` - Active sessions
- `auth_account` - OAuth account connections (Discord)
- `auth_verification` - Verification tokens

**Existing Tables Used:**
- `User` (discord_id) - Discord user data
- `Role` (role_id, name) - Discord roles
- `UserRoles` (user_id, role_id) - User-role junction table

## Testing

1. Ensure you have a mod role in your Discord server
2. Visit `http://localhost:3000`
3. You should be redirected to `/login`
4. Click "Sign in with Discord"
5. Authorize the application
6. You should be redirected back and granted access

## Production Deployment

Update these environment variables for production:

```bash
BETTER_AUTH_URL="https://your-production-domain.com"
NEXT_PUBLIC_BETTER_AUTH_URL="https://your-production-domain.com"
```

Also update Discord OAuth redirect URL to:
```
https://your-production-domain.com/api/auth/callback/discord
```

## Troubleshooting

**"Access denied: You must have a moderator role"**
- Check that your Discord account has a role with "mod" or "moderator" in the name
- Verify the role exists in the `Role` table
- Verify the user-role connection exists in `UserRoles` table

**401 Unauthorized errors**
- Check that `BETTER_AUTH_SECRET` is set
- Verify database auth tables exist
- Check browser cookies are enabled

**Redirect loops**
- Verify `BETTER_AUTH_URL` and `NEXT_PUBLIC_BETTER_AUTH_URL` match your domain
- Check Discord OAuth redirect URL matches your environment
