# NextJS to ElysiaJS Migration Guide

> Comprehensive guide for migrating from Next.js API routes to ElysiaJS with Eden client for end-to-end type safety.

## Overview

This guide covers migrating a Next.js application from traditional API routes (`app/api/.../route.ts`) to ElysiaJS with Eden treaty client. The migration provides:

- **End-to-end type safety** without code generation
- **Better performance** with Bun-native runtime
- **Cleaner routing** with composable plugins
- **Automatic validation** with TypeBox schemas

---

## Architecture After Migration

```
┌─────────────────────────────────────────────────────────────────────┐
│  Client (React/Next.js)                                              │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Eden Treaty Client (@/lib/eden.ts)                          │    │
│  │  - Type-safe API calls                                       │    │
│  │  - Automatic error handling                                  │    │
│  │  - Works in SSR and client                                   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                    │                                  │
└────────────────────────────────────┼──────────────────────────────────┘
                                     │ HTTP
┌────────────────────────────────────┼──────────────────────────────────┐
│  ElysiaJS Server                   ▼                                  │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Catch-all Handler (app/api/[[...slugs]]/route.ts)          │    │
│  │  └─> app.fetch (Elysia → Next.js adapter)                   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                    │                                                  │
│  ┌─────────────────┼───────────────────────────────────────────┐    │
│  │  Route Modules  ▼                                            │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │    │
│  │  │  users   │ │ tickets  │ │ messages │ │  roles/etc   │   │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                    │                                                  │
│  ┌─────────────────┼───────────────────────────────────────────┐    │
│  │  Auth Plugin    ▼                                            │    │
│  │  (Macro-based authentication)                                │    │
│  │  - Session validation                                        │    │
│  │  - Injects user/session into context                         │    │
│  └─────────────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Step 1: Install Dependencies

```bash
# Using bun (recommended)
bun add elysia @elysiajs/eden

# Using npm
npm install elysia @elysiajs/eden
```

---

## Step 2: Create the Catch-All Route Handler

Delete all existing API route files and create a single catch-all handler that mounts the ElysiaJS app:

**File: `src/app/api/[[...slugs]]/route.ts`**

```typescript
import { Elysia } from 'elysia'

// Import your route modules
import { usersRoutes } from '@/lib/elysia/routes/users'
import { ticketsRoutes } from '@/lib/elysia/routes/tickets'
import { messagesRoutes } from '@/lib/elysia/routes/messages'
// Import auth if needed
import { auth } from '@/lib/auth'
import { authMacro } from '@/lib/elysia/auth'

// Main API routes with /api prefix
const apiRoutes = new Elysia({ prefix: '/api' })
  .use(authMacro)      // Auth macro available to all routes
  .use(usersRoutes)     // /api/users/*
  .use(ticketsRoutes)   // /api/tickets/*
  .use(messagesRoutes)  // /api/messages/*

// Root app - mounts auth handler + API routes
const app = new Elysia()
  .mount(auth.handler)  // Optional: for better-auth integration
  .use(apiRoutes)

// CRITICAL: Export the App type for Eden client type inference
export type App = typeof app

// Export handlers for all HTTP methods
export const GET = app.fetch
export const POST = app.fetch
export const PUT = app.fetch
export const DELETE = app.fetch
export const PATCH = app.fetch
```

> [!IMPORTANT]
> The `export type App = typeof app` line is essential. This is what enables Eden's end-to-end type safety.

---

## Step 3: Create the Eden Treaty Client

**File: `src/lib/eden.ts`**

```typescript
import type { App } from '@/app/api/[[...slugs]]/route'
import { treaty } from '@elysiajs/eden'

/**
 * Type-safe API client using Eden treaty
 * 
 * Uses isomorphic pattern:
 * - Server: Works in SSR
 * - Client: HTTP calls through the network
 */
