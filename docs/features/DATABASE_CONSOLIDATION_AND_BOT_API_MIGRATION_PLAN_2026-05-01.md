# Database Consolidation And Bot API Migration Plan

## Executive Summary

The right end state is:

1. One schema owner.
2. One migration owner.
3. One write authority for shared business workflows.
4. Zero permanent schema duplication across Prisma and Drizzle.

The recommended owner is a TypeScript backend layer built around Drizzle, not Prisma. The Python bot should stop owning schema and migrations, and should instead call an internal typed API for shared reads and writes. The dashboard and website should not each own their own copy of the schema either; they should import a shared TypeScript database package or call the same internal backend service.

The key point is that a monorepo helps, but it is not the actual solution. The real problem is dual authority: Python Prisma owns one version of the database, while TypeScript Drizzle owns another. A monorepo without a single owner would only make the drift easier to look at.

## Decision

### Recommended Direction

Adopt Drizzle and TypeScript as the single source of truth for:

- schema definitions
- migrations
- write-side business rules
- internal API contracts for shared workflows

Move the Python bot to an internal API client for all shared-domain database access. The bot should retain Discord orchestration logic, message handling, sync coordination, and event-driven workflows, but should stop directly mutating the shared database.

### Not Recommended

Do not standardize on Prisma for everything.

That path would require re-centering two TypeScript systems around an ORM they are not currently built around, while still leaving you with cross-language ownership complexity. It solves less of the real problem than picking TypeScript as the owner and making Python a client.

### Important Boundary

Do not make the Next.js dashboard app itself the database owner.

The database owner should be a dedicated internal backend surface, ideally inside a monorepo, with these packages/apps:

- `apps/dashboard` for the Next.js UI
- `apps/info` or `apps/web` for the website/content app
- `apps/internal-api` for the service boundary the bot calls
- `packages/db-schema` for canonical Drizzle schema
- `packages/db-services` for domain services and transactions
- `packages/contracts` for OpenAPI or contract definitions plus generated clients
- `packages/observability` for logging, tracing, metrics helpers

## Current State

## Current Repositories

- `/home/brandon/dev/reverts-bot`
- `/home/brandon/dev/reverts-dashboard`
- `/home/brandon/dev/reverts-info`

## Current Ownership Reality

- The bot currently owns schema migrations through Prisma and runs `prisma generate` plus `prisma migrate deploy` on startup.
- The dashboard already uses Drizzle at runtime and carries a duplicate of bot-owned tables in TypeScript.
- The website also uses Drizzle and carries another duplicate of the shared tables.
- Drift already exists across the three schema surfaces.
- Migration history is already split and should not be force-merged replay-by-replay.

## Schema Inventory That Must Be Consolidated

### Repo: reverts-bot

1. `/home/brandon/dev/reverts-bot/schema.prisma`
   Role: current authoritative schema for bot-owned tables and bot migrations.
   Status: authoritative today, should become legacy after cutover.

2. `/home/brandon/dev/reverts-bot/migrations/*`
   Role: current authoritative migration history.
   Status: active today, should be archived after cutover.

3. `/home/brandon/dev/reverts-bot/entrypoint.sh`
   Role: startup lifecycle runs `prisma generate` and `prisma migrate deploy`.
   Status: must change during cutover, because bot startup should not own schema deployment long-term.

### Repo: reverts-dashboard

1. `/home/brandon/dev/reverts-dashboard/src/lib/db/schema.ts`
   Role: current runtime Drizzle schema used by the dashboard.
   Status: active, but contains duplicated definitions for Prisma-owned tables.

2. `/home/brandon/dev/reverts-dashboard/drizzle.config.ts`
   Role: Drizzle migration configuration.
   Status: active, but current `tablesFilter` excludes only `_prisma_migrations`, which is not strong enough if Drizzle is not yet the only owner.

3. `/home/brandon/dev/reverts-dashboard/schema.prisma`
   Role: stale Prisma copy.
   Status: drift source, should be deleted after confirming no runtime use.

4. `/home/brandon/dev/reverts-dashboard/drizzle/0000_initial_auth_tables.sql`
   Role: generated Drizzle auth migration.
   Status: active legacy artifact.

5. `/home/brandon/dev/reverts-dashboard/migrations/001_add_better_auth_tables.sql`
   Role: manual auth migration.
   Status: duplicate migration path; must be resolved and archived.

6. `/home/brandon/dev/reverts-dashboard/courses-schema/auth.ts`
   Role: old schema fragment.
   Status: duplicate and semantically inconsistent with current auth naming.

7. `/home/brandon/dev/reverts-dashboard/courses-schema/courses.ts`
   Role: old schema fragment.
   Status: duplicate.

8. `/home/brandon/dev/reverts-dashboard/courses-schema/progress.ts`
   Role: old schema fragment.
   Status: duplicate.

9. `/home/brandon/dev/reverts-dashboard/courses-schema/quizzes.ts`
   Role: old schema fragment.
   Status: duplicate.

10. `/home/brandon/dev/reverts-dashboard/courses-schema/index.ts`
    Role: re-export for the duplicate fragments.
    Status: delete once canonical package exists.

### Repo: reverts-info

1. `/home/brandon/dev/reverts-info/apps/app/src/lib/db/schema.ts`
   Role: second active Drizzle copy of shared tables.
   Status: duplicate, partially divergent.

2. `/home/brandon/dev/reverts-info/apps/app/src/lib/db/auth-schema.ts`
   Role: modular auth schema fragment.
   Status: active, candidate to fold into canonical package.

