# Revert Support Implementation Plan

> Detailed implementation plan for simplifying revert support in the dashboard, adding supervisor-note creation, retiring `SupervisionNeed`, and introducing the first support-state redesign pass while explicitly deferring campaign work.

## Metadata

- Date: 2026-04-28
- Status: Review Draft
- Audience: Dashboard engineering, bot engineering, product, moderators, supervisors
- Related inputs:
  - [REVERT_SUPPORT_CONSOLIDATED_REVIEW_2026-04-28.md](./REVERT_SUPPORT_CONSOLIDATED_REVIEW_2026-04-28.md)
  - [STAFF_DASHBOARD_CONSOLIDATION_PLAN_2026-04-23.md](./STAFF_DASHBOARD_CONSOLIDATION_PLAN_2026-04-23.md)
  - [STAFF_DASHBOARD_PHASE_1_IMPLEMENTATION_PLAN_2026-04-23.md](./STAFF_DASHBOARD_PHASE_1_IMPLEMENTATION_PLAN_2026-04-23.md)
  - [continuation_context.md](../../continuation_context.md)

## Clarifications From Review

### 1. Where the support-state reason should live

The support-state reason is in scope for this plan.

It should live on the existing `AssignmentStatus` table rather than in a separate table or in tag-only conventions.

Recommended storage:

- table: current `AssignmentStatus`
- column: `reason`
- type: nullable short controlled string such as `varchar(64)`

Suggested initial values:

- `requested_support`
- `manual_triage`
- `paused`
- `not_ready`
- `self_sufficient`
- `inactive`
- `resolved`

### 2. Why `reason` and not `reasonKey`

`reasonKey` was only meant to signal that the value should be a controlled identifier rather than arbitrary prose.

For this codebase, `reason` is better because:

- it is shorter and clearer
- it reads better in schema, queries, and API payloads
- the controlled-list behavior belongs in validation and docs, not in the field name

If the column stores the canonical machine-readable value directly, `reason` is the simplest correct name.

### 3. How the reason should be set

Manual state changes:

- staff choose the next support state
- if that state has multiple valid reasons, staff choose a reason from a short controlled list
- staff can optionally add freeform notes in the existing `notes` field

Automated state changes:

- bot or dashboard code sets a default `reason` when the action source is known

Examples:

- staff sets state to `OPEN` from the dashboard and chooses `manual_triage`
- user responds positively to a support workflow and system sets `OPEN` plus `requested_support`
- staff unassigns a user and sets `ON_HOLD` plus `paused`

### 4. `UserSupervisorEntries` is confirmed to be notes

Treat `UserSupervisorEntries` as supervisor notes, not assignment history.

Implementation consequence:

- do not rename the database table in the first pass
- rename the product and API language to `Supervisor Notes`
- add a dashboard write path for note creation
- leave assignment-history redesign for later

### 5. Campaign work is out of scope for this plan

Do not change campaigns, reachout targeting, or `SupportNotification` behavior in this implementation plan.

This plan focuses on:

- daily staff clarity
- support-state simplification
- support-state reason support
- retiring `SupervisionNeed`
- governed tag groundwork
- supervisor note creation

## Scope

### In Scope Now

1. Retire `SupervisionNeed` from dashboard and bot usage.
2. Rename staff-facing `Assignment Status` language to `Support State`.
3. Simplify the persisted support-state enum.
4. Add nullable `reason` support to support state.
5. Add dashboard support for creating supervisor notes.
6. Remove `SupervisionNeed`-derived counters and signals from dashboard lists.
7. Add the groundwork for governed system tags vs custom tags.
8. Update documentation and API/types to match the new model.

### Explicitly Deferred

1. Campaign redesign.
2. `SupportNotification` retirement.
3. `ReachoutLog` rename.
4. Assignment-history redesign beyond the existing note timeline.

## Implementation Strategy

Use two coordinated tracks:

- Non-UI track
  - schema, migrations, queries, APIs, hooks, docs, bot coordination
- UI track
  - labels, forms, filters, sections, state presentation

Because `AssignmentStatus` is bot-owned in practice, support-state simplification must be coordinated across both repos before the dashboard UI switches over fully.

