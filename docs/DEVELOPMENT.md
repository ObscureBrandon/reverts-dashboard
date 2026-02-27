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

ElysiaJS routes are modular and type-safe. Add new routes in `src/lib/elysia/routes/`:

1. Create a new route file:

```typescript
// src/lib/elysia/routes/example.ts
import { authMacro } from '@/lib/elysia/auth'
import { Elysia } from 'elysia'

export const exampleRoutes = new Elysia({ prefix: '/example' })
  .use(authMacro)
  .get('/', async ({ user }) => {
    // user is available from authMacro
    return { message: 'Hello', userId: user.id }
  }, { auth: true })
  
  .get('/:id', async ({ params }) => {
    const { id } = params
    return { id }
  }, { auth: true })
  
  .post('/', async ({ body }) => {
    // body is typed if you define a schema
    return { created: true }
  }, { auth: true })
```

2. Register in the main app (`app/api/[[...slugs]]/route.ts`):

```typescript
import { exampleRoutes } from '@/lib/elysia/routes/example'

const apiRoutes = new Elysia({ prefix: '/api' })
  .use(authMacro)
  // ... existing routes
  .use(exampleRoutes)
```

3. Use in React with Eden (automatic type inference):

```typescript
import { api } from '@/lib/eden'

// Types are automatically inferred!
const { data, error } = await api.example.get()
const { data } = await api.example({ id: '123' }).get()
```

### Adding New React Query Hooks

Hooks using the Eden client are fully type-safe:

```typescript
// src/lib/hooks/queries/useExample.ts
'use client'

import { api } from '@/lib/eden'
import { useQuery } from '@tanstack/react-query'

export function useExample(id: string) {
  return useQuery({
    queryKey: ['example', id],
    queryFn: async () => {
      const { data, error } = await api.example({ id }).get()
      
      if (error) {
        throw new Error('Failed to fetch example')
      }
      
      return data
    },
    enabled: !!id,
  })
}
```

### Adding Request Validation

Use Elysia's built-in validation with TypeBox:

```typescript
import { t } from 'elysia'

export const exampleRoutes = new Elysia({ prefix: '/example' })
  .post('/', async ({ body }) => {
    return { name: body.name, age: body.age }
  }, {
    auth: true,
    body: t.Object({
      name: t.String(),
      age: t.Number({ minimum: 0 }),
    })
  })
```

### Adding New Database Queries

Add query functions to `src/lib/db/queries.ts`:

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

---

## Database Patterns

### Type-Safe Queries with Drizzle

```typescript
import { db } from '@/lib/db'
import { users, messages } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'

// Select with joins
const results = await db
  .select()
  .from(messages)
  .leftJoin(users, eq(messages.authorId, users.discordId))
  .where(eq(messages.isDeleted, false))
  .orderBy(desc(messages.createdAt))
  .limit(50)

// Using query API with relations
const user = await db.query.users.findFirst({
  where: eq(users.discordId, discordId),
  with: {
    messages: {
      limit: 10,
      orderBy: [desc(messages.createdAt)],
    },
    roles: true,
  },
})
```

### BigInt Handling

Discord IDs are BigInt. Convert for JSON:

```typescript
// When returning to client
return {
  id: message.messageId.toString(),
  authorId: message.authorId.toString(),
}

// When receiving from client
const id = BigInt(params.id)
```

---

## Frontend Patterns

### Using Eden Client

The Eden client provides end-to-end type safety:

```typescript
import { api } from '@/lib/eden'

// GET with query params
const { data, error } = await api.users.get({
  query: { page: '1', limit: '50' }
})

// GET with path params
const { data } = await api.users({ id: userId }).get()

// POST request
const { data } = await api.tickets({ id }).summary.post()

// Error handling
if (error) {
  console.error('API error:', error)
}
```

### React Query + Eden Pattern

```typescript
export function useUserDetails(userId: string | null) {
  return useQuery({
    queryKey: ['user', 'details', userId],
    queryFn: async () => {
      const { data, error } = await api.users({ id: userId! }).get({
        query: { full: 'true' }
      })
      
      if (error) throw new Error('Failed to fetch user details')
      return data
    },
    enabled: !!userId,
  })
}
```

### Debounced Search

```typescript
import { useDebounce } from '@/lib/hooks/useDebounce'

const [query, setQuery] = useState('')
const debouncedQuery = useDebounce(query, 150)

useEffect(() => {
  if (debouncedQuery) {
    fetchResults(debouncedQuery)
  }
}, [debouncedQuery])
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

### Auth Issues

See [Authentication Troubleshooting](./AUTHENTICATION.md#troubleshooting)

### Eden Client Type Errors

If you see type errors after adding new routes:
1. Restart the TypeScript server in your IDE
2. Make sure the route is registered in `app/api/[[...slugs]]/route.ts`
3. Check that the `App` type is properly exported

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

### ElysiaJS

- Use the auth macro for protected routes: `{ auth: true }`
- Add validation schemas for POST/PUT endpoints
- Keep route files focused (one domain per file)

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

## Related Documentation

- [Architecture](./ARCHITECTURE.md)
- [Database Schema](./DATABASE.md)
- [API Reference](./API.md)
- [Performance Guide](./PERFORMANCE.md)