3. `/home/brandon/dev/reverts-info/apps/app/src/lib/db/blog-schema.ts`
   Role: blog/content tables.
   Status: active, should also move into canonical TypeScript schema package, but is not part of the Python bot migration surface.

4. `/home/brandon/dev/reverts-info/apps/app/drizzle.config.ts`
   Role: second Drizzle migration config.
   Status: duplicate migration owner if not consolidated.

## Exact Schema Differences To Resolve

## 1. Canonical Vs Stale Prisma Definitions

### `AssignmentStatusEnum`

- `reverts-bot/schema.prisma` and `reverts-dashboard/src/lib/db/schema.ts` currently use `OPEN`, `ON_HOLD`, `CLOSED`.
- `reverts-dashboard/schema.prisma` is stale and still uses `NEEDS_SUPPORT`, `INACTIVE`, `SELF_SUFFICIENT`, `PAUSED`, `NOT_READY`.
- `reverts-info/apps/app/src/lib/db/schema.ts` also uses the older five-value model.

Action:

- Choose one canonical enum and migrate all consumers to it before cutover.
- Based on current bot reality, `OPEN`, `ON_HOLD`, `CLOSED` is the likely practical canonical choice unless the five-state model is being intentionally revived.
- If the richer five-state model is still desired, formalize a state machine migration instead of allowing accidental drift.

## 2. `SupervisionNeed` Exists Only In The Stale / Divergent Surfaces

- Present in `reverts-dashboard/schema.prisma`.
- Present in `reverts-info/apps/app/src/lib/db/schema.ts`.
- Not present in `reverts-dashboard/src/lib/db/schema.ts`.
- Not present in the current active bot-backed Drizzle runtime in the dashboard.

Action:

- Decide explicitly whether `SupervisionNeed` is an abandoned experiment, a planned feature, or a required table.
- Do not carry it forward by inertia.
- If needed, add it to the canonical Drizzle schema with service-layer ownership and explicit API support.

## 3. User Profile Fields Drift

### `User.why_join` and `User.interest_in_islam`

- Present in `reverts-bot/schema.prisma`.
- Present in `reverts-dashboard/src/lib/db/schema.ts`.
- Missing from `reverts-info/apps/app/src/lib/db/schema.ts`.
- Missing from stale `reverts-dashboard/schema.prisma`.

Action:

- Preserve these fields in the canonical schema unless product has intentionally removed them.
- Confirm whether the website needs them for support, verification, or supervision flows.

## 4. Assignment Status Field Drift

### `AssignmentStatus.reason`

- Present in `reverts-bot/schema.prisma`.
- Present in `reverts-dashboard/src/lib/db/schema.ts`.
- Missing from `reverts-info/apps/app/src/lib/db/schema.ts`.

Action:

- Preserve `reason` in the canonical schema if it is still needed for support workflow explanation and auditability.

## 5. Revert Tag Drift

### `RevertTag.slug` and `RevertTag.kind`

- Present in `reverts-bot/schema.prisma`.
- Present in `reverts-dashboard/src/lib/db/schema.ts`.
- Missing from `reverts-info/apps/app/src/lib/db/schema.ts`.

Action:

- Preserve both fields in the canonical schema unless you deliberately want tags to lose stable identifiers and typed kind classification.
- `slug` is especially important if tags may appear in URLs, filters, seeds, or exports.

## 6. Auth Schema Fragment Drift

### Old fragment package in `courses-schema/`

- `courses-schema/auth.ts` defines `user`, `session`, `account`, `verification` tables.
- Active schema in dashboard and info uses `auth_user`, `auth_session`, `auth_account`, `auth_verification`.

Action:

- Remove the fragment package after moving all TypeScript schema ownership into one shared package.
- Do not preserve two naming systems.

## 7. Migration Ownership Drift

- Bot startup runs Prisma migrations.
- Dashboard has Drizzle-generated auth migrations.
- Dashboard also has a manual auth migration.
- Info has its own Drizzle migration config and migration output.

Action:

- Stop trying to preserve all migration chains as one replayable history.
- Archive legacy migrations and cut a new baseline under one owner.

## 8. Blog Tables Are Real But Separate From Bot Migration Scope

- `reverts-info/apps/app/src/lib/db/blog-schema.ts` introduces content tables not present in the dashboard.

Action:

- Include these in the unified TypeScript schema package if the repos merge.
- Exclude them from the bot API migration scope.
- Treat them as part of the broader TypeScript database consolidation, not the Python bot contract.

## Target End State

## Ownership Rules

1. Only one package defines the shared schema.
2. Only one service or package applies schema migrations.
3. Only one place owns transactions for shared workflows.
4. The bot becomes an API client for shared-domain persistence.
5. Dashboard and website either call shared domain services directly or call the same internal API when crossing process boundaries.

## Proposed Monorepo Shape

```text
apps/
  dashboard/
  info/
  internal-api/
  bot/                     # optional if eventually moved in
packages/
  db-schema/
  db-migrations/
  db-services/
  contracts/
  generated-python-client/
  observability/
```

## Preferred Internal API Principles

1. Domain-oriented endpoints, not raw table CRUD.
2. Idempotent write APIs where Discord retries are possible.
3. Batch-first APIs for sync flows.
4. Server-owned timestamps, actor stamping, audit metadata, and transaction boundaries.
5. Generated Python client from OpenAPI to preserve DX.

## Migration History Strategy

This is the part most teams get wrong.

