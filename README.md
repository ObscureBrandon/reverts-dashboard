# Reverts Dashboard

A Next.js dashboard for searching and analyzing Discord server messages with ticket integration.

## Features

- 🔍 **Instant Search** — Fuzzy text search with 150ms debounce
- 🎫 **Ticket Integration** — View messages by ticket context
- 👥 **Staff Filtering** — Filter to staff-only messages
- 🔐 **Discord Auth** — OAuth login with moderator role verification
- ⚡ **Optimized** — Trigram indexes for 10-100x faster queries
- 🔒 **Type-Safe API** — End-to-end types with ElysiaJS + Eden

## Quick Start

```bash
# Install
bun install

# Configure
cp .env.local.example .env.local
# Edit .env.local with your credentials

# Apply database indexes (recommended)
bun run db:migrate

# Run
bun dev
```

Open http://localhost:3000

## Environment Variables

```bash
# Required
DATABASE_URL="postgresql://user:password@host:5432/database"
DISCORD_CLIENT_ID="your_client_id"
DISCORD_CLIENT_SECRET="your_client_secret"
DISCORD_GUILD_ID="your_server_id"
BETTER_AUTH_SECRET="your_random_secret"
BETTER_AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_BETTER_AUTH_URL="http://localhost:3000"
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| API | ElysiaJS + Eden (type-safe) |
| UI | React 19, TailwindCSS 4 |
| Database | PostgreSQL + Drizzle ORM |
| Auth | better-auth + Discord OAuth |
| Runtime | Bun |

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](./docs/ARCHITECTURE.md) | System design and project structure |
| [Database](./docs/DATABASE.md) | Schema reference (22 tables) |
| [API](./docs/API.md) | REST API endpoints with Eden examples |
| [Performance](./docs/PERFORMANCE.md) | Optimization guide |
| [Authentication](./docs/AUTHENTICATION.md) | Discord OAuth setup |
| [Deployment](./docs/DEPLOYMENT.md) | Production deployment |
| [Development](./docs/DEVELOPMENT.md) | Dev patterns and troubleshooting |

## Scripts

```bash
bun dev          # Development server
bun run build    # Production build
bun start        # Production server
bun run lint     # ESLint
bun run db:migrate  # Apply database indexes
```

## Project Structure

```
src/
├── app/                  # Next.js App Router
│   ├── api/[[...slugs]]/ # ElysiaJS catch-all handler
│   ├── components/       # React components
│   ├── login/            # Login page
│   ├── messages/         # Message search UI
│   ├── tickets/          # Ticket pages
│   └── users/            # User management UI
│
└── lib/
    ├── db/
    │   ├── schema.ts     # All 22 tables (auth + bot)
    │   ├── queries.ts    # Query functions
    │   └── index.ts      # DB connection
    ├── elysia/           # ElysiaJS modules
    │   ├── auth.ts       # Auth macro plugin
    │   └── routes/       # API route modules
    ├── hooks/            # React Query hooks
    ├── eden.ts           # Eden treaty client
    └── auth.ts           # Auth configuration

docs/                     # Documentation
drizzle/                  # Auth migrations
migrations/               # Performance indexes
```

## API Architecture

The API uses **ElysiaJS** with the **Eden treaty client** for end-to-end type safety:

```typescript
import { api } from '@/lib/eden'

// Fully typed API calls
const { data, error } = await api.users.get({ query: { page: '1' } })
const { data } = await api.users({ id: '123' }).popover.get()
```

See [API Documentation](./docs/API.md) for details.

## Database

The dashboard connects to an existing PostgreSQL database:

- **Auth tables** (4) — Managed by this dashboard via Drizzle
- **Bot tables** (18) — Managed by Discord bot via Prisma

See [Database Documentation](./docs/DATABASE.md) for schema details.

## License

MIT