## Target Support-State Design For This Phase

### New Top-Level States

- `OPEN`
- `ON_HOLD`
- `CLOSED`

### Initial Reason Set

- for `OPEN`
  - `requested_support`
  - `manual_triage`
- for `ON_HOLD`
  - `paused`
  - `not_ready`
- for `CLOSED`
  - `self_sufficient`
  - `inactive`
  - `resolved`

### Compatibility Mapping

| Current status | New state | New reason |
| --- | --- | --- |
| `NEEDS_SUPPORT` | `OPEN` | `requested_support` or `manual_triage` |
| `PAUSED` | `ON_HOLD` | `paused` |
| `NOT_READY` | `ON_HOLD` | `not_ready` |
| `SELF_SUFFICIENT` | `CLOSED` | `self_sufficient` |
| `INACTIVE` | `CLOSED` | `inactive` |

### Important Product Rule

Staff should choose from a small state list first.

Reason is secondary context, not a second primary status system.

## Phase 1: Schema And API Contract Alignment

### Goal

Make the underlying support-state model and API shape match the simplified staff model.

### Expected Result

- support-state persistence uses `OPEN | ON_HOLD | CLOSED`
- `AssignmentStatus` gains nullable `reason`
- dashboard and bot can both read and write the new state model
- `SupervisionNeed` is removed from dashboard data flows

## Phase 2: Dashboard Terminology And Note Creation

### Goal

Expose the simplified model clearly in the dashboard and add supervisor-note creation.

### Expected Result

Staff see:

- `Support State` instead of `Assignment Status`
- a smaller state picker
- an optional reason selector only when useful
- a writable `Supervisor Notes` section

## Phase 3: Governed Tag Foundation

### Goal

Make tags safe enough to replace `SupervisionNeed` fully.

### Expected Result

- canonical support categories are seeded as protected system tags
- custom tags remain available for local context
- staff use one categorization system only

## Detailed Non-UI Changes

### A. Dashboard Schema And Mirror Definitions

#### File: `src/lib/db/schema.ts`

Changes:

- update `assignmentStatusEnum` from:
  - `NEEDS_SUPPORT`
  - `INACTIVE`
  - `SELF_SUFFICIENT`
  - `PAUSED`
  - `NOT_READY`
- to:
  - `OPEN`
  - `ON_HOLD`
  - `CLOSED`
- add nullable `reason` to `assignmentStatuses`
- remove `supervisionNeedEnum` and `supervisionNeeds` once dashboard usage is gone
- remove `usersRelations.supervisionNeeds` and `supervisionNeedsRelations`
- add tag-governance fields to `revertTags`

Recommended tag-governance additions:

- `slug` as unique stable identifier
- `kind` with values `system` or `custom`
- keep `category` but constrain it if feasible now

Important note:

- `AssignmentStatus` and `SupervisionNeed` are bot-owned tables in practice
- the authoritative migration for those tables belongs in the bot Prisma schema
- this dashboard schema file must still be updated because it is the runtime query contract

#### File: `/home/brandon/dev/reverts-bot/schema.prisma`

Changes:

- replace the existing `AssignmentStatusEnum` with:
  - `OPEN`
  - `ON_HOLD`
  - `CLOSED`
- add nullable `reason` to `AssignmentStatus`
- remove `SupervisionNeedEnum`
- remove `SupervisionNeed`

### B. Migration Work

#### Bot-owned schema migration

Because support-state and supervision-need tables are bot-owned, the real migration must happen in the bot repo.

Migration requirements:

1. add `reason`
2. replace or transition the old enum to the new one
3. backfill existing rows using the compatibility mapping
4. remove or archive `SupervisionNeed` after dependency cleanup

If enum replacement is risky in place, use a staged migration:

1. add `reason`
2. add a transitional enum or column strategy
3. backfill values
4. switch reads and writes
5. remove old enum values

### C. Dashboard Query Layer

#### File: `src/lib/db/queries.ts`

Changes:

