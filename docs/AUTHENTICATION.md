# Authentication

> Discord OAuth authentication setup using better-auth.

## Overview

The dashboard requires authentication via Discord OAuth. Any Discord user may sign in, but access inside the app is gated by route and API policy.

```
User visits → Middleware → No session?
                              ↓
                         /login page
                              ↓
                         Discord OAuth
                              ↓
                         Session created
                              ↓
                        Route / API access check
                          ↓
                    Mods: admin surfaces | Non-mods: My Tickets + owned ticket detail
```

---

## Setup Instructions

### 1. Create Discord Application

1. Go to https://discord.com/developers/applications
2. Click **"New Application"** and name it
3. Go to **OAuth2** section
4. Add redirect URLs:
   - Development: `http://localhost:3000/api/auth/callback/discord`
   - Production: `https://your-domain.com/api/auth/callback/discord`
5. Copy the **Client ID** and **Client Secret**

### 2. Configure Environment Variables

Add to `.env.local`:

```bash
# Discord OAuth
DISCORD_CLIENT_ID="your_discord_client_id"
DISCORD_CLIENT_SECRET="your_discord_client_secret"

# Better Auth
BETTER_AUTH_SECRET="your_random_secret"  # Generate: openssl rand -base64 32
BETTER_AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_BETTER_AUTH_URL="http://localhost:3000"

# Discord Guild (for role lookups)
DISCORD_GUILD_ID="your_discord_server_id"

# Moderator role used for admin surfaces
MOD_ROLE_ID="your_moderator_role_id"
```

### 3. Run Database Migration

Apply auth tables:

```bash
psql $DATABASE_URL -f drizzle/0000_initial_auth_tables.sql
```

Or use drizzle-kit:

```bash
bun drizzle-kit migrate
```

### 4. Start the Application

```bash
bun dev
```

Visit `http://localhost:3000` — you'll be redirected to the login page.

---

## How It Works

### Authentication Flow

1. User clicks "Sign in with Discord"
2. Discord OAuth redirects to `/api/auth/callback/discord`
3. better-auth creates or resumes a local session for that Discord account
4. Downstream route and API guards determine what the user can access

There is no pre-account moderator gate. The moderator role is checked only when a request targets moderator-only surfaces.

### Access Model

The current product contract is:

1. Any Discord user may authenticate.
2. Moderator-only admin surfaces are controlled by `MOD_ROLE_ID`.
3. Non-mod users may access only `/my-tickets` and ticket detail pages for tickets they own.
4. Ticket queue pages, users pages, messages search, summaries, and other admin APIs remain moderator-only.

Moderator role checks are resolved against the `UserRoles` table using the exact role ID from `MOD_ROLE_ID`.

### Route Protection

| Layer | File | Protects |
|-------|------|----------|
| Proxy | `src/proxy.ts` | Session gating plus page-level access rules |
| Elysia auth macro | `src/lib/elysia/auth.ts` | `auth` for any session, `modAuth` for moderator-only endpoints |
| Route-specific ownership checks | ticket and message routes | Owner-or-mod access for ticket detail and transcript fetch |

```typescript
// src/proxy.ts
// - Redirects unauthenticated users to /login
// - Keeps /tickets, /users, and /messages moderator-only by default
// - Allows /tickets/:id when the current user is a moderator or the ticket owner
```

---

## Database Tables

Auth tables (created by Drizzle migration):

| Table | Purpose |
|-------|---------|
| `auth_user` | User accounts from Discord OAuth |
| `auth_session` | Active sessions |
| `auth_account` | OAuth account connections |
| `auth_verification` | Verification tokens |

Existing bot tables used for role and ownership checks:

| Table | Purpose |
|-------|---------|
| `User` | Discord user data (discord_id) |
| `Role` | Discord roles (role_id, name) |
| `UserRoles` | User-role junction (user_id, role_id) |
| `Ticket` | Ticket ownership for owner-visible detail access |

---

## Files Reference

### Server Configuration

```typescript
// lib/auth.ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    usePlural: true,
  }),
  socialProviders: {
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    },
  },
  // Any Discord user may authenticate.
  // Access control is enforced later by the proxy and route guards.
});
```

### Client Hooks

```typescript
// lib/auth-client.ts
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
});

// Usage in components
const { data: session } = authClient.useSession();
```

### Proxy

```typescript
// src/proxy.ts
// Session-required app shell with owner-or-mod access for /tickets/:id
```

---

## Production Deployment

Update environment variables:

```bash
BETTER_AUTH_URL="https://your-production-domain.com"
NEXT_PUBLIC_BETTER_AUTH_URL="https://your-production-domain.com"
```

Update Discord OAuth redirect URL:
```
https://your-production-domain.com/api/auth/callback/discord
```

---

## Troubleshooting

### Signed-in user still cannot access admin pages

1. Check `MOD_ROLE_ID` is configured correctly.
2. Verify the role exists in the `Role` table:
   ```sql
  SELECT * FROM "Role" WHERE role_id = YOUR_MOD_ROLE_ID;
   ```
3. Verify user-role connection:
   ```sql
  SELECT * FROM "UserRoles" WHERE user_id = YOUR_DISCORD_ID AND role_id = YOUR_MOD_ROLE_ID;
   ```

### Non-mod user cannot open a ticket detail page

1. Confirm the ticket is owned by that user:
  ```sql
  SELECT id, author_id FROM "Ticket" WHERE id = YOUR_TICKET_ID;
  ```
2. Confirm the signed-in session resolves to the same Discord account in `auth_account`.
3. If ownership does not match, the user will be redirected to `/my-tickets`.

### 401 Unauthorized errors

1. Check `BETTER_AUTH_SECRET` is set
2. Verify auth tables exist:
   ```bash
   psql $DATABASE_URL -c "\dt auth_*"
   ```
3. Check browser cookies are enabled

### Redirect loops

1. Verify `BETTER_AUTH_URL` matches your domain
2. Check Discord OAuth redirect URL matches environment
3. Clear browser cookies and retry

### Session not persisting

1. Check `BETTER_AUTH_SECRET` is the same across restarts
2. Verify database connection is working
3. Check for cookie domain issues in production

---

## Related Documentation

- [Architecture](./ARCHITECTURE.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [API Reference](./API.md)