export const api = treaty<App>(
  typeof process !== 'undefined' && process.env.BETTER_AUTH_URL
    ? process.env.BETTER_AUTH_URL
    : typeof window !== 'undefined'
      ? window.location.origin
      : 'http://localhost:3000'
).api
```

> [!NOTE]
> The `.api` at the end is required because the routes are prefixed with `/api`. If your routes don't have a prefix, omit this.

---

## Step 4: Create Route Modules

Route modules are the core of ElysiaJS. Each module is an `Elysia` instance with its own prefix, combined using `.use()`.

### Basic Route Module Structure

**File: `src/lib/elysia/routes/example.ts`**

```typescript
import { Elysia } from 'elysia'
import { authMacro } from '@/lib/elysia/auth'

export const exampleRoutes = new Elysia({ prefix: '/example' })
  .use(authMacro)
  
  // GET /api/example
  .get('/', async ({ user }) => {
    return { message: 'Hello', userId: user.id }
  }, { auth: true })
  
  // GET /api/example/:id
  .get('/:id', async ({ params }) => {
    const { id } = params
    return { id }
  }, { auth: true })
  
  // POST /api/example
  .post('/', async ({ body }) => {
    return { created: true }
  }, { auth: true })
```

---

## Step 5: Authentication Macro

Create a reusable auth macro that validates sessions and injects user context:

**File: `src/lib/elysia/auth.ts`**

```typescript
import { auth } from '@/lib/auth'  // Your auth library (e.g., better-auth)
import { Elysia } from 'elysia'

/**
 * Auth macro for Elysia routes
 * Provides user and session context to protected routes
 */
export const authMacro = new Elysia({ name: 'auth-macro' })
  .macro({
    auth: {
      async resolve({ status, request: { headers } }) {
        const session = await auth.api.getSession({ headers })

        if (!session) {
          return status(401)
        }

        return {
          user: session.user,
          session: session.session
        }
      }
    }
  })
```

### Using the Auth Macro

```typescript
export const protectedRoutes = new Elysia({ prefix: '/protected' })
  .use(authMacro)
  
  // Protected route - requires { auth: true }
  .get('/secret', ({ user, session }) => {
    // user and session are typed and available
    return { userId: user.id, sessionId: session.id }
  }, { auth: true })
  
  // Public route - no auth option
  .get('/public', () => {
    return { message: 'Anyone can access this' }
  })
```

---

## Migration Patterns: Before & After

### Pattern 1: Simple GET Route

**Before (Next.js API Route):**

```typescript
// app/api/users/route.ts
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page = searchParams.get('page') || '1'
  const limit = searchParams.get('limit') || '50'
  
  const users = await db.query.users.findMany({
    limit: parseInt(limit),
    offset: (parseInt(page) - 1) * parseInt(limit),
  })
  
  return NextResponse.json({ users })
}
```

**After (ElysiaJS Route):**

```typescript
// lib/elysia/routes/users.ts
import { Elysia } from 'elysia'
import { authMacro } from '@/lib/elysia/auth'

export const usersRoutes = new Elysia({ prefix: '/users' })
  .use(authMacro)
  .get('/', async ({ query }) => {
    const page = parseInt(query.page || '1')
    const limit = Math.min(parseInt(query.limit || '50'), 100)
    
    const users = await db.query.users.findMany({
      limit,
      offset: (page - 1) * limit,
    })
    
    return { users }
  }, { auth: true })
```

**Client Usage (Eden):**

```typescript
const { data, error } = await api.users.get({
  query: { page: '1', limit: '50' }
})
// data.users is fully typed!
```

---

### Pattern 2: GET with Path Parameters

**Before (Next.js API Route):**

```typescript
// app/api/users/[id]/route.ts
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  
  const user = await db.query.users.findFirst({
    where: eq(users.id, BigInt(id)),
  })
  
  if (!user) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  
  return NextResponse.json({ user })
}
```

**After (ElysiaJS Route):**

```typescript
// lib/elysia/routes/users.ts
export const usersRoutes = new Elysia({ prefix: '/users' })
  .use(authMacro)
  
  // GET /api/users/:id
  .get('/:id', async ({ params, set }) => {
    const userId = BigInt(params.id)
    
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    })
    
    if (!user) {
      set.status = 404
      return { error: 'User not found' }
    }
    
    return { user }
  }, { auth: true })