- remove the `supervisionNeeds` import
- remove `activeSupportNeedsCounts` from user search
- remove `activeSupportNeedsCount` from `searchUsers()` and related result shapes
- delete `getUserSupervisionNeeds()`
- add `createUserSupervisorEntry()` for supervisor notes
- update all assignment-status reads and writes to the simplified enum and nullable `reason`
- update comments and naming where the concept is now support state rather than assignment status
- update tag helpers to support `slug`, `kind`, and any constrained category logic

Recommended new helper:

```ts
createUserSupervisorEntry({
  userId,
  supervisorId,
  note,
})
```

Required mutation helper changes:

- `claimUserAssignment()`
- `assignUserToSupervisor()`
- `transferUserAssignment()`
- `unassignUser()`
- any helper reading the current active state

For `unassignUser()`, the body contract should become conceptually:

```ts
{
  nextState: 'OPEN' | 'ON_HOLD' | 'CLOSED'
  reason?: string
  note?: string
}
```

### D. Dashboard Routes

#### File: `src/lib/elysia/routes/users.ts`

Changes:

- stop fetching `getUserSupervisionNeeds()` in `GET /users/:id?full=true`
- remove `supervisionNeeds` from the full user payload
- rename `supervisorEntries` to `supervisorNotes` in the response payload
- remove `activeSupportNeedsCount` from the users list response
- add `POST /users/:id/supervisor-notes`
- update assignment-related route payloads and validation to use simplified support-state values and optional `reason`

Suggested new route:

- `POST /users/:id/supervisor-notes`
  - body: `{ note: string }`
  - auth: `modAuth`
  - actor: `discordId`
  - behavior: create note row in `UserSupervisorEntries`
  - validation: trimmed non-empty note, reasonable max length

Assignment route changes:

- `POST /users/:id/assignment/unassign`
  - accept `{ nextState, reason?, note? }`
- any route returning current state should now return support-state semantics, and include `reason` if present

#### File: `src/lib/elysia/routes/tags.ts`

Changes:

- support `slug` and `kind` in tag responses where applicable
- enforce protected behavior for system tags
- validate `category` against an allow-list if schema enum is not added yet
- prevent arbitrary edits to identity fields for seeded system tags unless explicitly intended

### E. Dashboard Hooks And Types

#### File: `src/lib/hooks/queries/useUserDetails.ts`

Changes:

- remove `SupervisionNeed` type
- remove `supervisionNeeds` from `UserDetails`
- rename `SupervisorEntry` to `SupervisorNote`
- rename `supervisorEntries` to `supervisorNotes`
- update history items to include nullable `reason`
- rename local type comments and labels to support-state terminology where practical

#### File: `src/lib/hooks/queries/useUsersTable.ts`

Changes:

- remove `activeSupportNeedsCount` from `UserListItem`
- rename `currentAssignmentStatus` to `currentSupportState` if practical in this pass
- add nullable `currentSupportReason` if the list query exposes it

If a broad API rename is too disruptive for one pass, keep the wire field temporarily and map it immediately in UI.

#### File: `src/lib/hooks/queries/useUserTags.ts`

Changes:

- extend returned tag types with new governance fields such as `slug` and `kind`

#### File: `src/lib/hooks/mutations/useAssignmentMutations.ts`

Changes:

- update payload types to use simplified support-state values
- add optional `reason` where state mutations need it
- rename local variable names and comments from assignment status to support state where practical

#### File: `src/lib/hooks/mutations/useTagMutations.ts`

Changes:

- update payload types if tag governance fields are added
- ensure invalidations still cover users table, user details, and dashboard

#### New file: `src/lib/hooks/mutations/useSupervisorNoteMutations.ts`

Add a dedicated mutation hook:

- `useAddSupervisorNote()`

Behavior:

- POST to `/users/:id/supervisor-notes`
- invalidate `['user', 'details', userId]`
- optionally invalidate `['users', 'table']` later if needed

### F. Bot Logic Updates

Affected files:

- `/home/brandon/dev/reverts-bot/bot/enums.py`
- `/home/brandon/dev/reverts-bot/bot/actions/assignment_status.py`
- `/home/brandon/dev/reverts-bot/bot/actions/users.py`
- `/home/brandon/dev/reverts-bot/bot/exts/supervision/assignment.py`
- any file importing `AssignmentStatusEnum`
- `/home/brandon/dev/reverts-bot/bot/actions/supervision_needs.py`
- any file importing `SupervisionNeedEnum`

