# Database

> Schema reference, table definitions, and query patterns for the Reverts Dashboard.

## Overview

The database uses PostgreSQL with two categories of tables:

| Category | Tables | Managed By | Migrations |
|----------|--------|------------|------------|
| Auth | 4 tables (`auth_*`) | Dashboard | Drizzle |
| Bot | 18 tables | Discord Bot | Prisma |

All tables are defined in [`lib/db/schema.ts`](../lib/db/schema.ts).

---

## Schema Structure

### Enums

```typescript
// Ticket status
ticketStatusEnum: 'OPEN' | 'CLOSED' | 'DELETED'

// Assignment status for reverts
assignmentStatusEnum: 'NEEDS_SUPPORT' | 'INACTIVE' | 'SELF_SUFFICIENT' | 'PAUSED' | 'NOT_READY'

// Supervision needs categories
supervisionNeedEnum: 'PRAYER_HELP' | 'QURAN_LEARNING' | 'FAMILY_ISSUES' | 
                     'NEW_CONVERT_QUESTIONS' | 'ARABIC_LEARNING' | 'ISLAMIC_HISTORY' | 
                     'COMMUNITY_INTEGRATION' | 'SPIRITUAL_GUIDANCE'

// Infraction types
infractionTypeEnum: 'NOTE' | 'WARNING' | 'TIMEOUT' | 'KICK' | 'BAN' | 
                    'JAIL' | 'VOICE_MUTE' | 'VOICE_BAN'

// Infraction status
infractionStatusEnum: 'ACTIVE' | 'EXPIRED' | 'PARDONED' | 'APPEALED' | 
                      'APPEAL_APPROVED' | 'APPEAL_DENIED'
```

---

## Auth Tables (Dashboard-Owned)

These tables are managed by Drizzle migrations. The bot does not interact with them.

### `auth_user`
Dashboard user accounts (from Discord OAuth).

| Column | Type | Description |
|--------|------|-------------|
| `id` | text | Primary key |
| `email` | text | User email (unique) |
| `email_verified` | boolean | Email verification status |
| `name` | text | Display name |
| `image` | text | Avatar URL |
| `created_at` | timestamp | Account creation time |
| `updated_at` | timestamp | Last update time |

### `auth_account`
OAuth account connections.

| Column | Type | Description |
|--------|------|-------------|
| `id` | text | Primary key |
| `account_id` | text | OAuth provider account ID |
| `provider_id` | text | Provider name (e.g., "discord") |
| `user_id` | text | FK → auth_user.id |
| `access_token` | text | OAuth access token |
| `refresh_token` | text | OAuth refresh token |

### `auth_session`
Active user sessions.

| Column | Type | Description |
|--------|------|-------------|
| `id` | text | Primary key |
| `token` | text | Session token (unique) |
| `user_id` | text | FK → auth_user.id |
| `expires_at` | timestamp | Session expiration |
| `ip_address` | text | Client IP |
| `user_agent` | text | Client user agent |

### `auth_verification`
Email/token verification records.

| Column | Type | Description |
|--------|------|-------------|
| `id` | text | Primary key |
| `identifier` | text | What's being verified |
| `value` | text | Verification token |
| `expires_at` | timestamp | Token expiration |

---

## Bot Tables (Prisma-Owned)

These tables are managed by the Discord bot's Prisma setup. The dashboard has read/write access.

### Core Tables

#### `User`
Discord user information.

| Column | Type | Description |
|--------|------|-------------|
| `discord_id` | bigint | Primary key (Discord snowflake) |
| `name` | varchar | Username |
| `display_name` | varchar | Display name |
| `display_avatar` | varchar | Avatar URL |
| `nick` | varchar | Server nickname |
| `in_guild` | boolean | Currently in server |
| `is_verified` | boolean | Verified status |
| `is_voice_verified` | boolean | Voice verified status |
| `relation_to_islam` | varchar | User's relation to Islam |
| `gender` | varchar | Gender |
| `age` | varchar | Age range |
| `region` | varchar | Geographic region |
| `created_at` | timestamp | First seen timestamp |

#### `Role`
Discord server roles.

| Column | Type | Description |
|--------|------|-------------|
| `role_id` | bigint | Primary key (Discord snowflake) |
| `name` | varchar | Role name |
| `permissions` | bigint | Discord permissions bitfield |
| `color` | integer | Role color (hex as int) |
| `position` | integer | Role hierarchy position |
| `deleted` | boolean | Soft delete flag |

#### `UserRoles`
Many-to-many junction for user roles.

| Column | Type | Description |
|--------|------|-------------|
| `user_id` | bigint | FK → User.discord_id |
| `role_id` | bigint | FK → Role.role_id |
| `created_at` | timestamp | Assignment time |

**Composite Primary Key:** `(user_id, role_id)`

### Channel & Message Tables

#### `Channel`
Discord channels.

| Column | Type | Description |
|--------|------|-------------|
| `channel_id` | bigint | Primary key |
| `name` | varchar | Channel name |
| `category_id` | bigint | Parent category ID |
| `position` | integer | Sort position |
| `is_category` | boolean | Is a category |
| `is_dm` | boolean | Is a DM channel |
| `deleted` | boolean | Soft delete flag |

#### `Message`
Discord messages (core table for search).

