# API Reference

> REST API documentation for the Reverts Dashboard.

## Technology Stack

The API is built with **ElysiaJS**, a fast Bun-native web framework, running inside Next.js via a catch-all route handler. This provides:

- **End-to-end type safety** via Eden treaty client
- **High performance** with Bun runtime
- **Modular routing** with composable plugins
- **Built-in validation** and error handling

## Architecture

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
│  │  Auth Macro     ▼                                            │    │
│  │  (@/lib/elysia/auth.ts)                                      │    │
│  │  - Session validation via better-auth                        │    │
│  │  - Injects user/session into context                         │    │
│  └─────────────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────────────┘
```

## Authentication

All API routes require authentication via Discord OAuth. Unauthenticated requests return `401 Unauthorized`.

### Client Authentication

Sessions are managed via cookies. Use the better-auth client for authentication:

```typescript
import { authClient } from '@/lib/auth-client';

// Sign in with Discord
await authClient.signIn.social({ provider: 'discord' });

// Get current session
const session = await authClient.getSession();

// Sign out
await authClient.signOut();
```

### Route Protection

Routes are protected using the `authMacro` plugin which validates sessions and injects user context:

```typescript
import { authMacro } from '@/lib/elysia/auth'

// Protected route example
export const myRoutes = new Elysia()
  .use(authMacro)
  .get('/protected', ({ user, session }) => {
    // user and session are available here
    return { userId: user.id }
  }, { auth: true })  // <-- Enable auth requirement
```

---

## Using the Eden Client

The Eden treaty client provides end-to-end type safety for API calls:

```typescript
import { api } from '@/lib/eden'

// GET request with query params
const { data, error } = await api.users.get({
  query: { page: '1', limit: '50' }
})

// GET with path params
const { data, error } = await api.users({ id: '123456789' }).get()

// GET with path params and query
const { data, error } = await api.users({ id: '123456789' }).get({
  query: { full: 'true' }
})

// POST request
const { data, error } = await api.tickets({ id: '123' }).summary.post()
```

### Error Handling

```typescript
const { data, error } = await api.users.get()

if (error) {
  // error is typed based on possible error responses
  console.error('API error:', error)
  return
}

// data is fully typed
console.log(data.users)
```

---

## Endpoints

### Messages

#### `GET /api/messages`

Search for messages with optional filters.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `q` | string | - | Search query (fuzzy match on content) |
| `staffOnly` | boolean | `false` | Filter to staff messages only |
| `ticketId` | number | - | Filter by specific ticket ID |
| `mode` | string | - | Set to `transcript` for ticket transcripts |
| `page` | number | `1` | Page number |
| `limit` | number | `50` | Results per page (max 100) |

**Eden Usage:**

```typescript
const { data } = await api.messages.get({
  query: { q: 'hello', staffOnly: 'true', page: '1' }
})
```

---

### Tickets

#### `GET /api/tickets`

Get a list of tickets with pagination and filters.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | - | Filter by status (OPEN, CLOSED, DELETED) |
| `author` | string | - | Filter by author Discord ID |
| `panel` | number | - | Filter by panel ID |
| `sortBy` | string | `newest` | Sort order (newest, oldest, messages) |
| `page` | number | `1` | Page number |
| `limit` | number | `50` | Results per page |

**Eden Usage:**

```typescript
const { data } = await api.tickets.get({
  query: { status: 'OPEN', sortBy: 'newest' }
})
```

#### `POST /api/tickets/:id/summary`

Generate AI summary for a ticket.

**Eden Usage:**

```typescript
const { data, error } = await api.tickets({ id: '123' }).summary.post()
```

---

### Users

#### `GET /api/users`

List/search users with pagination.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Search query |
| `assignmentStatus` | string | Filter by assignment status |
| `relationToIslam` | string | Filter by relation |
| `inGuild` | boolean | Filter by guild membership |
| `roleId` | string | Filter by role ID |
| `page` | number | Page number |
| `limit` | number | Results per page |

**Eden Usage:**

```typescript
const { data } = await api.users.get({
  query: { q: 'john', page: '1' }
})
```

#### `GET /api/users/:id`

Get user details by Discord ID.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `full` | boolean | Include all user details (shahadas, supervisors, etc.) |

**Eden Usage:**

```typescript
// Basic user info
const { data } = await api.users({ id: '123456789' }).get()

// Full profile
const { data } = await api.users({ id: '123456789' }).get({
  query: { full: 'true' }
})
```

#### `GET /api/users/:id/popover`

Get user popover data (optimized for UI popovers).

**Eden Usage:**

```typescript
const { data } = await api.users({ id: '123456789' }).popover.get()
```

#### `GET /api/users/:id/ticket-stats`

Get user's ticket statistics.

**Eden Usage:**

```typescript
const { data } = await api.users({ id: '123456789' })['ticket-stats'].get()
```

#### `GET /api/users/relations`

Get list of unique relation-to-Islam values.

**Eden Usage:**

```typescript
const { data } = await api.users.relations.get()
```

---

### Roles

#### `GET /api/roles`

Get list of Discord roles.

**Eden Usage:**

```typescript
const { data } = await api.roles.get()
```

---

### Panels

#### `GET /api/panels`

Get list of ticket panels.

**Eden Usage:**

```typescript
const { data } = await api.panels.get()
```

---

### Authentication

#### `POST /api/auth/[...all]`

All auth routes are handled by better-auth. Key endpoints:

| Route | Method | Description |
|-------|--------|-------------|
| `/api/auth/sign-in/social` | POST | Initiate Discord OAuth |
| `/api/auth/callback/discord` | GET | OAuth callback |
| `/api/auth/session` | GET | Get current session |
| `/api/auth/sign-out` | POST | Sign out |

---

## Error Responses

All errors follow this format:

```typescript
{
  error: string;      // Error message
  code?: string;      // Optional error code
}
```

**Common Errors:**

| Status | Error | Cause |
|--------|-------|-------|
| `401` | "Unauthorized" | No valid session |
| `403` | "Access denied" | No mod role |
| `404` | "Not found" | Resource doesn't exist |
| `500` | "Internal server error" | Server error |

---

## File Structure

```
src/
├── app/api/[[...slugs]]/
│   └── route.ts           # Catch-all handler, exports App type
├── lib/
│   ├── eden.ts             # Eden treaty client
│   └── elysia/
│       ├── auth.ts         # Auth macro plugin
│       └── routes/
│           ├── users.ts    # User routes
│           ├── tickets.ts  # Ticket routes
│           ├── messages.ts # Message routes
│           ├── roles.ts    # Role routes
│           ├── panels.ts   # Panel routes
│           └── relations.ts # Relations routes
```

---

## Performance Notes

### Caching

| Data | Cache Duration | Location |
|------|---------------|----------|
| Staff role IDs | 5 minutes | Server memory |
| User sessions | Until expiry | Database |

### Query Optimization

- Message search uses trigram GIN index for fast ILIKE
- Staff filtering uses EXISTS subquery at SQL level
- Mention lookups are batched (3 queries total)

See [Performance Guide](./PERFORMANCE.md) for details.

---

## Related Documentation

- [Architecture](./ARCHITECTURE.md)
- [Database Schema](./DATABASE.md)
- [Authentication](./AUTHENTICATION.md)
