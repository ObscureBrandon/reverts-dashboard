# Reverts Dashboard - Project Documentation

## Project Overview

**Name:** Reverts Dashboard  
**Purpose:** A Next.js frontend dashboard for searching and analyzing Discord server messages with ticket integration  
**Tech Stack:** Next.js 16, React 19, TypeScript, Drizzle ORM, PostgreSQL, TailwindCSS  
**Runtime:** Bun  

This dashboard queries messages from a Discord bot database (managed by Prisma in another project) and provides a fast, searchable interface for viewing message history, ticket context, and staff interactions.

---

## Architecture

### Frontend (Next.js App Router)
- **Framework:** Next.js 16 with App Router
- **UI:** React 19, TailwindCSS 4
- **State Management:** React hooks (useState, useEffect, useCallback)
- **Performance:** Debounced search (150ms), optimistic UI, request cancellation

### Backend (API Routes)
- **Database Client:** Drizzle ORM with postgres.js driver
- **Query Optimization:** SQL-level filtering, staff role caching (5-min TTL)
- **API:** RESTful endpoint at `/api/messages`

### Database
- **DBMS:** PostgreSQL
- **Schema Management:** Prisma (in Discord bot project)
- **Query Layer:** Drizzle ORM (this dashboard)
- **Performance:** Trigram GIN indexes, composite indexes for common queries

---

## Project Structure

```
reverts-dashboard/
├── app/                          # Next.js App Router
│   ├── api/
│   │   └── messages/
│   │       └── route.ts          # Message search API endpoint
│   ├── messages/
│   │   └── page.tsx              # Main search dashboard UI
│   ├── layout.tsx                # Root layout with global styles
│   ├── page.tsx                  # Home page (redirects to /messages)
│   ├── globals.css               # Global TailwindCSS styles
│   └── favicon.ico
│
├── lib/                          # Shared utilities
│   ├── db/
│   │   ├── index.ts              # Database connection & exports
│   │   ├── schema.ts             # Drizzle schema (maps to Prisma tables)
│   │   └── queries.ts            # Database query functions
│   └── hooks/
│       └── useDebounce.ts        # Debounce hook for search input
│
├── migrations/
│   └── 001_add_search_indexes.sql # Performance optimization indexes
│
├── prisma/
│   └── schema.prisma             # Prisma schema (reference only - from bot)
│
├── public/                       # Static assets
│
├── .gitignore
├── bun.lockb                     # Bun lockfile
├── drizzle.config.ts             # Drizzle Kit configuration
├── eslint.config.mjs             # ESLint configuration
├── next.config.ts                # Next.js configuration
├── package.json                  # Dependencies & scripts
├── postcss.config.mjs            # PostCSS configuration
├── tsconfig.json                 # TypeScript configuration
├── README.md                     # User-facing documentation
├── PERFORMANCE.md                # Performance optimization guide
└── OPTIMIZATION_SUMMARY.md       # Performance changes summary
```

---

## Key Files & Their Purpose

### Frontend Components

#### `app/messages/page.tsx` (737 lines)
**Purpose:** Main message search dashboard

**Key Features:**
- Search input with 150ms debounce
- Staff-only filter toggle
- Real-time search with optimistic UI
- Pagination (50 messages per page)
- Discord mention rendering (users, roles, channels)
- Interactive mention popovers with copy-to-clipboard
- Avatar display with initials fallback
- "Jump to Message" Discord deep links

**Key State:**
- `searchQuery`: Current search input
- `staffOnly`: Filter toggle for staff messages
- `messages`: Array of message results
- `mentions`: Lookup maps for users/roles/channels
- `modalData`: Popover state for mention clicks
- `page`: Current pagination page

**Performance Optimizations:**
- 150ms debounce (line 438)
- AbortController for request cancellation (lines 518-522)
- Optimistic UI - only shows loading on first load (lines 467-470)
- Memoized mention click handler (lines 440-463)

**Components:**
- `Avatar`: User avatar with fallback to initials
- `MentionPopover`: Info popover for clicked mentions
- `Mention`: Styled mention chips for users/roles/channels
- `parseMessageContent`: Parses Discord mention syntax into React components

#### `app/api/messages/route.ts` (99 lines)
**Purpose:** API endpoint for message search

**Endpoint:** `GET /api/messages`

**Query Parameters:**
- `q`: Search query string
- `staffOnly`: Filter to staff messages (true/false)
- `ticketId`: Filter by ticket ID
- `channelId`: Filter by channel ID
- `page`: Page number (default: 1)
- `limit`: Results per page (default: 50)

