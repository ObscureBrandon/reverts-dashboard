# Authentication

> Discord OAuth authentication setup using better-auth.

## Overview

The dashboard requires authentication via Discord OAuth. Only users with a **moderator role** can access the dashboard.

```
User visits → Middleware → No session?
                              ↓
                         /login page
                              ↓
                         Discord OAuth
                              ↓
                         Role verification
                         (must have mod role)
                              ↓
                         Session created
                              ↓
                         Dashboard access
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

### Role Verification Flow

1. User clicks "Sign in with Discord"
2. Discord OAuth redirects to `/api/auth/callback/discord`
3. **Before** creating the user account, a hook runs:
   - Queries `UserRoles` and `Role` tables
   - Checks if user has a role containing "mod" or "moderator"
4. If no mod role → Account creation rejected with error
5. If mod role exists → User created, session started

### Route Protection

| Layer | File | Protects |
|-------|------|----------|
| Middleware | `middleware.ts` | All routes except `/login`, `/api/auth/*` |
| API Routes | Each route file | Uses `requireAuth()` helper |

```typescript
// lib/auth-helpers.ts
export async function requireAuth() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  
  if (!session) {
    throw new Error('Unauthorized');
  }
  
  return session;
}
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

Existing bot tables used for role verification:

| Table | Purpose |
|-------|---------|
| `User` | Discord user data (discord_id) |
| `Role` | Discord roles (role_id, name) |
| `UserRoles` | User-role junction (user_id, role_id) |

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
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // Role verification logic here
        },
      },
    },
  },
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

### Middleware

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Check for session cookie
  const sessionCookie = request.cookies.get('better-auth.session_token');
  
  if (!sessionCookie && !isPublicRoute(request.pathname)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
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

### "Access denied: You must have a moderator role"

1. Check your Discord account has a role with "mod" or "moderator" in the name
2. Verify the role exists in the `Role` table:
   ```sql
   SELECT * FROM "Role" WHERE name ILIKE '%mod%';
   ```
3. Verify user-role connection:
   ```sql
   SELECT * FROM "UserRoles" WHERE user_id = YOUR_DISCORD_ID;
   ```

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