| Column | Type | Description |
|--------|------|-------------|
| `message_id` | bigint | Primary key |
| `content` | text | Message text |
| `author_id` | bigint | FK → User.discord_id |
| `channel_id` | bigint | FK → Channel.channel_id |
| `embeds` | jsonb[] | Message embeds |
| `attachments` | text[] | Attachment URLs |
| `member_mentions` | bigint[] | Mentioned user IDs |
| `channel_mentions` | bigint[] | Mentioned channel IDs |
| `role_mentions` | bigint[] | Mentioned role IDs |
| `is_deleted` | boolean | Soft delete flag |
| `is_dm` | boolean | Is a DM |
| `created_at` | timestamp | Message timestamp |

**Indexes:**
- `message_author_idx` on `author_id`
- `message_channel_idx` on `channel_id`
- `message_created_at_idx` on `created_at`
- `message_content_trgm_idx` (trigram GIN for search)

### Ticket System

#### `Panel`
Ticket panel configurations.

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer | Primary key |
| `title` | varchar | Panel title |
| `description` | text | Panel description |

#### `Ticket`
Support tickets.

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer | Primary key |
| `channel_id` | bigint | FK → Channel (unique) |
| `author_id` | bigint | FK → User |
| `panel_id` | integer | FK → Panel |
| `status` | enum | OPEN, CLOSED, DELETED |
| `sequence` | integer | Ticket number |
| `summary` | text | AI-generated summary |
| `summary_generated_at` | timestamp | Summary generation time |
| `summary_model` | varchar | AI model used |
| `closed_at` | timestamp | When closed |
| `closed_by_id` | bigint | Who closed it |

### Revert Support Tables

#### `Shahada`
Records of users taking shahada.

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer | Primary key |
| `user_id` | bigint | FK → User (who took shahada) |
| `supervisor_id` | bigint | FK → User (who supervised) |
| `created_at` | timestamp | When taken |

#### `UserSupervisor`
Supervisor assignments.

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer | Primary key |
| `user_id` | bigint | FK → User (revert) |
| `supervisor_id` | bigint | Supervisor Discord ID |
| `active` | boolean | Currently active |

#### `AssignmentStatus`
Revert assignment statuses.

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer | Primary key |
| `user_id` | bigint | FK → User (revert) |
| `added_by_id` | bigint | FK → User (supervisor) |
| `status` | enum | Assignment status |
| `priority` | integer | Priority level (0-5) |
| `active` | boolean | Currently active |
| `resolved_by_id` | bigint | Who resolved it |

#### `SupervisionNeed`
User supervision needs.

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer | Primary key |
| `user_id` | bigint | FK → User |
| `need_type` | enum | Type of need |
| `severity` | integer | 1-5 scale |
| `notes` | text | Additional notes |

### Moderation Tables

#### `Infraction`
User infractions.

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer | Primary key |
| `user_id` | bigint | FK → User (recipient) |
| `moderator_id` | bigint | FK → User (issuer) |
| `type` | enum | Infraction type |
| `status` | enum | Current status |
| `reason` | text | Infraction reason |
| `expires_at` | timestamp | When it expires |
| `pardoned_by_id` | bigint | Who pardoned |
| `hidden` | boolean | Hidden from user |
| `jump_url` | text | Discord message link |

#### `InfractionAppeal`
Appeals for infractions.

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer | Primary key |
| `infraction_id` | integer | FK → Infraction |
| `appeal_text` | text | Appeal content |
| `reviewed_by_id` | bigint | Reviewer |
| `approved` | boolean | Appeal decision |

#### `JailRoles`
Stored roles during jail.

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer | Primary key |
| `infraction_id` | integer | FK → Infraction |
| `stored_role_id` | bigint | FK → Role |

---

## Query Patterns

### Message Search

The main search function in `lib/db/queries.ts`:

```typescript
searchMessages({
  query?: string,        // Full-text search
  staffOnly?: boolean,   // Filter to staff messages
  ticketId?: number,     // Filter by ticket
  channelId?: bigint,    // Filter by channel
  limit?: number,        // Results per page (default: 50)
  offset?: number,       // Pagination offset
  staffRoleIds?: bigint[], // Role IDs for staff filtering
})
```

**SQL-level staff filtering** uses EXISTS subquery:
```sql
EXISTS (
  SELECT 1 FROM "UserRoles" 
  WHERE user_id = "Message".author_id 
  AND role_id = ANY($staffRoleIds)
)
```

### Mention Lookup

Batch lookup for all mentioned entities:
```typescript
getMentionsForMessages(messageResults) → {
  users: Record<string, { name, displayName, displayAvatar }>,
  roles: Record<string, { name, color }>,
  channels: Record<string, { name }>
}
```

---

## Performance Indexes

Applied via `migrations/001_add_search_indexes.sql`:

| Index | Table | Purpose |
|-------|-------|---------|
| `message_content_trgm_idx` | Message | Trigram GIN for fuzzy search (10-100x faster) |
| `user_roles_user_role_idx` | UserRoles | Staff filtering EXISTS subquery |
| `message_is_deleted_idx` | Message | Partial index for non-deleted |
| `message_content_created_idx` | Message | ORDER BY created_at DESC |

Requires `pg_trgm` extension:
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

---

## Migration Strategy

| Action | Auth Tables | Bot Tables |
|--------|-------------|------------|
| Schema changes | Drizzle migrations | Prisma (bot project) |
| Add indexes | SQL migrations | SQL migrations |
| Safe commands | `drizzle-kit generate`, `drizzle-kit migrate` | Never use drizzle-kit |

> [!WARNING]
> Never run `drizzle-kit push` - it will attempt to drop bot tables.

---

## Related Documentation

- [Architecture](./ARCHITECTURE.md)
- [API Reference](./API.md)
- [Performance Guide](./PERFORMANCE.md)