Do not try to interleave old Prisma migrations and multiple Drizzle chains into one clean replayable timeline. That is mostly archaeology, not engineering value.

### Recommended Cutover Strategy

1. Choose the live production schema as the reality to preserve.
2. Dump production schema with a schema-only export.
3. Make the new canonical Drizzle schema match the live database exactly.
4. Create one new baseline migration under the unified TypeScript owner.
5. Mark that baseline as applied in every environment.
6. Archive old Prisma and pre-cutover Drizzle migrations in a `legacy-migrations/` area for audit only.
7. After the baseline, all new schema changes go through one Drizzle migration chain.

### What To Archive

- `/home/brandon/dev/reverts-bot/migrations/*`
- `/home/brandon/dev/reverts-dashboard/drizzle/*`
- `/home/brandon/dev/reverts-dashboard/migrations/001_add_better_auth_tables.sql`
- any migration output in `reverts-info` once its schema moves into the canonical package

### What To Remove After Cutover

- bot startup migration execution in `entrypoint.sh`
- stale Prisma copies in TypeScript repos
- duplicate schema fragments in `courses-schema/`
- per-app Drizzle ownership in multiple repos

## Detailed Bot Database Migration Inventory

The end state should be that the bot performs no direct shared-database queries through Prisma. Every call below should either move to the internal API or be deleted as part of decommissioning Prisma.

## 1. Supervision And Assignment Actions

### File: `/home/brandon/dev/reverts-bot/bot/actions/supervision.py`

1. `bot.db.user.find_first()`
   Type: read
   Purpose: validate the target user exists before assignment.
   Target API: `GET /internal/users/{discordId}` or folded into assignment command validation.

2. `bot.db.usersupervisor.create()`
   Type: write
   Purpose: create a supervisor assignment.
   Target API: `POST /internal/supervision/assignments`
   Notes: service should enforce uniqueness and deactivate prior active assignment if the business rule requires single active supervisor.

### File: `/home/brandon/dev/reverts-bot/bot/actions/users.py`

1. `bot.db.user.find_many(...)`
   Type: read
   Purpose: complex query for assignable reverts with nested filters over `AssignmentStatus`, `UserSupervisor`, and `UserRoles`.
   Target API: `GET /internal/reverts/assignable`
   Notes: do not expose raw filter grammar to Python; create a typed query contract.

### File: `/home/brandon/dev/reverts-bot/bot/actions/assignment_status.py`

1. `bot.db.assignmentstatus.find_first()`
   Type: read
   Purpose: fetch current active assignment status.
   Target API: `GET /internal/assignments/{userId}/status`

2. `bot.db.user.find_first()`
   Type: read
   Purpose: validate user exists before status change.
   Target API: fold into status mutation validation.

3. `bot.db.tx()` with `.update_many()` and `.create()`
   Type: transaction, write
   Purpose: atomically deactivate prior active rows and append a new status row.
   Target API: `POST /internal/assignments/{userId}/status-transitions`
   Notes: this exact transactional state machine belongs in the TypeScript service.

4. `bot.db.assignmentstatus.delete_many()`
   Type: delete
   Purpose: hard delete by user id.
   Target API: should not be preserved as a hard delete by default.
   Notes: replace with a service-owned soft-close or archival operation unless you have a legal reason to destroy records.

5. `bot.db.assignmentstatus.delete_many()`
   Type: delete
   Purpose: cleanup expired statuses.
   Target API: move to internal scheduled cleanup job or state transition job, not a bot command.

6. `bot.db.user.find_many()`
   Type: read
   Purpose: list users by assignment status.
   Target API: `GET /internal/assignments/users?status=...`

## 2. Ticket Workflows

### File: `/home/brandon/dev/reverts-bot/bot/exts/tickets/service.py`

1. `bot.db.ticket.find_first()`
   Type: read
   Purpose: check if an open ticket already exists for `(author_id, status, panel_id)`.
   Target API: fold into ticket create-or-get endpoint.

2. `bot.db.user.upsert()`
   Type: upsert
   Purpose: ensure the author exists and refresh profile fields.
   Target API: fold into ticket create-or-get endpoint.

3. `bot.db.ticket.create()`
   Type: write
   Purpose: create ticket row.
   Target API: `POST /internal/tickets`

4. `bot.db.ticket.count()`
   Type: read
   Purpose: derive ticket sequence per panel.
   Target API: server-managed inside ticket creation transaction.
   Notes: do not let the bot compute this.

5. `bot.db.ticket.update()`
   Type: write
   Purpose: backfill `channel_id`, `ticket_view_message_id`, `controls_view_message_id`, and sequence after Discord resources are created.
   Target API: `POST /internal/tickets/{id}/bindings`

6. `bot.db.panel.find_unique()`
   Type: read
   Purpose: fetch panel metadata.
   Target API: `GET /internal/ticket-panels/{id}` or cached config endpoint.

7. `bot.db.infraction.find_first()`
   Type: read
   Purpose: fetch active jail infraction and appeal context.
   Target API: `GET /internal/infractions/jail-state?userId=...`

### File: `/home/brandon/dev/reverts-bot/bot/exts/tickets/actions.py`

1. `bot.db.ticket.find_first()`
   Type: read
   Purpose: resolve ticket by Discord channel.
   Target API: `GET /internal/tickets/by-channel/{channelId}`

2. `bot.db.ticket.update()`
   Type: write
   Purpose: close ticket.
   Target API: `POST /internal/tickets/{id}/close`

3. `bot.db.ticket.update()`
   Type: write
   Purpose: store `controls_view_message_id`.
   Target API: same binding endpoint as above.