```

**Client Usage (Eden):**

```typescript
// Path params use function call syntax
const { data, error } = await api.users({ id: '123456789' }).get()
// data.user is fully typed!
```

---

### Pattern 3: GET with Path Params AND Query Params

**Before (Next.js API Route):**

```typescript
// app/api/users/[id]/route.ts
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const full = searchParams.get('full') === 'true'
  
  // ...fetch user with optional full details
}
```

**After (ElysiaJS Route):**

```typescript
export const usersRoutes = new Elysia({ prefix: '/users' })
  .use(authMacro)
  
  .get('/:id', async ({ params, query }) => {
    const userId = BigInt(params.id)
    const fullProfile = query.full === 'true'
    
    // ...fetch user with optional full details
  }, { auth: true })
```

**Client Usage (Eden):**

```typescript
// Combine path params (function call) with query params (object)
const { data } = await api.users({ id: '123456789' }).get({
  query: { full: 'true' }
})
```

---

### Pattern 4: Nested Path Parameters

**Before (Next.js API Route):**

```typescript
// app/api/users/[id]/ticket-stats/route.ts
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const stats = await getUserTicketStats(BigInt(id))
  return NextResponse.json(stats)
}
```

**After (ElysiaJS Route):**

```typescript
export const usersRoutes = new Elysia({ prefix: '/users' })
  .use(authMacro)
  
  // GET /api/users/:id/ticket-stats
  .get('/:id/ticket-stats', async ({ params, set }) => {
    const userId = BigInt(params.id)
    const stats = await getUserTicketStats(userId)
    
    set.headers['Cache-Control'] = 'public, s-maxage=60, stale-while-revalidate=120'
    
    return {
      open: stats.open,
      closed: stats.closed,
    }
  }, { auth: true })
```

**Client Usage (Eden):**

```typescript
// Hyphenated paths use bracket notation
const { data } = await api.users({ id: '123456789' })['ticket-stats'].get()
```

---

### Pattern 5: POST Request

**Before (Next.js API Route):**

```typescript
// app/api/tickets/[id]/summary/route.ts
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  
  const { summary, tokensUsed, model } = await generateTicketSummary(parseInt(id))
  
  await db.update(tickets)
    .set({ summary, summaryGeneratedAt: new Date() })
    .where(eq(tickets.id, parseInt(id)))
  
  return NextResponse.json({ success: true, summary, tokensUsed, model })
}
```

**After (ElysiaJS Route):**

```typescript
export const ticketsRoutes = new Elysia({ prefix: '/tickets' })
  
  // POST /api/tickets/:id/summary
  .post('/:id/summary', async ({ params, set }) => {
    const ticketId = parseInt(params.id)
    
    if (isNaN(ticketId)) {
      set.status = 400
      return { error: 'Invalid ticket ID' }
    }
    
    const { summary, tokensUsed, model } = await generateTicketSummary(ticketId)
    
    await db.update(tickets)
      .set({
        summary,
        summaryGeneratedAt: new Date(),
        summaryModel: model,
        summaryTokensUsed: tokensUsed,
      })
      .where(eq(tickets.id, ticketId))
    
    return {
      success: true,
      summary,
      tokensUsed,
      model,
    }
  })
```

**Client Usage (Eden):**

```typescript
const { data, error } = await api.tickets({ id: '123' }).summary.post()
// data.summary, data.tokensUsed, data.model are typed
```

---

### Pattern 6: POST with Request Body

**Before (Next.js API Route):**

```typescript
// app/api/users/route.ts
export async function POST(request: Request) {
  const body = await request.json()
  const { name, email } = body
  
  const user = await db.insert(users).values({ name, email }).returning()
  
  return NextResponse.json({ user: user[0] })
}
```

**After (ElysiaJS Route with Validation):**

```typescript
import { t } from 'elysia'

