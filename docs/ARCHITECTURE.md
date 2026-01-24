# Architecture

> System architecture and technical design of the Reverts Dashboard.

## Overview

The Reverts Dashboard is a Next.js frontend for searching and analyzing Discord server messages with ticket integration. It queries an existing PostgreSQL database managed by a Discord bot (via Prisma) and provides a fast, searchable interface.

```
┌─────────────────────────────────────────────────────────────┐
│                     Reverts Dashboard                        │
├─────────────────────────────────────────────────────────────┤
│  Next.js 16 (App Router)                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Frontend   │  │  API Routes  │  │   Auth       │      │
│  │  React 19    │  │  REST API    │  │ better-auth  │      │
│  │  TailwindCSS │  │              │  │ Discord OAuth│      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│           │                │                 │              │
│           └────────────────┼─────────────────┘              │
│                            │                                │
│  ┌─────────────────────────▼────────────────────────────┐  │
│  │              Drizzle ORM (src/lib/db/)                 │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────────┐  │  │
│  │  │  schema.ts │  │ queries.ts │  │    index.ts    │  │  │
│  │  │ 22 tables  │  │  search    │  │  connection    │  │  │
│  │  └────────────┘  └────────────┘  └────────────────┘  │  │
│  └──────────────────────────┬───────────────────────────┘  │
└─────────────────────────────┼───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     PostgreSQL                               │
│  ┌─────────────────────┐  ┌─────────────────────────────┐  │
│  │  Auth Tables        │  │  Bot Tables                  │  │
│  │  (Drizzle managed)  │  │  (Prisma managed by bot)     │  │
│  │  - auth_user        │  │  - User, Message, Ticket     │  │
│  │  - auth_session     │  │  - Channel, Role, Panel      │  │
│  │  - auth_account     │  │  - Infractions, Shahadas     │  │
│  │  - auth_verification│  │  - Support system tables     │  │
│  └─────────────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Framework | Next.js (App Router) | 16.x |
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
│   │   ├── api/                  # API Routes
│   │   │   ├── auth/[...all]/    # Auth endpoints
│   │   │   ├── messages/         # Message search API
│   │   │   ├── tickets/          # Ticket API
│   │   │   └── users/            # User lookup API
│   │   ├── components/           # React components
│   │   ├── login/                # Login page
│   │   ├── messages/             # Message search UI
│   │   ├── tickets/              # Ticket pages
│   │   ├── layout.tsx            # Root layout
│   │   ├── page.tsx              # Home page
│   │   └── globals.css           # Global styles
│   │
│   └── lib/                      # Shared utilities
│       ├── db/
│       │   ├── schema.ts         # Drizzle schema (all 22 tables)
│       │   ├── queries.ts        # Query functions
│       │   └── index.ts          # DB connection
│       ├── hooks/                # React hooks
│       ├── ai/                   # AI utilities
│       ├── auth.ts               # Server auth config
│       ├── auth-client.ts        # Client auth hooks
│       └── auth-helpers.ts       # Auth utilities
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
│   ├── 0000_initial_auth_tables.sql
│   └── meta/
│
├── migrations/                   # Performance indexes
│   └── 001_add_search_indexes.sql
│
├── public/                       # Static assets
├── drizzle.config.ts             # Drizzle Kit config
├── next.config.ts                # Next.js config
├── tsconfig.json                 # TypeScript config
└── package.json                  # Dependencies
```

## Key Design Decisions

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

### postgres.js Driver

Chosen over `pg` for:
- ESM support
- Better TypeScript integration
- Faster performance
- Cleaner API

### 150ms Debounce

- Balance between instant feel and preventing request spam
- Tested from 500ms → 150ms after performance optimization
- Typical typing pause is ~200ms between words

### Trigram Index over Full-Text Search

- Better for typos and partial matches
- No text preprocessing needed
- Very fast with GIN index
- Works with any query pattern

## Data Flow

### Message Search Flow

```
User types → Debounce (150ms) → API Request
                                    ↓
                             Cancel previous request
                                    ↓
                             /api/messages?q=...
                                    ↓
                             Auth check (session)
                                    ↓
                             searchMessages() query
                                    ↓
                             SQL with trigram index
                                    ↓
                             JSON response
                                    ↓
                             Optimistic UI update
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