4. `bot.db.ticket.find_first()` with panel include
   Type: read
   Purpose: fetch ticket plus panel context.
   Target API: `GET /internal/tickets/by-channel/{channelId}?include=panel`

5. `bot.db.ticket.update()`
   Type: write
   Purpose: store `transcript_message_id`.
   Target API: `POST /internal/tickets/{id}/transcript`

### File: `/home/brandon/dev/reverts-bot/bot/exts/tickets/tickets.py`

1. `bot.db.ticket.find_many()`
   Type: read
   Purpose: load open and closed tickets on startup to reattach views.
   Target API: `GET /internal/tickets/bootstrap`
   Notes: can be cached and paginated.

2. `bot.db.ticket.update()`
   Type: write
   Purpose: mark a ticket as deleted when the Discord channel is missing.
   Target API: `POST /internal/tickets/{id}/delete`

3. `bot.db.infraction.find_first()`
   Type: read
   Purpose: load jail appeal state for ticket UI.
   Target API: same jail-state lookup endpoint.

### File: `/home/brandon/dev/reverts-bot/bot/exts/tickets/verification.py`

1. `bot.db.ticket.find_first()`
   Type: read
   Purpose: find open verification ticket for cleanup.
   Target API: `GET /internal/tickets/open-verification?userId=...`

2. `bot.db.user.find_first()`
   Type: read
   Purpose: fetch verification status or intake answers.
   Target API: `GET /internal/users/{discordId}/verification`

3. `bot.db.ticket.find_first()`
   Type: read
   Purpose: resolve verification ticket by channel id.
   Target API: `GET /internal/tickets/by-channel/{channelId}`

4. `bot.db.user.find_first()`
   Type: read
   Purpose: inspect `relation_to_islam` and related gating fields.
   Target API: same verification read endpoint.

5. `bot.db.user.find_first()`
   Type: read
   Purpose: pre-flight before verification write.
   Target API: fold into verification write path.

6. `bot.db.user.update()`
   Type: write
   Purpose: set `is_verified`, `is_voice_verified`, and verifier ids.
   Target API: `POST /internal/users/{discordId}/verification`

## 3. Moderation And Infractions

### File: `/home/brandon/dev/reverts-bot/bot/exts/moderation/infractions.py`

1. `bot.db.infraction.find_first()`
   Type: read
   Purpose: ensure no duplicate active jail exists.
   Target API: fold into jail creation precondition.

2. `bot.db.infraction.create()`
   Type: write
   Purpose: create jail infraction.
   Target API: `POST /internal/infractions/jail`

3. `bot.db.jailroles.create()` in a loop
   Type: write
   Purpose: store current member roles before jailing.
   Target API: fold into jail creation transaction as a batch payload.

4. `bot.db.infraction.find_first()` with `JailRoles`
   Type: read
   Purpose: restore context on unjail.
   Target API: `GET /internal/infractions/jail-state?userId=...`

5. `bot.db.infraction.update()`
   Type: write
   Purpose: mark jail as pardoned or appeal-approved.
   Target API: `POST /internal/infractions/{id}/resolve`

## 4. Guild Sync

### File: `/home/brandon/dev/reverts-bot/bot/exts/sync/sync.py`

1. `channel.find_many()`
   Type: read
   Purpose: baseline comparison against Discord channel state.
   Target API: `GET /internal/sync/channels/snapshot`

2. `channel.create_many()`
   Type: write
   Purpose: batch create new channels.
   Target API: `POST /internal/sync/channels/batch`

3. `channel.update()`
   Type: write
   Purpose: sync channel renames, moves, and flags.
   Target API: same batch endpoint with upsert semantics.

4. `role.find_many()`
   Type: read
   Purpose: baseline role snapshot.
   Target API: `GET /internal/sync/roles/snapshot`

5. `role.create_many()`
   Type: write
   Purpose: batch create roles.
   Target API: `POST /internal/sync/roles/batch`

6. `role.update()`
   Type: write
   Purpose: sync role metadata.
   Target API: same batch endpoint.

7. `user.find_many()`
   Type: read
   Purpose: baseline user snapshot.
   Target API: `GET /internal/sync/users/snapshot`

8. `userroles.find_many()`
   Type: read
   Purpose: compare role assignments.
   Target API: `GET /internal/sync/user-roles/snapshot`

9. `user.create_many()`
   Type: write
   Purpose: batch create new guild members.
   Target API: `POST /internal/sync/users/batch`

10. `user.update()`
    Type: write
    Purpose: sync user metadata.
    Target API: same batch endpoint with patch semantics.

11. `userroles.create_many()`
    Type: write
    Purpose: sync user-role relationships.
    Target API: `POST /internal/sync/user-roles/batch`

Important note:

- Never migrate sync by replacing each row-level DB call with one HTTP call.
- Expose coarse batch endpoints or a single sync ingestion endpoint.
- If sync becomes high-volume, consider a queue or append-only ingestion log.

## 5. Supervisor Assignment Commands

### File: `/home/brandon/dev/reverts-bot/bot/exts/supervision/assignment.py`

1. `bot.db.user.find_first()`
   Type: read
   Purpose: validate gender or eligibility before assignment.
   Target API: fold into assignment validation or user profile endpoint.

2. `bot.db.usersupervisor.update_many()`
   Type: write
   Purpose: deactivate all active assignments before reassignment.
   Target API: internal transaction inside assignment command endpoint.

3. `bot.db.usersupervisor.create()`
   Type: write
   Purpose: create the new active assignment.
   Target API: `POST /internal/supervision/assignments`

