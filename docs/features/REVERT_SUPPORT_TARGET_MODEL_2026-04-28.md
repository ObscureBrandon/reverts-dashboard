# Revert Support Target Model

> Proposed simplification of revert-support data and workflows so the dashboard is clear for daily non-technical staff use.

## Metadata

- Date: 2026-04-28
- Status: Review Draft
- Audience: Dashboard product, dashboard engineering, bot engineering, moderators, supervisors
- Related inputs:
  - [STAFF_DASHBOARD_CONSOLIDATION_PLAN_2026-04-23.md](./STAFF_DASHBOARD_CONSOLIDATION_PLAN_2026-04-23.md)
  - [STAFF_DASHBOARD_PHASE_1_IMPLEMENTATION_PLAN_2026-04-23.md](./STAFF_DASHBOARD_PHASE_1_IMPLEMENTATION_PLAN_2026-04-23.md)
  - [DASHBOARD_UX_AUDIT_2026-03-06.md](./DASHBOARD_UX_AUDIT_2026-03-06.md)
  - [continuation_context.md](../../continuation_context.md)
  - [PLATFORM_OVERVIEW.md](../PLATFORM_OVERVIEW.md)

## Goal

Reduce the revert-support model to a small set of concepts that staff can understand instantly during daily work.

The product should answer four questions clearly:

1. Who owns this person?
2. What should happen next?
3. What kind of help or context applies?
4. When did we last follow up?

## Recommended Core Model

The clearest long-term model is:

- `UserSupervisor` = ownership
- `SupportState` = workflow state
- tags = categorization and context
- `revert_check_in` = follow-up cadence

This means:

- retire `SupervisionNeed`
- keep the concept behind `AssignmentStatus`, but rename and simplify it
- do not use tags as the only workflow driver

## Why `AssignmentStatus` Should Not Be Replaced By Tags

Tags and workflow state solve different problems.

Tags answer:

- what kind of help is relevant
- what context should staff know
- how should this person be segmented

Workflow state answers:

- should this person be in an active queue right now
- should they be assignable
- should campaigns target them
- what should happen after unassign, transfer, or response handling

If the explicit state model is removed, the complexity does not disappear. It moves into:

- tag naming conventions
- queue filters
- campaign targeting rules
- dashboard mutation logic
- bot automation edge cases

That makes the system harder for both staff and engineers.

## Proposed `SupportState` Model

### Recommendation

Replace the current staff-facing concept of `Assignment Status` with `Support State`.

Keep a single active state row per user, with history preserved over time.

### Preferred State Shape

For non-technical staff, three top-level states are easier to understand than five:

- `OPEN`
  - the person currently needs active attention or is part of active support work
- `ON_HOLD`
  - the person should not be actively routed right now, but is not fully closed
- `CLOSED`
  - the person is not currently part of active support workflow

### Reason Layer

Use a controlled reason value to preserve the nuance currently spread across five statuses.

Examples:

- `OPEN`
  - `requested_support`
  - `campaign_response_yes`
  - `manual_triage`
- `ON_HOLD`
  - `paused`
  - `not_ready`
  - `waiting_for_follow_up_later`
- `CLOSED`
  - `self_sufficient`
  - `inactive`
  - `resolved`

### Mapping From Current Statuses

Suggested compatibility mapping:

| Current status | Proposed state | Proposed reason |
| --- | --- | --- |
| `NEEDS_SUPPORT` | `OPEN` | `requested_support` or `manual_triage` |
| `PAUSED` | `ON_HOLD` | `paused` |
| `NOT_READY` | `ON_HOLD` | `not_ready` |
| `SELF_SUFFICIENT` | `CLOSED` | `self_sufficient` |
| `INACTIVE` | `CLOSED` | `inactive` |

### Suggested Data Shape

A clean end-state schema would conceptually look like:

```ts
SupportState {
  id
  userId
  state: 'OPEN' | 'ON_HOLD' | 'CLOSED'
  reason: string
  priority: number
  notes: string | null
  sourceType: 'campaign' | 'manual' | 'bot' | 'dashboard'
  sourceId: string | null
  createdById
  resolvedById | null
  createdAt
  resolvedAt | null
  active: boolean
}
```

If cross-repo compatibility makes renaming expensive in the short term, keep the existing table temporarily and change the product semantics first.

## Tag Model

Tags should become the only categorization system.

### Tag Types

Use two kinds of tags:

- `system`
  - seeded and protected
  - consistent across staff and reports
