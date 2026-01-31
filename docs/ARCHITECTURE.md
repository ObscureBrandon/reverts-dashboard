# Architecture

> System architecture and technical design of the Reverts Dashboard.

## Overview

The Reverts Dashboard is a Next.js frontend for searching and analyzing Discord server messages with ticket integration. It uses **ElysiaJS** for the API layer, providing end-to-end type safety via the **Eden treaty client**.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Reverts Dashboard                            │
├─────────────────────────────────────────────────────────────────────┤
│  Next.js 16 (App Router)                                             │
│  ┌──────────────┐  ┌───────────────────┐  ┌──────────────────┐     │
│  │   Frontend   │  │   ElysiaJS API    │  │       Auth       │     │
│  │   React 19   │  │  Modular Routes   │  │   better-auth    │     │
│  │  TailwindCSS │  │  Eden Type Safety │  │  Discord OAuth   │     │
│  └──────────────┘  └───────────────────┘  └──────────────────┘     │
│           │                 │                      │                │
│           │    ┌────────────┴────────────┐        │                │
│           │    │   Eden Treaty Client    │        │                │
│           └────┤   End-to-End Types      ├────────┘                │
│                └────────────┬────────────┘                          │
│                             │                                        │
│  ┌──────────────────────────▼─────────────────────────────────┐    │
│  │                   Drizzle ORM (src/lib/db/)                 │    │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────────┐        │    │
│  │  │  schema.ts │  │ queries.ts │  │    index.ts    │        │    │
│  │  │ 22 tables  │  │  search    │  │  connection    │        │    │
│  │  └────────────┘  └────────────┘  └────────────────┘        │    │
│  └────────────────────────────┬───────────────────────────────┘    │
└───────────────────────────────┼─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          PostgreSQL                                  │
│  ┌─────────────────────┐  ┌─────────────────────────────────────┐  │
│  │  Auth Tables        │  │  Bot Tables                          │  │
│  │  (Drizzle managed)  │  │  (Prisma managed by bot)             │  │
│  │  - auth_user        │  │  - User, Message, Ticket             │  │
│  │  - auth_session     │  │  - Channel, Role, Panel              │  │
│  │  - auth_account     │  │  - Infractions, Shahadas             │  │
│  │  - auth_verification│  │  - Support system tables             │  │
│  └─────────────────────┘  └─────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Framework | Next.js (App Router) | 16.x |
| API | ElysiaJS + Eden | Latest |
| UI | React | 19.x |
| Styling | TailwindCSS | 4.x |
| Language | TypeScript | 5.x |
| Runtime | Bun | Latest |
| ORM | Drizzle ORM | 0.44.x |
| Database | PostgreSQL | 14+ |
| Auth | better-auth | Latest |

## Project Structure

```
reverts-dashboard/
├── src/                          # Source code
│   ├── app/                      # Next.js App Router
│   │   ├── api/[[...slugs]]/     # ElysiaJS catch-all handler
│   │   │   └── route.ts          # Mounts Elysia app, exports types
│   │   ├── components/           # React components
│   │   ├── login/                # Login page
│   │   ├── messages/             # Message search UI
│   │   ├── tickets/              # Ticket pages
│   │   ├── users/                # User management UI
│   │   ├── layout.tsx            # Root layout
│   │   ├── page.tsx              # Home page
│   │   └── globals.css           # Global styles
│   │
│   └── lib/                      # Shared utilities
│       ├── db/
│       │   ├── schema.ts         # Drizzle schema (all 22 tables)
│       │   ├── queries.ts        # Query functions
│       │   └── index.ts          # DB connection
│       ├── elysia/               # ElysiaJS modules
│       │   ├── auth.ts           # Auth macro plugin
│       │   └── routes/           # Route modules
│       │       ├── users.ts      # User endpoints
│       │       ├── tickets.ts    # Ticket endpoints
│       │       ├── messages.ts   # Message endpoints
│       │       ├── roles.ts      # Role endpoints
│       │       ├── panels.ts     # Panel endpoints
│       │       └── relations.ts  # Relations endpoints
│       ├── hooks/                # React Query hooks
│       │   ├── queries/          # Data fetching hooks
│       │   └── mutations/        # Data mutation hooks
│       ├── eden.ts               # Eden treaty client
│       ├── auth.ts               # Server auth config
│       └── auth-client.ts        # Client auth hooks
│
├── docs/                         # Documentation
│   ├── ARCHITECTURE.md           # This file
│   ├── DATABASE.md               # Schema reference
│   ├── API.md                    # API documentation
│   ├── PERFORMANCE.md            # Optimization guide
│   ├── AUTHENTICATION.md         # Auth setup
│   ├── DEPLOYMENT.md             # Deployment guide
│   └── DEVELOPMENT.md            # Dev patterns
│
├── drizzle/                      # Auth migrations
├── migrations/                   # Performance indexes
├── public/                       # Static assets
├── drizzle.config.ts             # Drizzle Kit config
├── next.config.ts                # Next.js config
├── tsconfig.json                 # TypeScript config
└── package.json                  # Dependencies
```