4. `bot.db.usersupervisor.find_many()`
   Type: read
   Purpose: list all active assignments for a supervisor.
   Target API: `GET /internal/supervisors/{discordId}/assignments`

## 6. Reachout And Campaign Workflows

### File: `/home/brandon/dev/reverts-bot/bot/exts/supervision/reachout/campaign.py`

1. `bot.db.reachoutlog.create()`
   Type: write
   Purpose: create a reachout log entry before message id is known.
   Target API: `POST /internal/reachout/logs`

2. `bot.db.reachoutlog.update()`
   Type: write
   Purpose: backfill the sent message id.
   Target API: `POST /internal/reachout/logs/{id}/sent`

3. `bot.db.user.find_first()`
   Type: read
   Purpose: validate target user.
   Target API: fold into campaign execution service.

4. `bot.db.supportnotification.create()`
   Type: write
   Purpose: create support notification row.
   Target API: `POST /internal/support/notifications`

5. `bot.db.supportnotification.update()`
   Type: write
   Purpose: store the staff notification message id.
   Target API: `POST /internal/support/notifications/{id}/sent`

6. `bot.db.usersupervisor.find_first()`
   Type: read
   Purpose: determine whether the user already has a supervisor.
   Target API: fold into campaign decision endpoint.

7. `bot.db.assignmentstatus.find_first()`
   Type: read
   Purpose: get current assignment state.
   Target API: fold into campaign decision endpoint.

8. `bot.db.assignmentstatus.find_first()`
   Type: read
   Purpose: get active `OPEN` status for linking.
   Target API: fold into support notification creation.

9. `bot.db.user.find_many()`
   Type: read
   Purpose: select campaign targets.
   Target API: `GET /internal/campaigns/{id}/eligible-users` or service-owned campaign executor.

10. `bot.db.supportnotification.find_first()`
    Type: read
    Purpose: avoid duplicate notifications.
    Target API: fold into idempotent notification creation.

### File: `/home/brandon/dev/reverts-bot/bot/exts/supervision/reachout/_reachout.py`

1. `bot.db.reachoutlog.update_many()`
   Type: write
   Purpose: bulk mark responses.
   Target API: `POST /internal/reachout/logs/responded`

2. `bot.db.reachoutlog.create()`
   Type: write
   Purpose: create post-verification reachout entry.
   Target API: same logs creation endpoint.

3. `bot.db.reachoutlog.update()`
   Type: write
   Purpose: store sent message id.
   Target API: same sent-binding endpoint.

4. `bot.db.reachoutlog.find_many()`
   Type: read
   Purpose: reload pending reachout messages after restart.
   Target API: `GET /internal/reachout/logs/pending`

## 7. Bot-Exposed HTTP Route

### File: `/home/brandon/dev/reverts-bot/bot/api/routes/check_ins.py`

- No direct Prisma calls were identified here.
- It wraps ticket creation logic from the ticket service layer.
- During migration, this route should switch to the generated internal API client instead of importing service logic backed by Prisma.

## Migration Priority For Bot Operations

### Phase 1: Highest Priority

1. Ticket create-or-get flow
2. Ticket lifecycle writes
3. Supervisor assignment writes
4. Assignment status state machine
5. Verification status writes

Reason:

- These are business-critical shared workflows.
- They have the highest drift and transaction risk.
- They are the areas where dual ownership hurts most.

### Phase 2: Medium Priority

1. Moderation infractions and jail role preservation
2. Reachout logs and support notifications
3. Startup bootstrap reads for tickets and reachouts

### Phase 3: Lower Priority But Still Required For Final End State

1. Sync snapshot reads
2. Sync batch writes
3. Remaining read-only helpers

## Internal API Surface To Build

## Domain Groups

1. Tickets
2. Supervision
3. Assignment statuses
4. Users and verification
5. Infractions
6. Reachout and support notifications
7. Sync ingestion
8. Reference data such as panels

## Minimal First Endpoint Set

```text
POST /internal/tickets
POST /internal/tickets/{id}/bindings
POST /internal/tickets/{id}/close
POST /internal/tickets/{id}/delete
GET  /internal/tickets/by-channel/{channelId}
GET  /internal/tickets/bootstrap

POST /internal/supervision/assignments
GET  /internal/supervisors/{discordId}/assignments

GET  /internal/assignments/{userId}/status
POST /internal/assignments/{userId}/status-transitions
GET  /internal/assignments/users
GET  /internal/reverts/assignable

GET  /internal/users/{discordId}
GET  /internal/users/{discordId}/verification
POST /internal/users/{discordId}/verification

POST /internal/infractions/jail
GET  /internal/infractions/jail-state
POST /internal/infractions/{id}/resolve

POST /internal/reachout/logs
POST /internal/reachout/logs/{id}/sent
POST /internal/reachout/logs/responded
GET  /internal/reachout/logs/pending

POST /internal/support/notifications
POST /internal/support/notifications/{id}/sent

GET  /internal/ticket-panels/{id}

GET  /internal/sync/channels/snapshot
POST /internal/sync/channels/batch
GET  /internal/sync/roles/snapshot
POST /internal/sync/roles/batch
GET  /internal/sync/users/snapshot
POST /internal/sync/users/batch
GET  /internal/sync/user-roles/snapshot
POST /internal/sync/user-roles/batch
```

## Consolidation Plan By Phase

## Phase 0: Freeze And Inventory