Changes:

- replace the current five-value assignment enum with the simplified support-state enum
- add `reason` support where states are created or displayed
- update descriptions and display helpers accordingly
- remove `SupervisionNeed` helpers and dead references
- keep campaigns untouched for now

### G. Documentation Updates

Update these docs:

- `docs/DATABASE.md`
- `docs/API.md`
- `docs/features/USERS_TABLE.md`
- `docs/features/STAFF_DASHBOARD_CONSOLIDATION_PLAN_2026-04-23.md`
- `docs/features/STAFF_DASHBOARD_PHASE_1_IMPLEMENTATION_PLAN_2026-04-23.md`

Minimum doc changes:

- `Assignment Status` -> `Support State` in staff-facing descriptions
- `SupervisionNeed` marked retired or removed from dashboard-facing docs
- `UserSupervisorEntries` described as supervisor notes
- support-state `reason` documented as a controlled secondary value, not a second top-level state

## Detailed UI Changes

### A. User Details Panel

#### File: `src/app/users/components/user-details-panel.tsx`

Changes:

- rename visible copy from `Assignment Status` to `Support State`
- rename helper text such as `Select next assignment status` to `Select next support state`
- remove any remaining references to support needs in the operational summary and next-action logic
- rename `Supervisor Notes` data prop from `supervisorEntries` to `supervisorNotes`
- add a note composer to the `Supervisor Notes` section
- replace the current five-option state picker with the simplified support-state options
- add an optional reason selector that appears only when the chosen state has multiple valid reasons

Suggested note composer behavior:

- textarea
- `Save note` button
- `Cancel` button when dirty
- disabled state while saving
- toast success and error handling
- clears after success
- newest note appears immediately after invalidation

Recommended placement:

- above the existing note timeline inside the `Supervisor Notes` collapsible section

Suggested reason-selector behavior:

- hidden until a state is selected that requires clarification
- short plain-language options only
- do not show if there is only one reasonable default

### B. Users Table UI

#### File: `src/app/users/components/data-table-toolbar.tsx`

Changes:

- rename any filter label or sheet label from `Assignment Status` to `Support State`
- update filter values to the simplified state model
- do not add a reason filter in this pass unless it becomes necessary for parity

#### File: `src/app/users/components/columns.tsx`

Changes:

- treat the current state field as support-state data in visible labels and comments
- rename visible or tooltip copy accordingly
- if list-level reason is exposed, keep it secondary and subtle rather than turning it into another primary badge

#### File: `src/app/users/components/workspace-signals.ts`

Changes:

- remove `activeSupportNeedsCount` from the source type
- remove the `support-needs` signal entirely in this phase
- keep signals focused on:
  - active moderation risk
  - missing or overdue check-in
  - left server
  - open tickets

Reason:

- `SupervisionNeed` is being retired
- tag-derived signals can be designed later if still valuable

### C. Dashboard Home And Related UI Copy

#### File: `src/app/page.tsx`

Changes:

- update any staff-facing copy or comments that still frame the state as assignment status rather than support state

### D. Type And Query Consumer Updates

Affected files to update after API changes:

- `src/lib/hooks/queries/useUserDetails.ts`
- `src/lib/hooks/queries/useUsersTable.ts`
- `src/app/users/components/user-details-panel.tsx`
- `src/app/users/components/workspace-signals.ts`
- any other consumer of `supervisorEntries`, `supervisionNeeds`, or `activeSupportNeedsCount`

## Exact File List

### Dashboard Non-UI