## Key Design Decisions

### ElysiaJS over Next.js API Routes

| Aspect | Reason |
|--------|--------|
| Type Safety | Eden provides end-to-end types without codegen |
| Performance | Bun-native, faster than Node.js handlers |
| Modularity | Clean route composition with plugins |
| DX | Better error handling, validation, and middleware |
| Flexibility | Easy to add WebSocket, GraphQL, etc. later |

### Eden Treaty Client

The Eden client replaces raw `fetch()` calls:

```typescript
// Before (manual fetch)
const response = await fetch('/api/users?page=1')
const data = await response.json()

// After (Eden - fully typed)
const { data, error } = await api.users.get({ query: { page: '1' } })
```

Benefits:
- **Type inference** from server to client
- **Automatic error handling**
- **Query/path params** are type-checked
- **Works in SSR and client**

### Drizzle ORM over Prisma Client

| Aspect | Reason |
|--------|--------|
| Coexistence | Doesn't require modifying the bot's Prisma setup |
| Type Safety | Full TypeScript inference without codegen |
| Performance | More control over SQL queries |
| Lightweight | Smaller bundle than Prisma Client |

### Unified Schema File

All 22 tables are defined in a single `src/lib/db/schema.ts`:
- **Auth tables** (4) - Dashboard-owned, Drizzle migrations
- **Bot tables** (18) - Bot-owned via Prisma, dashboard has read/write access

The `drizzle.config.ts` uses `tablesFilter: ['auth_*']` to ensure migrations only affect auth tables.

### Auth Macro Pattern

Authentication is handled via a reusable Elysia macro:

```typescript
// lib/elysia/auth.ts
export const authMacro = new Elysia({ name: 'auth-macro' })
  .macro({
    auth: {
      async resolve({ status, request: { headers } }) {
        const session = await auth.api.getSession({ headers })
        if (!session) return status(401)
        return { user: session.user, session: session.session }
      }
    }
  })

// Usage in routes
.get('/protected', ({ user }) => {
  return { userId: user.id }
}, { auth: true })
```

## Data Flow

### API Request Flow

```
Eden Client call → HTTP Request
                        ↓
               Next.js catch-all route
                        ↓
               ElysiaJS app.fetch()
                        ↓
               Auth macro (if { auth: true })
                        ↓
               Route handler (user in context)
                        ↓
               Drizzle query
                        ↓
               JSON response
                        ↓
               Eden client (typed response)
```

### React Query Integration

```typescript
// Hook using Eden client
export function useUsers(params) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: async () => {
      const { data, error } = await api.users.get({ query: params })
      if (error) throw new Error('Failed to fetch users')
      return data
    }
  })
}
```

### Authentication Flow

```
User visits → Middleware check → No session?
                                     ↓
                              Redirect to /login
                                     ↓
                              Discord OAuth
                                     ↓
                              Role verification
                              (must have mod role)
                                     ↓
                              Session created
                                     ↓
                              Redirect to dashboard
```

## Related Documentation

- [Database Schema](./DATABASE.md)
- [API Reference](./API.md)
- [Performance Guide](./PERFORMANCE.md)
- [Authentication Setup](./AUTHENTICATION.md)