1. Freeze new schema changes across all three repos until the canonical owner is chosen and documented.
2. Add a short architecture record stating that TypeScript plus Drizzle will own schema and migrations after cutover.
3. Mark these files as legacy in docs immediately:
   - `reverts-dashboard/schema.prisma`
   - `reverts-dashboard/courses-schema/*`
   - legacy Prisma migration history in `reverts-bot`
4. Confirm which enum model for assignment statuses is canonical.
5. Confirm whether `SupervisionNeed` is real or dead.

Exit criteria:

- no new schema changes land in duplicate files
- one decision document exists

## Phase 1: Build The Canonical TypeScript DB Layer

1. Create a shared `db-schema` package.
2. Move canonical tables into that package.
3. Split schema by domain but export one canonical surface:
   - auth
   - guild sync
   - tickets
   - supervision
   - moderation
   - courses
   - ramadan
   - blog
4. Create a `db-services` package for transactions and domain logic.
5. Create one `drizzle.config.ts` for the unified migration owner.
6. Remove per-app schema copies by converting them into imports from the shared package.

Exit criteria:

- dashboard and info compile against the shared schema package
- there is only one active Drizzle migration config for shared tables

## Phase 2: Create The Internal API Service

1. Stand up `apps/internal-api` using the team’s preferred TypeScript backend framework.
2. Add OpenAPI generation.
3. Generate a Python client from the contract.
4. Move business rules into service-layer functions, not route handlers.
5. Implement authentication between bot and service using service tokens or mTLS.

Exit criteria:

- bot can call a generated Python client against non-production environments
- all write endpoints are contract-tested

## Phase 3: Migrate High-Risk Writes First

1. Ticket create-or-get and ticket lifecycle writes.
2. Supervisor assignment creation and reassignment.
3. Assignment status transition state machine.
4. Verification writes.
5. Moderation jail and unjail writes.

Delivery rule:

- each migrated bot command must stop calling Prisma directly before moving to the next slice

Exit criteria:

- no direct Prisma writes remain in ticket, assignment, verification, or moderation flows

## Phase 4: Migrate Shared Reads And Bootstraps

1. Ticket bootstrap reads.
2. Reachout pending-log bootstrap reads.
3. Assignable reverts query.
4. Jail-state reads.
5. Assignment-status list reads.

Exit criteria:

- direct Prisma reads are limited to sync only, or fully removed if sync endpoints are already ready

## Phase 5: Migrate Sync To Batch APIs

1. Build snapshot endpoints.
2. Build batch upsert endpoints.
3. Move channel sync.
4. Move role sync.
5. Move user sync.
6. Move user-role sync.

Exit criteria:

- no Prisma runtime dependency remains in the bot
- sync throughput is benchmarked and accepted

## Phase 6: Cut Over Migrations

1. Build a schema-only production snapshot.
2. Reconcile canonical Drizzle schema to exactly match the live database.
3. Create the cutover baseline migration.
4. Mark it applied in every environment.
5. Remove Prisma migration execution from bot startup.
6. Archive old migrations.

Exit criteria:

- one migration owner remains
- bot startup no longer runs Prisma commands

## Phase 7: Decommission Legacy Files

Delete or archive:

1. `reverts-bot/schema.prisma`
2. `reverts-bot/migrations/*` from the active toolchain
3. `reverts-dashboard/schema.prisma`
4. `reverts-dashboard/courses-schema/*`
5. duplicate schema copies in `reverts-info`
6. legacy dashboard manual migration path

Exit criteria:

- one schema owner
- one migration chain
- zero runtime Prisma dependency for shared tables

## Logging Standards

These are required, not optional, because you are turning in-process DB calls into distributed calls.

## Structured Logging

Use structured JSON logs in both bot and service with these fields where relevant:

- `timestamp`
- `level`
- `service`
- `environment`
- `request_id`
- `trace_id`
- `span_id`
- `discord_event_id`
- `guild_id`
- `channel_id`
- `user_id`
- `ticket_id`
- `assignment_status_id`
- `operation`
- `endpoint`
- `outcome`
- `latency_ms`
- `retry_count`
- `error_code`

## Audit Logging

Create append-only audit events for critical workflow mutations:

- ticket created
- ticket closed
- ticket deleted
- supervisor assigned
- assignment status changed
- user verified
- infraction created
- infraction resolved
- support notification created
- tag assigned or removed
- check-in recorded

Audit records should capture:

- actor id
- actor type
- source system (`bot`, `dashboard`, `internal-api`, `worker`)
- target entity
- before and after summaries where applicable
- idempotency key if used

## Error Handling Standards

## Domain Errors

Do not leak raw database exceptions over the API.

Map service errors into typed domain errors such as:

- `USER_NOT_FOUND`
- `TICKET_ALREADY_OPEN`
- `INVALID_ASSIGNMENT_TRANSITION`
- `INFRACTION_ALREADY_ACTIVE`
- `CONFLICTING_SYNC_VERSION`
- `VALIDATION_ERROR`
- `RATE_LIMITED`
- `DEPENDENCY_UNAVAILABLE`

## Idempotency

Use idempotency keys for any write the bot may retry, especially:

- ticket creation
- support notification creation
- reachout log creation
- jail creation
- verification updates
- sync batch ingestion

## Retries

Retry only when:

- the endpoint is explicitly idempotent
- the error is transient
- the service indicates retry safety

Do not retry validation failures or state-machine conflicts.

## Circuit Breaking

The bot should implement:

1. bounded retry count
2. exponential backoff with jitter
3. circuit breaker for sustained internal API failure
4. graceful operator-facing error messages when the service is unavailable

