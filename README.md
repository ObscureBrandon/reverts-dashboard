# Discord Message Search Dashboard

A Next.js dashboard for searching and analyzing Discord bot messages with ticket integration.

## Features

- **Full-text search** - Search through message content with fuzzy matching
- **Ticket integration** - View which ticket each message belongs to
- **Staff filtering** - Filter messages to show only staff responses
- **Pagination** - Efficiently browse through large result sets
- **Real-time search** - Debounced search for smooth user experience
- **Responsive design** - Works on desktop and mobile devices

## Tech Stack

- **Next.js 16** - React framework with App Router
- **Drizzle ORM** - TypeScript SQL ORM
- **PostgreSQL** - Database (existing Prisma database)
- **TailwindCSS** - Styling
- **TypeScript** - Type safety

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- PostgreSQL database (your existing Discord bot database)

### Installation

1. Clone the repository and install dependencies:

```bash
bun install
```

2. Set up environment variables:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your PostgreSQL connection string:

```env
DATABASE_URL="postgresql://user:password@host:5432/database_name"
```

3. The Drizzle schema is already configured to work with your existing Prisma database tables. No migration needed!

4. **Apply performance indexes** (required for fast search):

```bash
bun run db:migrate
```

This adds PostgreSQL trigram indexes for 10-100x faster searches. See [PERFORMANCE.md](./PERFORMANCE.md) for details.

5. Start the development server:

```bash
bun dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Performance

This dashboard is optimized for **instant search** with updates on every keystroke:

- **150ms debounce** - Nearly instant feedback
- **Trigram indexes** - 10-100x faster fuzzy search (requires `bun run db:migrate`)
- **Optimistic UI** - No loading flicker between searches
- **Request cancellation** - Old searches don't interfere
- **Staff role caching** - Reduces database queries

Expected performance:
- **Small DBs (< 100K messages):** < 50ms per search
- **Large DBs (1M+ messages):** < 150ms per search

See [PERFORMANCE.md](./PERFORMANCE.md) for detailed optimization guide and benchmarks.

## Project Structure

```
app/
├── api/
│   └── messages/
│       └── route.ts          # API endpoint for message search
├── messages/
│   └── page.tsx              # Main search dashboard
├── layout.tsx                # Root layout
└── page.tsx                  # Home page (redirects to /messages)

lib/
├── db/
│   ├── schema.ts             # Drizzle schema definitions
│   ├── index.ts              # Database connection
│   └── queries.ts            # Database query functions
└── hooks/
    └── useDebounce.ts        # Debounce hook for search

drizzle.config.ts             # Drizzle configuration
```

## Database Schema

The dashboard uses the following tables from your existing database:

- **Message** - Core message data
- **User** - Author information
- **Channel** - Channel details
- **Ticket** - Ticket linking
- **Role** - Staff role definitions
- **UserRoles** - User-role relationships

## Usage

### Basic Search

1. Navigate to `/messages`
2. Enter a search term in the search box
3. Results will appear automatically (debounced)

### Staff Filter

Check the "Staff Only" checkbox to filter messages from users with staff roles (admin, mod, staff, moderator, helper).

### Pagination

Use the Previous/Next buttons to navigate through pages of results.

## API Endpoints

### GET `/api/messages`

Search for messages with optional filters.

**Query Parameters:**
- `q` - Search query string
- `staffOnly` - Filter to staff messages only (true/false)
- `ticketId` - Filter by specific ticket ID
- `channelId` - Filter by specific channel ID
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 50)

**Response:**
```json
{
  "messages": [
    {
      "id": "123456789",
      "content": "Message content",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "author": {
        "id": "987654321",
        "name": "Username",
        "displayName": "Display Name",
        "nick": "Nickname"
      },
      "channel": {
        "id": "555666777",
        "name": "ticket-123"
      },
      "ticket": {
        "id": 1,
        "sequence": 123,
        "status": "OPEN",
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    }
  ],
  "pagination": {
    "total": 1000,
    "page": 1,
    "limit": 50,
    "totalPages": 20
  }
}
```

## Future Enhancements

### Vector Embeddings for Semantic Search

To add semantic search capabilities:

1. Install pgvector extension in PostgreSQL:
```sql
CREATE EXTENSION vector;
```

2. Uncomment the `embedding` field in `lib/db/schema.ts`:
```typescript
embedding: vector('embedding', { dimensions: 1536 }),
```

3. Generate embeddings for messages using OpenAI or similar API

4. Update search queries to use cosine similarity for semantic matching

### Full-Text Search

For better PostgreSQL full-text search, add a tsvector column:

```sql
ALTER TABLE "Message" ADD COLUMN content_tsv tsvector 
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED;
CREATE INDEX message_content_tsv_idx ON "Message" USING gin(content_tsv);
```

Then update queries to use `@@` operator for full-text search.

### Additional Features

- Export search results to CSV/JSON
- Advanced filters (date range, specific users, channels)
- Message statistics dashboard
- Ticket conversation threading
- Search highlighting
- Saved searches

## Development

### Running in Development

```bash
bun dev
```

### Building for Production

```bash
bun run build
bun start
```

### Type Checking

```bash
bunx tsc --noEmit
```

## License

MIT