- `src/lib/db/schema.ts`
- `src/lib/db/queries.ts`
- `src/lib/elysia/routes/users.ts`
- `src/lib/elysia/routes/tags.ts`
- `src/lib/hooks/queries/useUserDetails.ts`
- `src/lib/hooks/queries/useUsersTable.ts`
- `src/lib/hooks/queries/useUserTags.ts`
- `src/lib/hooks/mutations/useAssignmentMutations.ts`
- `src/lib/hooks/mutations/useTagMutations.ts`
- new: `src/lib/hooks/mutations/useSupervisorNoteMutations.ts`
- `src/app/api/[[...slugs]]/route.ts` only if route registration changes are needed
- `docs/DATABASE.md`
- `docs/API.md`
- `docs/features/USERS_TABLE.md`
- `docs/features/STAFF_DASHBOARD_CONSOLIDATION_PLAN_2026-04-23.md`
- `docs/features/STAFF_DASHBOARD_PHASE_1_IMPLEMENTATION_PLAN_2026-04-23.md`
- bot-owned migration work in `/home/brandon/dev/reverts-bot`

### Dashboard UI

- `src/app/users/components/user-details-panel.tsx`
- `src/app/users/components/data-table-toolbar.tsx`
- `src/app/users/components/columns.tsx`
- `src/app/users/components/workspace-signals.ts`
- `src/app/page.tsx`
- any tag UI surface that needs to distinguish system tags from custom tags

### Bot Non-UI

- `/home/brandon/dev/reverts-bot/schema.prisma`
- `/home/brandon/dev/reverts-bot/bot/enums.py`
- `/home/brandon/dev/reverts-bot/bot/actions/assignment_status.py`
- `/home/brandon/dev/reverts-bot/bot/actions/users.py`
- `/home/brandon/dev/reverts-bot/bot/exts/supervision/assignment.py`
- `/home/brandon/dev/reverts-bot/bot/actions/supervision_needs.py`
- any direct or indirect imports of `AssignmentStatusEnum`
- any direct or indirect imports of `SupervisionNeedEnum`

## Validation Plan

### Non-UI Validation

- user full-profile payload no longer returns `supervisionNeeds`
- users table payload no longer returns `activeSupportNeedsCount`
- `POST /users/:id/supervisor-notes` creates a note and returns success
- support-state persistence accepts the simplified enum and nullable `reason`
- seeded system tags cannot be accidentally edited like custom tags
- no dashboard query or route still imports `supervisionNeeds`

### UI Validation

- the user panel shows `Support State` terminology everywhere
- the support-state picker shows the simplified state list and optional reason selection
- a supervisor can add a note from the dashboard and see it appear after save
- users table no longer shows support-need signals
- no leftover staff-facing `SupervisionNeed` language remains

### Cross-Repo Validation

- no bot path still depends on `SupervisionNeed`
- bot logic accepts the simplified support-state enum and nullable `reason`
- campaigns are unchanged
- assignment, transfer, claim, and unassign behavior still work

## Recommended Delivery Order

1. Bot and dashboard non-UI coordination for support-state enum simplification plus nullable `reason`.
2. Dashboard non-UI cleanup for `SupervisionNeed` retirement and notes write path.
3. Dashboard UI update for support-state terminology, reason selection, and supervisor-note creation.
4. Governed tag groundwork.
5. Bot cleanup for `SupervisionNeed`.
6. Separate later plan for campaigns.

## Prompt: Non-UI Implementation

