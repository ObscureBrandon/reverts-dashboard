# Development Guide

> Development patterns, common tasks, and troubleshooting.

## Quick Start

```bash
# Install dependencies
bun install

# Set up environment
cp .env.local.example .env.local
# Edit .env.local with your DATABASE_URL and Discord credentials

# Apply performance indexes (recommended)
bun run db:migrate

# Start development server
bun dev
```

Open http://localhost:3000

---

## Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `bun dev` | Start development server |
| `build` | `bun run build` | Build for production |
| `start` | `bun start` | Start production server |
| `lint` | `bun run lint` | Run ESLint |
| `db:migrate` | `bun run db:migrate` | Apply database indexes |

### TypeScript

```bash
# Type check
bunx tsc --noEmit

# Watch mode
bunx tsc --noEmit --watch
```

---

## Development Patterns

### Adding New API Endpoints

1. Create route file in `app/api/`:

```typescript
// app/api/example/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    
    // Your logic here
    const data = await db.query...;
    
    return NextResponse.json({ data });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
```

### Adding New Database Queries

1. Add query function to `src/lib/db/queries.ts`:

```typescript
export async function getExampleData(params: { id: number }) {
  return await db.query.tableName.findFirst({
    where: eq(tableName.id, params.id),
    with: {
      relation: true,
    },
  });
}
```

2. Use in API route:

```typescript
import { getExampleData } from '@/lib/db/queries';

const data = await getExampleData({ id: 123 });
```

### Adding New Filters

1. Add state in page component:

```typescript
const [newFilter, setNewFilter] = useState<string>('');
```

2. Add to fetch URL:

```typescript
const params = new URLSearchParams();
if (newFilter) params.set('newFilter', newFilter);
```

3. Parse in API route:

```typescript
const newFilter = searchParams.get('newFilter');
```

4. Add to query conditions:

```typescript
if (newFilter) {
  conditions.push(eq(table.column, newFilter));
}
```

---

## Database Patterns

### Type-Safe Queries with Drizzle

```typescript
import { db, schema } from '@/lib/db';
import { eq, and, or, sql, desc } from 'drizzle-orm';

// Select with joins
const results = await db
  .select()
  .from(schema.messages)
  .leftJoin(schema.users, eq(schema.messages.authorId, schema.users.discordId))
  .where(eq(schema.messages.isDeleted, false))
  .orderBy(desc(schema.messages.createdAt))
  .limit(50);

// Using query API with relations
const user = await db.query.users.findFirst({
  where: eq(schema.users.discordId, discordId),
  with: {
    messages: {
      limit: 10,
      orderBy: [desc(schema.messages.createdAt)],
    },
    roles: true,
  },
});
```

### Raw SQL When Needed

```typescript
import { sql } from 'drizzle-orm';

// Complex conditions
const results = await db.execute(sql`
  SELECT * FROM "Message"
  WHERE content ILIKE ${`%${query}%`}
  AND created_at > NOW() - INTERVAL '7 days'
`);
```

### BigInt Handling

Discord IDs are BigInt. Convert for JSON:

```typescript
// When returning to client
return {
  id: message.messageId.toString(),
  authorId: message.authorId.toString(),
};

// When receiving from client
const id = BigInt(request.query.id);
```

---

## Frontend Patterns

### Debounced Search

```typescript
import { useDebounce } from '@/lib/hooks/useDebounce';

const [query, setQuery] = useState('');
const debouncedQuery = useDebounce(query, 150);

useEffect(() => {
  if (debouncedQuery) {
    fetchResults(debouncedQuery);
  }
}, [debouncedQuery]);
```

### Request Cancellation

```typescript
useEffect(() => {
  const controller = new AbortController();
  
  async function fetchData() {
    try {
      const res = await fetch(url, { signal: controller.signal });
      const data = await res.json();
      setResults(data);
    } catch (error) {
      if (error.name !== 'AbortError') {
        setError(error.message);
      }
    }
  }
  
  fetchData();
  
  return () => controller.abort();
}, [dependency]);
```

### Optimistic UI

```typescript
const [loading, setLoading] = useState(true);
const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

// Only show loading on first load
if (!hasLoadedOnce) setLoading(true);

// After first load
setHasLoadedOnce(true);
setLoading(false);
```

---

## Testing

### Manual Testing

1. Start dev server: `bun dev`
2. Open http://localhost:3000
3. Test search functionality:
   - Type quickly → should debounce
   - Check staff filter
   - Test pagination

### Query Performance Testing

```sql
EXPLAIN ANALYZE
SELECT * FROM "Message"
WHERE is_deleted = false
  AND content ILIKE '%test%'
ORDER BY created_at DESC
LIMIT 50;
```

Should show `Bitmap Index Scan on message_content_trgm_idx`.

### Auth Testing

1. Clear cookies
2. Visit http://localhost:3000
3. Should redirect to /login
4. Sign in with Discord
5. Should have access if you have mod role

---

## Troubleshooting

### Build Errors

```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules
bun install

# Check TypeScript
bunx tsc --noEmit
```

### Database Connection Errors

1. Verify `DATABASE_URL` is set:
   ```bash
   echo $DATABASE_URL
   ```

2. Test connection:
   ```bash
   psql $DATABASE_URL -c "SELECT 1"
   ```

3. Check format:
   ```
   postgresql://user:password@host:5432/database
   ```

### Search is Slow

1. Check indexes exist:
   ```sql
   \di message_*
   ```

2. Run `ANALYZE`:
   ```sql
   ANALYZE "Message";
   ```

3. Apply indexes if missing:
   ```bash
   bun run db:migrate
   ```

### Stale Results

- Staff roles are cached for 5 minutes
- Restart server to invalidate: `Ctrl+C` then `bun dev`

### Auth Issues

See [Authentication Troubleshooting](./AUTHENTICATION.md#troubleshooting)

---

## Code Style

### TypeScript

- Use strict types, avoid `any`
- Prefer `const` over `let`
- Use optional chaining: `user?.name`
- Use nullish coalescing: `value ?? 'default'`

### React

- Use functional components with hooks
- Memoize expensive computations: `useMemo`, `useCallback`
- Keep components focused and composable

### SQL/Drizzle

- Use parameterized queries (never string interpolation)
- Add indexes for frequently queried columns
- Use `EXPLAIN ANALYZE` to verify query plans

---

## IDE Setup

### VS Code Extensions

- **ESLint** - Linting
- **Prettier** - Formatting
- **Tailwind CSS IntelliSense** - Tailwind autocomplete
- **Prisma** - Schema highlighting (for reference file)

### Settings

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

---

## Dependency Updates

| Dependency | Update Caution |
|------------|----------------|
| Next.js | Test carefully - App Router breaking changes possible |
| Drizzle ORM | Usually safe, check migration guide |
| React | v19 is stable, minor updates safe |
| TypeScript | Check for strict mode changes |
| better-auth | Check changelog for auth changes |

```bash
# Check for updates
bun outdated

# Update all
bun update

# Update specific
bun add next@latest
```

---

## Related Documentation

- [Architecture](./ARCHITECTURE.md)
- [Database Schema](./DATABASE.md)
- [API Reference](./API.md)
- [Performance Guide](./PERFORMANCE.md)