## Observability Plan

## Tracing

Adopt OpenTelemetry across bot and internal API.

Every bot command or event handler that calls the internal API should create or continue a trace. Pass trace context over HTTP so you can correlate:

- Discord event reception
- bot-side decision making
- internal API request
- service-layer domain function
- database query execution

## Metrics

### API Metrics

- request count by endpoint and outcome
- latency histogram by endpoint
- error rate by endpoint and error code
- DB transaction count
- DB query latency histogram
- DB deadlock and timeout counts

### Domain Metrics

- tickets created per panel
- ticket close latency
- assignment status transitions by type
- supervisor assignment count
- infractions created and resolved
- reachout attempts and response rate
- support notifications created and claimed
- verification completions

### Bot Metrics

- internal API call latency and failure rate
- retry count by operation
- queue depth if async job dispatch is introduced
- bootstrap read duration on restart
- sync batch size and sync duration
- commands blocked by dependency outage

## Dashboards

Create dashboards for:

1. internal API health
2. ticket workflow health
3. support workflow health
4. sync health
5. migration cutover health

## Alerts

Alert on:

1. sustained 5xx rate above threshold
2. ticket creation failure spikes
3. assignment transition failure spikes
4. sync ingestion lag or backlog
5. error budget burn rate
6. schema drift detector failures
7. unexpected residual Prisma usage after cutover

## How To Prove The System Is Working During Migration

## Shadow Mode

Before fully cutting over a flow, add shadow reads or dual execution where safe:

1. bot calls the new API
2. bot optionally compares the API result with the old Prisma read in non-destructive mode
3. differences are logged and surfaced in a migration dashboard

Do this for read-heavy bootstrap and lookup flows first.

## Dual-Write Avoidance

Avoid long-running dual writes. They create reconciliation problems.

Preferred approach:

1. shadow read
2. canary write for a limited feature or staff cohort
3. full cutover
4. remove old path quickly

## Rollout Controls

Add feature flags for:

- ticket API path
- assignment API path
- moderation API path
- reachout API path
- sync API path

## Testing Plan

## Contract Tests

1. OpenAPI contract tests for every internal endpoint.
2. Generated Python client tests against mocked and real dev environments.

## Service Tests

1. transaction behavior tests
2. state-machine tests for assignment transitions
3. idempotency tests for ticket creation and notifications
4. concurrency tests for sequence generation and reassignment
5. permission tests for bot-only endpoints and staff endpoints

## Bot Integration Tests

1. ticket creation against the internal API
2. ticket reopen and close
3. supervisor assignment and reassignment
4. verification completion
5. jail and unjail
6. reachout log lifecycle
7. sync batch submission

## Data Validation Checks

Run these before and after cutover:

1. row counts by table
2. nullability violations
3. enum distribution checks
4. orphan detection on key relations
5. ticket uniqueness checks
6. active assignment uniqueness checks
7. role and user sync consistency checks

## Risks And Mitigations

## Risk: Service Dependency Adds Failure Mode

Mitigation:

- internal API HA deployment
- retries plus circuit breaker
- strong observability
- batch APIs for high-volume flows

## Risk: Migration History Is Too Messy To Replay Cleanly

Mitigation:

- use a baseline cutover instead of replay unification
- archive legacy chains for audit only

## Risk: Sync Becomes Slower Over HTTP

Mitigation:

- batch endpoints
- optional queue-backed ingestion
- benchmark against current sync timings before full cutover

## Risk: TypeScript Repos Continue To Drift Internally

Mitigation:

- one shared schema package
- one shared domain-service package
- forbid local table definitions by lint rule or code review rule

## What Was Missing From The Original Ask That Should Be Included

These items are important and should be treated as part of the plan:

1. Internal service authentication and authorization between bot and API.
2. Generated Python client to preserve DX and reduce handwritten request drift.
3. Idempotency keys and retry policy for Discord-triggered writes.
4. Audit logging for moderation and support workflows.
5. Trace propagation across bot and service.
6. A baseline migration cutover strategy instead of trying to merge old histories linearly.
7. Explicit decommissioning of `prisma generate` and `prisma migrate deploy` from bot startup.
8. Batch API design for sync so performance does not collapse.
9. A clear decision on whether `SupervisionNeed` still belongs in the product.
10. A clear decision on the canonical assignment-status state model.

## Final Recommendation

If you want the best balance of DX, speed, and long-term correctness, do this:

1. Consolidate into a monorepo or shared package topology.
2. Make Drizzle the only schema and migration owner.
3. Stand up a dedicated internal TypeScript API service.
4. Move the Python bot to a generated client for shared-domain reads and writes.
5. Cut a fresh baseline migration chain instead of trying to salvage a single replayable history from today’s mixed state.

That path is the cleanest way out of schema drift without giving up TypeScript DX or operational clarity.

## Clarifications

## Where The Internal API Should Live

If you want to use ElysiaJS and keep hosting on Vercel, the cleanest shape is:

1. Host the internal API as a dedicated Vercel project or Vercel app inside the monorepo.
2. Implement it with Elysia.
3. Keep the dashboard and website as separate Vercel apps if needed, but have them depend on the same shared packages.

The important distinction is between a separate service boundary and a separate hosting provider. You do not need your own hardware. A separate Elysia internal API can still be deployed on Vercel.

### Recommended Vercel Layout

```text
apps/
   dashboard/      -> Vercel project 1
   info/           -> Vercel project 2
   internal-api/   -> Vercel project 3
packages/
   db-schema/
   db-services/
   contracts/
   observability/
```