export const usersRoutes = new Elysia({ prefix: '/users' })
  .use(authMacro)
  
  .post('/', async ({ body }) => {
    const user = await db.insert(users)
      .values({ name: body.name, email: body.email })
      .returning()
    
    return { user: user[0] }
  }, {
    auth: true,
    body: t.Object({
      name: t.String(),
      email: t.String({ format: 'email' }),
    })
  })
```

**Client Usage (Eden):**

```typescript
const { data, error } = await api.users.post({
  name: 'John Doe',
  email: 'john@example.com'
})
```

---

### Pattern 7: Setting Response Headers

**Before (Next.js API Route):**

```typescript
export async function GET(request: Request) {
  const data = await fetchData()
  
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  })
}
```

**After (ElysiaJS Route):**

```typescript
.get('/data', async ({ set }) => {
  const data = await fetchData()
  
  // Set headers via the `set` context object
  set.headers['Cache-Control'] = 'public, s-maxage=60, stale-while-revalidate=300'
  
  return data
})
```

---

### Pattern 8: Error Responses

**Before (Next.js API Route):**

```typescript
export async function GET(request: Request) {
  try {
    const data = await fetchData()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
```

**After (ElysiaJS Route):**

```typescript
.get('/data', async ({ set }) => {
  try {
    const data = await fetchData()
    return data
  } catch (error) {
    console.error('Error fetching data:', error)
    // Option 1: Set status and return error object
    set.status = 500
    return { error: 'Something went wrong' }
    
    // Option 2: Throw an error (Elysia handles it)
    // throw new Error('Something went wrong')
  }
})
```

---

## Frontend Integration with React Query

### Query Hook Pattern

**File: `src/lib/hooks/queries/useUsers.ts`**

```typescript
'use client'

import { api } from '@/lib/eden'
import { useQuery } from '@tanstack/react-query'

export function useUser(userId: string | undefined) {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required')

      const { data, error } = await api.users({ id: userId }).get()

      if (error) {
        throw new Error('Failed to fetch user')
      }

      return data
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}
```

### Query with Query Parameters

```typescript
export function useUsers(params: { page?: number; limit?: number; q?: string }) {
  const { page = 1, limit = 50, q } = params

  return useQuery({
    queryKey: ['users', { page, limit, q }],
    queryFn: async () => {
      const query: Record<string, string> = {
        page: page.toString(),
        limit: limit.toString(),
      }
      
      if (q) query.q = q

      const { data, error } = await api.users.get({ query })

      if (error) {
        throw new Error('Failed to fetch users')
      }

      return data
    },
    staleTime: 30 * 1000, // 30 seconds
  })
}
```

### Mutation Hook Pattern

**File: `src/lib/hooks/mutations/useTicketMutations.ts`**

```typescript
'use client'

import { api } from '@/lib/eden'
import { useMutation, useQueryClient } from '@tanstack/react-query'

export function useGenerateTicketSummary(ticketId: string | number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await api.tickets({ id: String(ticketId) }).summary.post()

      if (error) {
        throw new Error('Failed to generate summary')
      }

      return data
    },
    onSuccess: () => {
      // Invalidate related queries to refetch data
      queryClient.invalidateQueries({ queryKey: ['ticket', String(ticketId)] })
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })
}
```

### Prefetching Pattern

```typescript
export function usePrefetchUser() {
  const queryClient = useQueryClient()

  const prefetchUser = (userId: string) => {
    queryClient.prefetchQuery({
      queryKey: ['user', userId],
      queryFn: async () => {
        const { data, error } = await api.users({ id: userId }).get()
        if (error) throw new Error('Failed to fetch user')
        return data
      },
      staleTime: 2 * 60 * 1000,
    })
  }

  return { prefetchUser }
}
```

---

## Eden Client API Reference

### GET Requests

```typescript
// Simple GET
const { data, error } = await api.users.get()

// GET with query parameters
const { data, error } = await api.users.get({
  query: { page: '1', limit: '50', q: 'search' }
})

// GET with path parameters
const { data, error } = await api.users({ id: '123' }).get()

// GET with path AND query parameters
const { data, error } = await api.users({ id: '123' }).get({
  query: { full: 'true' }
})