**Response Schema:**
```typescript
{
  messages: Message[],
  mentions: MentionLookup,
  pagination: {
    total: number,
    page: number,
    limit: number,
    totalPages: number
  },
  guildId: string | null  // For Discord deep links
}
```

**Performance Features:**
- Staff role ID caching (5-minute TTL, lines 5-24)
- Single efficient query with SQL-level filtering
- Parallel mention lookup
- Env var for Discord guild ID

---

### Database Layer

#### `lib/db/schema.ts` (161 lines)
**Purpose:** Drizzle ORM schema definitions

**Tables Defined:**
1. **users** (User) - Discord user info
   - discordId (PK), name, displayName, displayAvatar, nick, inGuild, createdAt

2. **messages** (Message) - Core message data
   - messageId (PK), content, embeds, attachments, mentions arrays
   - authorId (FK → users), channelId (FK → channels)
   - isDeleted, isDm, createdAt, categoryId
   - Indexes: author, channel, created_at

3. **channels** (Channel) - Discord channels
   - channelId (PK), name, categoryId, position
   - isCategory, isDm, deleted, deletedAt, createdAt
   - Index: categoryId

4. **tickets** (Ticket) - Support tickets
   - id (PK), channelId (FK → channels, unique), authorId (FK → users)
   - panelId (FK → panels), status, sequence
   - closedById, deletedById, timestamps
   - Indexes: channel, author+status+panel composite

5. **roles** (Role) - Discord roles
   - roleId (PK), name, permissions, color, position
   - deleted, deletedAt, createdAt

6. **userRoles** (UserRoles) - User-role junction table
   - userId (FK → users), roleId (FK → roles), createdAt
   - Composite PK on (userId, roleId)
   - Index: roleId

7. **panels** (Panel) - Ticket panels
   - id (PK), title, description, createdAt

**Relations Defined:**
- users → messages (one-to-many)
- users → tickets (one-to-many)
- users → userRoles (one-to-many)
- messages → users (many-to-one, author)
- messages → channels (many-to-one)
- channels → messages (one-to-many)
- channels → ticket (one-to-one)
- tickets → users (many-to-one, author)
- tickets → channels (one-to-one)
- tickets → panels (many-to-one)
- roles → userRoles (one-to-many)
- userRoles → users/roles (many-to-one each)

**Note:** Schema maps to existing Prisma tables - doesn't modify the database structure.

#### `lib/db/queries.ts` (223 lines)
**Purpose:** Database query functions

**Key Functions:**

1. **`searchMessages(params: MessageSearchParams)`**
   - Main search function with filters
   - SQL-level staff filtering using EXISTS subquery (lines 73-80)
   - Fuzzy search with ILIKE (case-insensitive)
   - Joins: messages → users → channels → tickets
   - Returns: messages with author/channel/ticket/isStaff flag
   - Performance: Single optimized query, uses indexes

2. **`getMessageCount(query?: string)`**
   - Returns total count of matching messages
   - Used for pagination

3. **`getStaffRoles()`**
   - Fetches roles matching staff patterns
   - Patterns: staff, mod, moderator, admin, helper (case-insensitive)
   - Cached in API route for 5 minutes

4. **`getTicketChannels()`**
   - Returns channels linked to tickets
   - Includes ticket metadata (id, sequence, status)
   - Limit: 100 most recent

5. **`getTicketById(ticketId: number)`**
   - Fetches single ticket with author & channel
   - Returns null if not found

6. **`getMentionsForMessages(messageResults: MessageSearchResult[])`**
   - Batch lookup of all mentioned users/roles/channels
   - Collects unique IDs from all messages
   - Parallel queries for each entity type
   - Returns lookup maps for frontend rendering
   - Performance: Single query per entity type (3 total)

**Type Definitions:**
```typescript
type MessageSearchParams = {
  query?: string;
  staffOnly?: boolean;
  ticketId?: number;
  channelId?: bigint;
  limit?: number;
  offset?: number;
  staffRoleIds?: bigint[];
}

type MessageSearchResult = {
  message: Message;
  author: User | null;
  channel: Channel | null;
  ticket: Ticket | null;
  isStaff: boolean;
}

type MentionLookup = {
  users: Record<string, { name, displayName, displayAvatar }>;
  roles: Record<string, { name, color }>;
  channels: Record<string, { name }>;
}
```