### Why This Is Better Than Letting The Dashboard App Also Be The Bot Backend

1. It gives the bot a stable contract that is not tied to dashboard UI deployment cadence.
2. It keeps auth and internal service security separate from browser-facing concerns.
3. It lets you scale API traffic, dashboard traffic, and site traffic independently.
4. It keeps route ownership clear: browser routes belong to apps, bot/domain routes belong to the internal API.

### Vercel-Specific Constraint

The bot cannot use Eden in the same zero-network way that TypeScript apps can, because the bot is Python and runs out of process. That means the bot will always cross the network to Vercel. The right optimization is not eliminating the hop, but making the contract generation and batch APIs good enough that the hop is cheap and safe.

### Practical Recommendation

Use Elysia for:

- the internal API app
- the dashboard API routes if you keep them
- shared route composition patterns

But centralize the shared business routes in one internal API app deployed on Vercel, not spread across multiple app-local route trees.

## How To Make Type Generation Seamless

The current setup is already showing the right split:

1. TypeScript-to-TypeScript uses Eden effectively.
2. The current OpenAPI flow for the bot is awkward because it pulls from a running server URL.

### What Exists Today

In the dashboard repo:

- `/home/brandon/dev/reverts-dashboard/src/app/api/[[...slugs]]/route.ts` exports `type App = typeof app`, which is exactly what Eden wants.
- `/home/brandon/dev/reverts-dashboard/src/lib/eden.ts` already gives TypeScript consumers compile-time API typing from Elysia.
- `/home/brandon/dev/reverts-dashboard/package.json` has `generate:types`, but it currently fetches from `http://localhost:8080/openapi.json`, which is why it is not seamless.
- `/home/brandon/dev/reverts-dashboard/src/lib/bot-api.d.ts` is generated from a live OpenAPI endpoint.

### Recommended End State For Types

Use two client-generation paths from one source tree:

1. `Eden` for TypeScript consumers inside the monorepo.
2. `OpenAPI` plus generated Python client for the bot.

That gives you the best DX in both languages.

### What To Change

Do not generate types by pulling from a running dev server.

Instead:

1. Define the Elysia app in the internal API repo.
2. Generate the OpenAPI spec from source during build or dev tasks.
3. Commit the generated spec or write it to a deterministic file in the repo.
4. Generate both TypeScript OpenAPI types and the Python client from that local artifact, not from `localhost`.

### Best Workflow

```text
internal-api source
   -> generate openapi.json
   -> generate TS openapi client/types
   -> generate Python client package
   -> workspace build graph updates dependents automatically
```

### Recommended Tooling Model

1. Keep `Eden` for TypeScript apps that live in the same monorepo.
2. Generate `openapi.json` from the Elysia app as a file artifact.
3. Use a codegen step to generate a Python package from that file.
4. Make the bot depend on the local generated package through the monorepo workflow.

### What “Seamless” Should Mean In Practice

When you change an endpoint shape:

1. the internal API type changes immediately in TypeScript via Eden
2. the OpenAPI artifact regenerates automatically
3. the Python client regenerates automatically
4. the bot typechecks fail immediately if it consumes the old contract

That is the real target. It does not mean the running bot magically hot-reloads new Python client code in production. It means local development and CI should regenerate contracts automatically with no manual fetch step.

### Concrete Implementation Pattern

Use a workspace task graph, for example:

1. `contracts:generate` in `apps/internal-api`
2. `client:python:generate` in `packages/contracts`
3. `bot:typecheck` depends on `client:python:generate`
4. `dashboard:typecheck` depends on the internal API package build

### Why This Is Better Than OpenAPI-Only For Everyone

If you force TypeScript consumers to use only OpenAPI-generated types, you give up the nicest part of Elysia plus Eden, which you already have. The better split is:

- TypeScript uses Eden from source
- Python uses generated client from OpenAPI artifact

That keeps both sides ergonomic.

## Benefits Of Moving The Python Bot Into The Monorepo

Moving the bot into the monorepo is not required, but it gives real advantages even if the bot stays Python.

### Pros

1. One place to change the API contract and regenerate both TypeScript and Python clients.
2. One CI graph, so API changes can immediately run bot contract checks before merge.
3. Easier atomic pull requests when a route change requires dashboard, service, and bot updates together.
4. Easier ownership of shared docs, architecture records, and migration plans.
5. Easier versioning of generated Python client packages, because they can be produced from the same commit as the server.
6. Fewer “which repo is actually authoritative?” mistakes.
7. Easier local development, because one workspace can run the API, dashboard, and bot integration checks together.
8. Easier enforcement of schema ownership rules, because the canonical package is visible to every consumer in one repo.
9. Easier rollout coordination for breaking contract changes.
10. Easier observability standardization, because bot and API logging conventions can live side by side.
11. Easier code search across route definitions, DB services, and bot call sites.
12. Easier refactors when renaming fields or endpoints across languages.

### Important Non-Benefit

Moving the bot into the monorepo does not remove the fact that it is Python and the API is TypeScript. You still need generated cross-language contracts. The monorepo just makes that workflow much easier to automate and enforce.

### When The Monorepo Is Most Valuable

It is especially valuable if you want:

1. automatic client generation
2. one PR for one contract change
3. one CI run to catch drift immediately
4. one release train for coordinated server and bot changes

If you keep the bot in a separate repo, the architecture still works, but the contract-generation workflow will always be a little less smooth because you now need cross-repo publishing or sync automation.