```text
Implement the non-UI portion of the revert-support simplification in /home/brandon/dev/reverts-dashboard, and include the coordinated schema and logic updates needed in /home/brandon/dev/reverts-bot.

Goals:
1. Retire SupervisionNeed from dashboard and bot usage.
2. Simplify the persisted AssignmentStatus model into a smaller Support State model.
3. Add nullable reason support to support state.
4. Add a dashboard write path for supervisor notes using the existing UserSupervisorEntries table.
5. Remove SupervisionNeed-derived counters and payload fields from dashboard APIs and hooks.
6. Add the groundwork for governed tags versus custom tags.
7. Do not redesign campaigns.

Required dashboard changes:
- In src/lib/db/schema.ts:
  - update assignmentStatusEnum to the simplified support-state values
  - add nullable reason to assignmentStatuses
  - remove SupervisionNeed mirror definitions once dashboard usage is removed
  - add minimal tag governance fields for system vs custom tags
- In src/lib/db/queries.ts:
  - remove supervisionNeeds imports and queries
  - remove activeSupportNeedsCounts from user list queries
  - delete getUserSupervisionNeeds()
  - add createUserSupervisorEntry({ userId, supervisorId, note })
  - update support-state reads and writes to the simplified enum and nullable reason
- In src/lib/elysia/routes/users.ts:
  - stop returning supervisionNeeds in GET /users/:id?full=true
  - rename supervisorEntries to supervisorNotes in the response payload
  - remove activeSupportNeedsCount from the users list response
  - add POST /users/:id/supervisor-notes with body validation and modAuth
  - update assignment mutation route payloads to accept nextState and optional reason
- In src/lib/hooks/queries/useUserDetails.ts:
  - remove SupervisionNeed types
  - rename SupervisorEntry to SupervisorNote
  - rename supervisorEntries to supervisorNotes
  - add nullable reason on support-state history items
- In src/lib/hooks/queries/useUsersTable.ts:
  - remove activeSupportNeedsCount from UserListItem
  - update list types to reflect the simplified support-state model
- In src/lib/hooks/mutations/useAssignmentMutations.ts:
  - update mutation payloads to use nextState and optional reason
- Add a new mutation hook file at src/lib/hooks/mutations/useSupervisorNoteMutations.ts with useAddSupervisorNote()
- In src/lib/elysia/routes/tags.ts and related helpers:
  - add the minimum viable governance support for system tags versus custom tags

Required bot changes:
- In /home/brandon/dev/reverts-bot/schema.prisma:
  - replace the current AssignmentStatus enum with OPEN | ON_HOLD | CLOSED
  - add nullable reason to AssignmentStatus
  - remove SupervisionNeed and its enum
- Update any bot logic using AssignmentStatusEnum or SupervisionNeedEnum to match the new model.

Constraints:
- Do not change campaign behavior.
- Keep the implementation explicit and simple.
- Use reason as the field name, not reasonKey.

Validation:
- ensure no dashboard query or route still depends on SupervisionNeed
- ensure the simplified support-state enum and nullable reason work across dashboard and bot write paths
- ensure supervisor note creation works end-to-end through the API and hook layer
- ensure affected TypeScript types are updated consistently
```

## Prompt: UI Implementation

```text
Implement the UI portion of the revert-support simplification in /home/brandon/dev/reverts-dashboard.

Goals:
1. Rename staff-facing Assignment Status language to Support State.
2. Reflect the simplified support-state model and optional reason selection in the UI.
3. Add a create-note flow to the Supervisor Notes section in the user details panel.
4. Remove SupportNeed-derived UI signals.
5. Keep the interface simple and obvious for non-technical daily staff users.

Required UI changes:
- In src/app/users/components/user-details-panel.tsx:
  - rename visible copy from Assignment Status to Support State
  - update helper text like “Select next assignment status” to “Select next support state”
  - replace the current five-state picker with OPEN | ON_HOLD | CLOSED
  - add an optional reason selector that appears only when useful
  - rename supervisorEntries usage to supervisorNotes
  - add a note composer above the existing note list in the Supervisor Notes section
  - wire the composer to the new useAddSupervisorNote() hook
  - show loading, success, and error states clearly
- In src/app/users/components/data-table-toolbar.tsx:
  - rename any Assignment Status filter label to Support State
  - update the filter values to the simplified support-state model
- In src/app/users/components/columns.tsx:
  - update any visible support-state terminology
  - treat reason as secondary context, not another primary badge
- In src/app/users/components/workspace-signals.ts:
  - remove the support-needs signal and any dependency on activeSupportNeedsCount
- In src/app/page.tsx and nearby dashboard surfaces:
  - update any remaining staff-facing copy or comments that still frame the concept as assignment status

Design constraints:
- Prefer direct, plain language.
- Avoid adding new complex controls beyond what is needed for note creation and light reason selection.
- The support state should feel like “what happens next,” not a technical label.
- The reason selector should only appear when it adds clarity.
- Supervisor notes should feel lightweight and fast to add.

Validation:
- the user panel shows Support State terminology consistently
- the support-state UI uses the simplified state list and optional reason correctly
- a supervisor can add a note from the dashboard and see it appear after save
- users table attention signals still work without support-needs counts
- no leftover staff-facing SupervisionNeed language remains
```