#### `lib/db/index.ts` (19 lines)
**Purpose:** Database connection initialization

**Exports:**
- `db`: Drizzle database instance
- `schema`: All schema definitions
- All schema tables/relations (re-exported)

**Connection:**
- Uses `postgres` driver (postgres.js)
- Connection string from `DATABASE_URL` env var
- Throws error if DATABASE_URL not set

---

### Configuration Files

#### `drizzle.config.ts`
**Purpose:** Drizzle Kit configuration for introspection/migrations

**Settings:**
- Schema: `./lib/db/schema.ts`
- Output: `./drizzle` (for generated migrations)
- Dialect: PostgreSQL
- Table filter: Only specific tables from Prisma schema
- DB credentials: From `DATABASE_URL` env var

#### `package.json`
**Scripts:**
- `dev`: Start Next.js dev server
- `build`: Build for production
- `start`: Start production server
- `lint`: Run ESLint
- `db:migrate`: Apply performance indexes via psql

**Dependencies:**
- drizzle-orm: 0.44.7
- next: 16.0.1
- postgres: 3.4.7
- react: 19.2.0
- react-dom: 19.2.0

**Dev Dependencies:**
- @tailwindcss/postcss: ^4
- drizzle-kit: 0.31.6
- typescript: ^5
- Various type definitions

#### `next.config.ts`
**Purpose:** Next.js configuration (default, no customizations visible)

#### `tsconfig.json`
**Purpose:** TypeScript compiler configuration
- Path aliases: `@/*` → `./*`
- Strict mode enabled
- JSX: preserve (for Next.js)

---

## Database Schema Reference

### Core Tables (from Prisma schema)

The Prisma schema defines the full database structure for the Discord bot. This dashboard only queries a subset of tables:

**User Table:**
- Primary key: `discord_id` (BigInt)
- Profile: name, displayName, nick, gender, age, region, etc.
- Verification: is_verified, is_voice_verified
- Relations: tickets, messages, shahadas, roles, infractions, etc.
- 22 different relation types (full Discord bot feature set)

**Message Table:**
- Primary key: `message_id` (BigInt)
- Content: content (text), embeds (JSON[]), attachments (String[])
- Mentions: member_mentions, channel_mentions, role_mentions (BigInt[])
- References: author_id (FK → User), channel_id (FK → Channel)
- Flags: is_deleted, is_dm
- Metadata: category_id, created_at, deleted_at

**Channel Table:**
- Primary key: `channel_id` (BigInt)
- Properties: name, category_id, position, is_category, is_dm
- Flags: deleted, deleted_at
- Relations: messages (one-to-many)

**Ticket Table:**
- Primary key: `id` (Int, autoincrement)
- References: channel_id (unique), author_id, panel_id
- Status: OPEN | CLOSED | DELETED
- Metadata: sequence, transcript_message_id, timestamps
- Indexes: channel_id, (author_id, status, panel_id)

**Role Table:**
- Primary key: `role_id` (BigInt)
- Properties: name, permissions, color, hoist, managed, mentionable, position
- Flags: deleted, deleted_at

**UserRoles Table:**
- Composite PK: (user_id, role_id)
- Junction table for many-to-many User ↔ Role
- Index: role_id

**Other Tables in Prisma (not used by dashboard):**
- AssignmentStatus, SupervisionNeed, Campaign, ReachoutLog
- SupportNotification, Infraction, InfractionAppeal, JailRoles
- Shahada, RevertUserInfo, UserSupervisor, RevertNotion, Panel

---

## Performance Optimizations

### 1. Frontend Performance
**File:** `app/messages/page.tsx`

- **150ms Debounce** (line 438)
  - Reduced from 500ms for near-instant feedback
  - Balances responsiveness vs request spam
  
- **Request Cancellation** (lines 518-522)
  - AbortController cancels stale requests
  - Prevents race conditions when typing quickly
  - Saves bandwidth
  
- **Optimistic UI** (lines 467-470)
  - Only shows loading spinner on first load
  - Keeps results visible during subsequent searches
  - No flashing/flickering

### 2. Backend Performance
**File:** `lib/db/queries.ts`

- **SQL-Level Staff Filtering** (lines 73-80)
  - Before: Fetch all → query roles → filter in memory
  - After: Single query with EXISTS subquery
  - 2x faster, reduced memory usage
  
- **Efficient Mention Lookup** (lines 168-222)
  - Batch lookup instead of per-message queries
  - Parallel queries for users/roles/channels
  - Reduces N+1 query problem