- `custom`
  - optional staff-created context
  - useful for local nuance

### Tag Categories

Avoid free-form category strings in the long term.

Use a controlled category set such as:

- `support_need`
- `context`
- `risk`
- `logistics`

### System Tag Examples

Suggested seeded support-need tags:

- `prayer-help`
- `quran-learning`
- `family-issues`
- `new-convert-questions`
- `arabic-learning`
- `islamic-history`
- `community-integration`
- `spiritual-guidance`

### Custom Tag Examples

Examples of helpful custom tags:

- `prefers-voice`
- `works-night-shift`
- `sensitive-family-situation`
- `needs-female-staff`

## Ownership Model

`UserSupervisor` should stay.

It already models a real concept cleanly: who currently owns the person.

That should remain distinct from support state.

The dashboard and bot both rely on this separation today.

## Check-In Model

`revert_check_in` should stay.

It is one of the clearest staff-facing tables because it maps directly to a real action:

- someone followed up
- by a known method
- at a known time
- with optional summary

This should remain the source of truth for follow-up cadence.

## Adjacent Table Review

### `UserSupervisor`

Keep.

Why:

- clear ownership model
- already useful in dashboard and bot
- easy for staff to understand

Possible improvement:

- add richer ending metadata later if transfer and unassign history need to be first-class

### `UserSupervisorEntries`

Needs redesign.

Current problem:

- the name sounds like assignment history
- the shape looks like notes
- it is not clearly one thing

Recommendation:

- if it is meant to be notes, rename it to something like `supervisor_note`
- if it is meant to be history, replace it with a real assignment-history table

Do not leave it as an ambiguous hybrid.

### `AssignmentStatus`

Keep the concept, redesign the surface.

Current problem:

- the name suggests ownership instead of workflow state
- five values may be more granular than staff actually need

Recommendation:

- rename staff-facing copy to `Support State`
- likely simplify to three top-level states plus reason values

### `SupervisionNeed`

Retire.

Reason:

- duplicate categorization model
- confirmed zero rows
- creates unnecessary mental overhead next to tags

### `Campaign`

Keep, but enrich if it becomes a major dashboard feature.

Current problem:

- too thin for a real operational system

Future improvements:

- explicit lifecycle status
- response metrics
- audience definition
- operator notes

### `ReachoutLog`

Keep the concept, but rename when practical.

`ReachoutLog` reads like a passive audit table, but it is really an outreach event source used by downstream workflows.

Preferred future name:

- `OutreachEvent`

### `SupportNotification`

Short-term keep, long-term review.

Short-term reason to keep:

- durable Discord-side notification recovery may still matter while the bot remains the primary claim surface

Long-term reason to retire:

- once dashboard-driven actions become primary and the bot is called explicitly for Discord side effects, this table may become infrastructure noise instead of core product data

### `revert_tag`

Keep.

Add governance:

- tag kind
- controlled categories
- protection rules for system tags

### `revert_tag_assignment`

Keep.

It already supports the right pattern:

- active assignments
- soft removal
- historical review

### `revert_check_in`

Keep.

This is already simple and product-friendly.

## Recommended Final Table Intent

| Table | Recommendation | Final intent |
| --- | --- | --- |
| `UserSupervisor` | Keep | Active ownership |
| `UserSupervisorEntries` | Redesign | Notes or assignment history, not both |
| `AssignmentStatus` | Keep concept, rename and simplify | Workflow state |
| `SupervisionNeed` | Retire | Replaced by system tags |
| `Campaign` | Keep and enrich | Outreach initiative |
| `ReachoutLog` | Keep concept, rename later | Outreach event history |
| `SupportNotification` | Keep for now, review later | Discord notification infrastructure |
| `revert_tag` | Keep and govern | Categorization catalog |
| `revert_tag_assignment` | Keep | Tag history and active labels |
| `revert_check_in` | Keep | Follow-up cadence |

## Product Language Recommendation

Staff-facing language should be:

- `Owner`
- `Support State`
- `Support Tags`
- `Last Check-In`

Avoid making staff translate between:

- assignment status
- supervision need
- support request
- needs assignment
- tags

One label should map to one concept.

## Decision Summary

1. Retire `SupervisionNeed`.
2. Keep an explicit workflow-state layer.
3. Rename `AssignmentStatus` to `Support State` in product language.
4. Simplify state values for staff comprehension.
5. Use governed tags for canonical support categories and custom tags for local context.
6. Keep ownership, state, categorization, and follow-up as four separate concepts in the data model and UI.