// Nested paths
const { data } = await api.users({ id: '123' }).popover.get()

// Hyphenated paths (use bracket notation)
const { data } = await api.users({ id: '123' })['ticket-stats'].get()
```

### POST Requests

```typescript
// Simple POST
const { data, error } = await api.tickets({ id: '123' }).summary.post()

// POST with body
const { data, error } = await api.users.post({
  name: 'John',
  email: 'john@example.com'
})
```

### Error Handling

```typescript
const { data, error } = await api.users.get()

if (error) {
  // error is typed based on possible error responses
  console.error('API error:', error)
  return
}

// data is fully typed after error check
console.log(data.users)
```

---

## File Structure

After migration, your project structure should look like:

```
src/
├── app/
│   ├── api/
│   │   └── [[...slugs]]/
│   │       └── route.ts           # Single catch-all handler
│   ├── layout.tsx
│   └── page.tsx
│
└── lib/
    ├── eden.ts                     # Eden treaty client
    ├── elysia/
    │   ├── auth.ts                 # Auth macro plugin
    │   └── routes/
    │       ├── users.ts            # User routes
    │       ├── tickets.ts          # Ticket routes
    │       ├── messages.ts         # Message routes
    │       └── ...                 # Other route modules
    └── hooks/
        ├── queries/
        │   ├── useUsers.ts         # User query hooks
        │   ├── useTickets.ts       # Ticket query hooks
        │   └── ...
        └── mutations/
            ├── useUserMutations.ts
            └── ...
```

---

## Common Issues and Solutions

### Issue: Type Errors After Adding New Routes

**Symptoms:** Eden client shows type errors after adding new routes.

**Solution:**
1. Restart the TypeScript server in your IDE
2. Make sure the route is registered in `app/api/[[...slugs]]/route.ts`
3. Check that the `App` type is properly exported

### Issue: Query Parameters Not Type-Safe

**Note:** Eden does not provide automatic type inference for query parameters. They are typed as `string | undefined`. Use validation at the route level:

```typescript
import { t } from 'elysia'

.get('/users', async ({ query }) => {
  // ...
}, {
  query: t.Object({
    page: t.Optional(t.String()),
    limit: t.Optional(t.String()),
  })
})
```

### Issue: Path Parameters with Special Characters

For hyphenated paths like `/ticket-stats`, use bracket notation:

```typescript
// Correct
api.users({ id: '123' })['ticket-stats'].get()

// Incorrect - will fail
api.users({ id: '123' }).ticketStats.get()
```

### Issue: Empty 401 Response

If your auth macro returns `status(401)` without a body, clients may see an empty error. Consider returning a structured error:

```typescript
export const authMacro = new Elysia({ name: 'auth-macro' })
  .macro({
    auth: {
      async resolve({ status, request: { headers } }) {
        const session = await auth.api.getSession({ headers })

        if (!session) {
          // Return structured error instead of just status
          return {
            ...status(401),
            error: 'Unauthorized',
          }
        }

        return {
          user: session.user,
          session: session.session
        }
      }
    }
  })
```

---

## Checklist for Migration

- [ ] Install `elysia` and `@elysiajs/eden` packages
- [ ] Create catch-all route handler at `app/api/[[...slugs]]/route.ts`
- [ ] Export `App` type from catch-all handler
- [ ] Create Eden client at `lib/eden.ts`
- [ ] Create auth macro at `lib/elysia/auth.ts` (if using authentication)
- [ ] Migrate each API route to a route module in `lib/elysia/routes/`
- [ ] Register all route modules in the catch-all handler
- [ ] Update all frontend `fetch()` calls to use Eden client
- [ ] Update React Query hooks to use Eden client
- [ ] Delete old API route files
- [ ] Test all endpoints
- [ ] Verify TypeScript types are properly inferred

---

## Related Documentation

- [ElysiaJS Documentation](https://elysiajs.com/)
- [Eden Treaty Documentation](https://elysiajs.com/eden/treaty.html)
- [Architecture Overview](./ARCHITECTURE.md)
- [API Reference](./API.md)