**File:** `app/api/messages/route.ts`

- **Staff Role Caching** (lines 5-24)
  - In-memory cache with 5-minute TTL
  - Avoids repeated role lookups
  - ~50x less database load for role queries

### 3. Database Performance
**File:** `migrations/001_add_search_indexes.sql`

**Indexes Created:**

1. **Trigram GIN Index** (line 9-10)
   ```sql
   CREATE INDEX message_content_trgm_idx 
   ON "Message" USING gin (content gin_trgm_ops);
   ```
   - Enables fast fuzzy/partial text search
   - 10-100x faster than plain ILIKE
   - Uses PostgreSQL pg_trgm extension

2. **Composite User-Role Index** (line 14-15)
   ```sql
   CREATE INDEX user_roles_user_role_idx 
   ON "UserRoles" (user_id, role_id);
   ```
   - Speeds up staff filtering EXISTS subquery
   - 2-5x faster for staff-only searches

3. **Partial Deleted Index** (line 19-20)
   ```sql
   CREATE INDEX message_is_deleted_idx 
   ON "Message" (is_deleted) WHERE is_deleted = false;
   ```
   - Smaller index for common case (non-deleted)
   - Faster WHERE clause evaluation

4. **Created_at Composite Index** (line 24-25)
   ```sql
   CREATE INDEX message_content_created_idx 
   ON "Message" (created_at DESC) WHERE is_deleted = false;
   ```
   - Optimizes ORDER BY created_at DESC
   - Combined with is_deleted filter

**All indexes use `CONCURRENTLY`:**
- Non-blocking index creation
- Production-safe (no table locks)

**Extension Required:**
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

### Performance Benchmarks

| Messages | Without Indexes | With Indexes | Speedup |
|----------|----------------|--------------|---------|
| 10K      | 50ms           | 10ms         | 5x      |
| 100K     | 500ms          | 20ms         | 25x     |
| 1M       | 5000ms         | 50ms         | 100x    |
| 10M      | 50000ms        | 100ms        | 500x    |

**Total User-Perceived Latency:**
- Before: 1-2.5 seconds
- After: 200-350ms
- **5-10x faster overall**

---

## Environment Variables

**Required:**
```bash
DATABASE_URL="postgresql://user:password@host:5432/database"
```

**Optional:**
```bash
DISCORD_GUILD_ID="123456789"  # For Discord deep links
```

**File:** `.env.local` (gitignored)

---

## API Reference

### GET `/api/messages`

**Purpose:** Search messages with filters

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `q` | string | - | Search query (fuzzy match on content) |
| `staffOnly` | boolean | false | Filter to staff messages only |
| `ticketId` | number | - | Filter by specific ticket ID |
| `channelId` | bigint | - | Filter by specific channel ID |
| `page` | number | 1 | Page number for pagination |
| `limit` | number | 50 | Results per page |

**Response Schema:**
```typescript
{
  messages: Array<{
    id: string;                    // message_id
    content: string | null;
    createdAt: string;             // ISO 8601
    isDeleted: boolean;
    isStaff: boolean;              // Computed from user roles
    author: {
      id: string;                  // discord_id
      name: string;
      displayName: string | null;
      nick: string | null;
      displayAvatar: string | null;
    } | null;
    channel: {
      id: string;                  // channel_id
      name: string;
    } | null;
    ticket: {
      id: number;
      sequence: number | null;
      status: "OPEN" | "CLOSED" | "DELETED" | null;
      createdAt: string;           // ISO 8601
    } | null;
  }>;
  mentions: {
    users: Record<string, {       // Keyed by discord_id
      name: string;
      displayName: string | null;
      displayAvatar: string | null;
    }>;
    roles: Record<string, {       // Keyed by role_id
      name: string;
      color: number;              // Integer color code
    }>;
    channels: Record<string, {    // Keyed by channel_id
      name: string;
    }>;
  };
  pagination: {
    total: number;                // Total matching messages
    page: number;                 // Current page
    limit: number;                // Results per page
    totalPages: number;           // Computed: ceil(total / limit)
  };
  guildId: string | null;         // From DISCORD_GUILD_ID env var
}
```

**Status Codes:**
- `200 OK` - Success
- `500 Internal Server Error` - Database error

**Example Request:**
```bash
GET /api/messages?q=hello&staffOnly=true&page=1&limit=50
```

