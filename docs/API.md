# API Reference

> REST API documentation for the Reverts Dashboard.

## Authentication

All API routes require authentication via Discord OAuth. Unauthenticated requests return `401 Unauthorized`.

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
| `channelId` | string | - | Filter by channel ID (bigint as string) |
| `page` | number | `1` | Page number |
| `limit` | number | `50` | Results per page (max 100) |

**Response:**

```typescript
{
  messages: Array<{
    id: string;                    // message_id as string
    content: string | null;
    createdAt: string;             // ISO 8601
    isDeleted: boolean;
    isStaff: boolean;              // Computed from user roles
    author: {
      id: string;                  // discord_id as string
      name: string;
      displayName: string | null;
      nick: string | null;
      displayAvatar: string | null;
    } | null;
    channel: {
      id: string;
      name: string;
    } | null;
    ticket: {
      id: number;
      sequence: number | null;
      status: "OPEN" | "CLOSED" | "DELETED" | null;
      createdAt: string;
    } | null;
  }>;
  mentions: {
    users: Record<string, {
      name: string;
      displayName: string | null;
      displayAvatar: string | null;
    }>;
    roles: Record<string, {
      name: string;
      color: number;
    }>;
    channels: Record<string, {
      name: string;
    }>;
  };
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  guildId: string | null;          // For Discord deep links
}
```

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

**Status Codes:**

| Code | Description |
|------|-------------|
| `200` | Success |
| `401` | Unauthorized (no session) |
| `500` | Server error |

---

### Tickets

#### `GET /api/tickets`

Get a list of tickets.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | - | Filter by status (OPEN, CLOSED, DELETED) |
| `authorId` | string | - | Filter by author Discord ID |
| `page` | number | `1` | Page number |
| `limit` | number | `50` | Results per page |

**Response:**

```typescript
{
  tickets: Array<{
    id: number;
    channelId: string | null;
    sequence: number | null;
    status: "OPEN" | "CLOSED" | "DELETED" | null;
    createdAt: string;
    closedAt: string | null;
    author: {
      id: string;
      name: string;
      displayName: string | null;
    } | null;
    channel: {
      id: string;
      name: string;
    } | null;
  }>;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
```

---

#### `GET /api/tickets/[id]/summary`

Get or generate AI summary for a ticket.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | number | Ticket ID |

**Response:**

```typescript
{
  ticketId: number;
  summary: string | null;
  generatedAt: string | null;
  model: string | null;
  tokensUsed: number | null;
}
```

---

### Users

#### `GET /api/users/[id]`

Get user details by Discord ID.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Discord user ID |

**Response:**

```typescript
{
  user: {
    id: string;
    name: string | null;
    displayName: string | null;
    displayAvatar: string | null;
    nick: string | null;
    inGuild: boolean;
    isVerified: boolean;
    isVoiceVerified: boolean;
    relationToIslam: string | null;
    gender: string | null;
    age: string | null;
    region: string | null;
    createdAt: string;
  };
  roles: Array<{
    id: string;
    name: string;
    color: number;
  }>;
}
```

---

### Authentication

#### `POST /api/auth/[...all]`

All auth routes are handled by better-auth. Key endpoints:

| Route | Method | Description |
|-------|--------|-------------|
| `/api/auth/signin/discord` | POST | Initiate Discord OAuth |
| `/api/auth/callback/discord` | GET | OAuth callback |
| `/api/auth/session` | GET | Get current session |
| `/api/auth/signout` | POST | Sign out |

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

## Rate Limiting

Currently no rate limiting is implemented. For production, consider adding:

- Request rate limits (e.g., 100 requests/minute)
- Search debouncing is handled client-side (150ms)
- Staff role lookups are cached server-side (5 min TTL)

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