**Example Response:**
```json
{
  "messages": [
    {
      "id": "1234567890123456789",
      "content": "Hello! How can I help?",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "isDeleted": false,
      "isStaff": true,
      "author": {
        "id": "9876543210987654321",
        "name": "StaffMember",
        "displayName": "Staff Member",
        "nick": null,
        "displayAvatar": "https://cdn.discordapp.com/avatars/..."
      },
      "channel": {
        "id": "1111111111111111111",
        "name": "ticket-123"
      },
      "ticket": {
        "id": 123,
        "sequence": 123,
        "status": "OPEN",
        "createdAt": "2024-01-15T10:00:00.000Z"
      }
    }
  ],
  "mentions": {
    "users": {},
    "roles": {},
    "channels": {}
  },
  "pagination": {
    "total": 150,
    "page": 1,
    "limit": 50,
    "totalPages": 3
  },
  "guildId": "123456789123456789"
}
```

---

## UI Features

### Message Search
- **Input:** Text box with 150ms debounce
- **Filters:** Staff-only checkbox
- **Results:** Real-time update as you type
- **Display:** 50 messages per page with pagination

### Message Cards
Each message displays:
- **Avatar:** User avatar with initials fallback
- **Author:** Display name + username (if different)
- **Badges:**
  - BOT (for bot user ID 1346564959835787284)
  - STAFF (if user has staff role)
  - Ticket #123 (if in ticket channel)
  - Status badge (OPEN/CLOSED/DELETED)
- **Timestamp:** Local formatted date/time
- **Content:** Message text with parsed mentions
- **Footer:**
  - Channel name
  - Author ID
  - "Jump to Message" link (Discord deep link)

### Discord Mentions
Mentions are parsed and rendered as interactive chips:

**Syntax:**
- `<@123456789>` or `<@!123456789>` → User mention
- `<@&123456789>` → Role mention
- `<#123456789>` → Channel mention

**Rendering:**
- **User mentions:** Blue chip with @username
- **Role mentions:** Chip with role color
- **Channel mentions:** Blue chip with #channel-name

**Interaction:**
- Click mention → Opens info popover
- Popover shows: name, ID, color (roles), avatar (users)
- Copy-to-clipboard button for IDs

### Pagination
- Previous/Next buttons
- Current page indicator: "Page X of Y"
- Buttons disabled at boundaries
- Resets to page 1 on query/filter change

### Empty States
- **No search:** "Start searching" prompt
- **No results:** "No messages found" with suggestion
- **Loading:** Spinner with "Loading messages..." (first load only)

### Error Handling
- Red error banner if API fails
- Preserves previous results on error
- AbortError silently ignored (from cancellation)

---

## Common Tasks

### Run Development Server
```bash
bun dev
```
Access at: http://localhost:3000

### Build for Production
```bash
bun run build
bun start
```

### Apply Database Indexes
```bash
bun run db:migrate
```
Or manually:
```bash
psql $DATABASE_URL -f migrations/001_add_search_indexes.sql
```

### Type Check
```bash
bunx tsc --noEmit
```

### Lint Code
```bash
bun run lint
```

### Verify Indexes
```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename IN ('Message', 'UserRoles')
ORDER BY tablename, indexname;
```

### Check Query Performance
```sql
EXPLAIN ANALYZE
SELECT * FROM "Message"
WHERE is_deleted = false
  AND content ILIKE '%search%'
ORDER BY created_at DESC
LIMIT 50;
```
Look for: "Bitmap Index Scan on message_content_trgm_idx"

---

## Development Patterns

### Adding New Filters
1. Add state in `app/messages/page.tsx`
2. Update `fetchMessages` to include in query params
3. Add parameter to `searchMessages` in `lib/db/queries.ts`
4. Update WHERE conditions in query builder
5. Parse in `app/api/messages/route.ts`

### Adding New Database Tables
1. Define schema in `lib/db/schema.ts`
2. Add to `tablesFilter` in `drizzle.config.ts`
3. Create query functions in `lib/db/queries.ts`
4. Add relations if needed

### Optimizing Queries
1. Use `EXPLAIN ANALYZE` to identify slow queries
2. Add indexes in new migration file
3. Use `CREATE INDEX CONCURRENTLY` for production
4. Verify with `pg_stat_user_indexes`

---

## Troubleshooting

### Search is Slow
1. Check if indexes exist:
   ```sql
   \di message_*
   ```
2. Run `ANALYZE "Message";` to update statistics
3. Verify index is used: `EXPLAIN ANALYZE` your query
4. Consider increasing `work_mem` in PostgreSQL

### Connection Errors
1. Verify `DATABASE_URL` is set correctly
2. Check PostgreSQL is running
3. Verify network access to database
4. Check connection string format:
   ```
   postgresql://user:password@host:5432/database
   ```

### Build Errors
1. Clear Next.js cache:
   ```bash
   rm -rf .next
   ```
2. Reinstall dependencies:
   ```bash
   rm -rf node_modules
   bun install
   ```
3. Check TypeScript errors:
   ```bash
   bunx tsc --noEmit
   ```

### Stale Results
- Staff roles are cached for 5 minutes
- Restart server to invalidate cache
- Or wait for TTL to expire

---

## Future Enhancements

### Planned Features
- [ ] Advanced filters (date range, specific users)
- [ ] Export results to CSV/JSON
- [ ] Message statistics dashboard
- [ ] Saved searches
- [ ] Search highlighting in results
- [ ] Ticket conversation threading

### Performance Enhancements
- [ ] Full-text search with tsvector
- [ ] Semantic search with pgvector embeddings
- [ ] Redis caching layer
- [ ] Connection pooling (pg.Pool)
- [ ] Cursor-based pagination for large offsets

### UI Improvements
- [ ] Dark mode toggle
- [ ] Keyboard shortcuts
- [ ] Advanced search syntax
- [ ] Result grouping by ticket/channel
- [ ] Infinite scroll option

---

## Technical Decisions & Rationale

### Why Drizzle ORM over Prisma Client?
- **Coexistence:** Doesn't require modifying existing Prisma setup
- **Type Safety:** Full TypeScript inference
- **Performance:** More control over SQL queries
- **Lightweight:** Smaller bundle size than Prisma Client

### Why postgres.js over pg?
- **Modern:** ESM support, better TypeScript integration
- **Fast:** Faster than node-postgres
- **Simple:** Cleaner API

### Why 150ms Debounce?
- **Balance:** Fast enough to feel instant, slow enough to prevent spam
- **Testing:** Reduced from 500ms after performance testing
- **Typical typing speed:** Users pause ~200ms between words

### Why Trigram Index over Full-Text Search?
- **Fuzzy Matching:** Better for typos and partial matches
- **Simplicity:** No need for text preprocessing
- **Performance:** GIN index is very fast for ILIKE
- **Flexibility:** Works with any query pattern

### Why Client-Side Rendering?
- **Interactivity:** Real-time search updates
- **State Management:** Complex UI state (modals, pagination)
- **Performance:** Debouncing and request cancellation
- **UX:** Optimistic UI and smooth transitions

---

## Maintenance Notes

### Database Migrations
- **DO NOT** modify Prisma schema - managed by Discord bot project
- Only add performance indexes via SQL migrations
- Test migrations on staging before production
- Always use `CONCURRENTLY` for production indexes

### Dependency Updates
- **Next.js:** Test carefully - App Router breaking changes possible
- **Drizzle ORM:** Usually safe, check migration guide
- **React:** Version 19 is stable, minor updates should be safe
- **TypeScript:** Check for breaking changes in strict mode

### Monitoring
- Watch query performance: `pg_stat_statements`
- Monitor index usage: `pg_stat_user_indexes`
- Track API latency in production
- Set up alerts for slow queries (> 1s)

### Backup Strategy
- Database managed by Discord bot project
- This dashboard is read-only
- No data loss risk from dashboard
- Version control for code changes

---

## Contact & Support

**Repository:** (Not specified in project)
**Discord Bot:** (Main project - not this dashboard)
**Database Owner:** (Discord bot project maintainer)

For dashboard issues:
1. Check TypeScript/build errors
2. Verify environment variables
3. Test database connection
4. Review query performance
5. Check Next.js logs

---

## License

(Not specified in project files)

---

## Changelog

### Recent Performance Optimizations (from OPTIMIZATION_SUMMARY.md)
- Reduced debounce: 500ms → 150ms
- Added request cancellation with AbortController
- Implemented optimistic UI updates
- SQL-level staff filtering (single query vs 2 + filtering)
- Staff role caching (5-minute TTL)
- Database indexes: trigram GIN, composite, partial

**Performance Impact:** 5-10x faster overall, 10-100x faster queries on large datasets

---

*Last Updated: Based on project state at time of documentation generation*
*Auto-generated from project files for AI context preservation*
