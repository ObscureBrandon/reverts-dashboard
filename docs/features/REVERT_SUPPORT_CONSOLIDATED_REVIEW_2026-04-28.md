# Revert Support Consolidated Review

> Single review document for the proposed revert-support simplification across schema, workflows, migration, and staff UX.

## Metadata

- Date: 2026-04-28
- Status: Review Draft
- Audience: Product, design, dashboard engineering, bot engineering, moderators, supervisors
- Related inputs:
  - [STAFF_DASHBOARD_CONSOLIDATION_PLAN_2026-04-23.md](./STAFF_DASHBOARD_CONSOLIDATION_PLAN_2026-04-23.md)
  - [STAFF_DASHBOARD_PHASE_1_IMPLEMENTATION_PLAN_2026-04-23.md](./STAFF_DASHBOARD_PHASE_1_IMPLEMENTATION_PLAN_2026-04-23.md)
  - [DASHBOARD_UX_AUDIT_2026-03-06.md](./DASHBOARD_UX_AUDIT_2026-03-06.md)
  - [continuation_context.md](../../continuation_context.md)
  - [PLATFORM_OVERVIEW.md](../PLATFORM_OVERVIEW.md)

## Review Purpose

This document merges the earlier target-model, migration-plan, and staff-workflow drafts into one readable review.

The goal is to make the revert-support system simpler, clearer, and easier to use every day for non-technical staff without losing the workflow controls needed by the dashboard and bot.

## Executive Summary

The current model mixes too many concepts in a way that makes daily staff work harder than it should be.

The simplest durable model is:

- `UserSupervisor` = ownership
- `Support State` = workflow state
- tags = categorization and context
- `revert_check_in` = follow-up cadence

This leads to six core decisions:

1. Retire `SupervisionNeed`.
2. Keep an explicit workflow-state layer.
3. Rename the staff-facing concept of `Assignment Status` to `Support State`.
4. Simplify support state so staff can understand it instantly.
5. Use governed system tags for canonical support categories and custom tags for local context.
6. Keep ownership, workflow state, categorization, and follow-up as separate concepts in both the schema and UI.

## The Core Problem

Today the system makes staff mentally juggle several overlapping ideas:

- who owns the person
- whether they need active support now
- what kind of help applies
- whether follow-up is overdue
- whether a campaign or Discord notification put them in that state

That is too much for daily use.

The product should answer only four questions clearly:

1. Who owns this person?
2. What should happen next?
3. What kind of help or context applies?
4. When did we last follow up?

## Recommended Target Model

### Ownership

Use `UserSupervisor` as the ownership layer.

Meaning:

- who is responsible for this person now
- who can claim, transfer, or release ownership

Why it stays:

- it already models a real concept cleanly
- both the dashboard and bot depend on it
- it is easy for staff to understand

### Workflow State

Keep the concept behind `AssignmentStatus`, but stop presenting it as assignment.

Staff-facing name:

- `Support State`

Meaning:

- whether this person is active work, paused work, or closed work
- whether they should appear in active queues
- what should happen after outreach responses, assignment changes, or manual triage

### Categorization

Use tags as the only categorization system.

Meaning:

- what type of support applies
- what staff context matters
- what segmentation or operational note should stay visible

### Follow-Up

Use `revert_check_in` as the follow-up layer.

Meaning:

- when staff last contacted this person
- whether follow-up is overdue
- what happened in the most recent contact

## Why Tags Should Not Replace Workflow State

Tags and workflow state are not the same thing.

Tags answer:

- what kind of help is relevant
- what context should staff know
- how should this person be segmented

Workflow state answers:

- should this person be in an active queue right now
- should they be assignable
- should campaigns target them
- what should happen after unassign, transfer, or response handling

If workflow state is removed, the complexity does not disappear. It moves into:

- tag naming rules
- queue filters
- campaign targeting logic
- dashboard mutations
- bot automation edge cases

That would make the system less clear for staff and harder to maintain technically.

## Proposed Support State Design

### Recommendation

Replace the staff-facing label `Assignment Status` with `Support State`.

Keep one active state row per user and preserve state history over time.

### Recommended State Shape

For non-technical staff, three top-level states are easier to understand than five:

- `OPEN`
  - the person currently needs active attention or is part of active support work
- `ON_HOLD`
  - the person should not be actively routed right now, but is not fully closed
- `CLOSED`
  - the person is not currently part of active support workflow

### Reason Layer

Use a controlled reason field to preserve nuance.

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

### Compatibility Mapping

| Current status | Proposed state | Proposed reason |
| --- | --- | --- |
| `NEEDS_SUPPORT` | `OPEN` | `requested_support` or `manual_triage` |
| `PAUSED` | `ON_HOLD` | `paused` |
| `NOT_READY` | `ON_HOLD` | `not_ready` |
| `SELF_SUFFICIENT` | `CLOSED` | `self_sufficient` |
| `INACTIVE` | `CLOSED` | `inactive` |

### Conceptual End-State Shape

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

If cross-repo compatibility makes renaming expensive immediately, keep the existing table temporarily and change the product semantics first.

## Proposed Tag Design

Tags should replace `SupervisionNeed` entirely.

### Tag Kinds

Use two tag kinds:

- `system`
  - seeded and protected
  - canonical across staff, reports, and campaigns
- `custom`
  - optional staff-created context
  - useful for local nuance

### Tag Categories

Avoid free-form category strings over time.

Use a controlled set such as:

- `support_need`
- `context`
- `risk`
- `logistics`

### Suggested System Tags

- `prayer-help`
- `quran-learning`
- `family-issues`
- `new-convert-questions`
- `arabic-learning`
- `islamic-history`
- `community-integration`
- `spiritual-guidance`

### Example Custom Tags

- `prefers-voice`
- `works-night-shift`
- `sensitive-family-situation`
- `needs-female-staff`

## Table-By-Table Review

### `UserSupervisor`

Recommendation:

- keep

Why:

- clear ownership model
- already useful in dashboard and bot
- easy for staff to understand

Possible future improvement:

- add richer ending metadata if transfer and unassign history need to be first-class

### `UserSupervisorEntries`

Recommendation:

- redesign

Problem:

- the name sounds like assignment history
- the shape looks like notes
- it is not clearly one thing

Preferred direction:

- if it is meant to be notes, rename it to something like `supervisor_note`
- if it is meant to be history, replace it with a real assignment-history table

### `AssignmentStatus`

Recommendation:

- keep the concept, rename and simplify the surface

Problem:

- the name suggests ownership instead of workflow state
- five values may be more granular than daily staff really need

Preferred direction:

- rename staff-facing copy to `Support State`
- simplify to three top-level states plus reason values when the bot and dashboard are ready

### `SupervisionNeed`

Recommendation:

- retire

Reason:

- duplicate categorization model
- confirmed zero rows
- creates unnecessary mental overhead next to tags

### `Campaign`

Recommendation:

- keep, then enrich if it becomes a major dashboard feature

Problem:

- too thin for a real operational system

Possible future improvements:

- explicit lifecycle status
- response metrics
- audience definition
- operator notes

### `ReachoutLog`

Recommendation:

- keep the concept, rename later if practical

Problem:

- it reads like a passive log, but it behaves more like an outreach event source

Preferred future name:

- `OutreachEvent`

### `SupportNotification`

Recommendation:

- short-term keep, long-term review

Short-term reason to keep:

- durable Discord-side notification recovery may still matter while the bot remains the primary claim surface

Long-term reason to retire:

- once dashboard-driven actions become primary and the bot is called explicitly for Discord side effects, this may become infrastructure noise instead of core product data

### `revert_tag`

Recommendation:

- keep and govern

Needed additions:

- tag kind
- controlled categories
- protection rules for system tags

### `revert_tag_assignment`

Recommendation:

- keep

Why:

- it already supports active assignments, soft removal, and historical review cleanly

### `revert_check_in`

Recommendation:

- keep

Why:

- simple
- product-friendly
- maps directly to a real staff action

## Staff Workflow Model

The product should teach staff exactly four ideas:

- `Owner`
- `Support State`
- `Support Tags`
- `Last Check-In`

Everything in the UI should reinforce these four ideas.

### Staff Priorities

In daily use, staff should be able to answer these questions in seconds:

1. Is this person assigned to someone?
2. Are they active work, on hold, or closed?
3. What kind of support applies?
4. Is follow-up overdue?
5. What action should I take next?

### Profile Layout Recommendation

When staff open a revert profile, the page or panel should show sections in this order.

#### 1. Ownership

Purpose:

- show who currently owns the person
- expose assignment actions first

Primary actions:

- `Assign to me`
- `Transfer`
- `Unassign`

Display:

- current owner name and avatar
- assignment timestamp
- ownership history link if available

#### 2. Support State

Purpose:

- show the current workflow state clearly
- make the next step obvious

Recommended values:

- `Open`
- `On Hold`
- `Closed`

Display:

- one main state pill
- optional secondary reason label
- optional staff note

#### 3. Support Tags

Purpose:

- show support category and context without competing with workflow state

Display rules:

- system tags first
- custom tags second
- separate active tags from tag history

#### 4. Follow-Up

Purpose:

- show whether follow-up is overdue
- make it easy to log contact

Display:

- last check-in timestamp
- overdue indicator
- quick action to log a new check-in
- check-in history

### Users Table Recommendation

Recommended columns:

- name
- owner
- support state
- support tags
- last check-in
- overdue flag

Recommended quick filters:

- `Open Support`
- `Unassigned`
- `On Hold`
- `Overdue Follow-Up`
- `Assigned To Me`

### Home Dashboard Recommendation

Recommended sections:

- `My Open Support`
- `Unassigned Open Support`
- `Overdue Follow-Up`
- `Recent Support Activity`

The dashboard should feel like an inbox, not a collection of disconnected data pages.

### Campaign Workflow Recommendation

Campaigns should feel like guided outreach, not backend machinery.

Staff-facing inputs should allow:

- target support state
- whether assigned or unassigned people are included
- time since last outreach or last check-in
- optional system tags

Staff-facing outcomes should show:

- updated support state
- any tags added automatically
- whether the person is now unassigned active work

Important constraint:

- campaigns should not require staff to understand null statuses, hidden bot-only logic, or Discord message recovery details

## Migration Plan

### Planning Assumptions

- `SupervisionNeed` has no live records
- the dashboard is becoming the primary staff workspace
- the bot remains the execution layer for Discord-native side effects during the transition
- staff need a simpler mental model, not just a different schema

### Migration Goals

1. Remove overlapping support concepts.
2. Keep the workflow clear for non-technical staff.
3. Avoid breaking bot assignment, campaign, and notification flows during rollout.
4. End with one categorization system and one workflow-state system.

### Phase A: Semantic Cleanup

Goal:

- make the current product easier to understand before changing deeper schema or automation behavior

Changes:

- rename staff-facing copy from `Assignment Status` to `Support State`
- remove `SupervisionNeed` from staff-facing dashboard UX and docs
- document the four main concepts clearly
- review filters and badges for consistent terminology

Expected outcome:

- staff see a simpler model immediately

### Phase B: Introduce Governed Tags

Goal:

- replace `SupervisionNeed` with a single staff-facing categorization system

Changes:

- seed protected system tags for canonical support categories
- define controlled tag categories
- preserve optional custom tags for local context
- prevent accidental editing or deletion of protected system tags

Expected outcome:

- staff use one tag system instead of choosing between tags and supervision needs

### Phase C: Retire `SupervisionNeed`

Goal:

- remove the legacy categorization model fully

Changes:

- stop all bot writes and reads to `SupervisionNeed`
- remove it from dashboard API payloads
- delete or archive the table once the short verification window passes

Expected outcome:

- the support model loses its biggest source of conceptual duplication

### Phase D: Support State Simplification

Goal:

- replace the current five-state mental model with a simpler staff-facing state system

Step 1:

- keep the current underlying enum briefly, but group it into `OPEN`, `ON_HOLD`, and `CLOSED`

Step 2:

- once dashboard and bot are aligned, move the underlying model to the simpler state set with a controlled `reason` field

Expected outcome:

- staff only need to understand whether the person is active work, on hold, or closed

### Phase E: Campaign And Outreach Rewrite

Goal:

- make campaigns explicit, understandable, and less dependent on accidental state gaps

Recommended changes:

- target campaigns using explicit rules:
  - current support state
  - current owner or no owner
  - last outreach timestamp
  - last check-in timestamp
  - optional system tags
- let campaign responses set both support state and optional governed tags
- rename `ReachoutLog` later to `OutreachEvent` if the wider team agrees

Expected outcome:

- campaign logic becomes intentional and reviewable instead of implicit

### Phase F: Infrastructure Cleanup

Goal:

- review supporting tables and either clarify or retire them

Targets:

- `SupportNotification`
- `UserSupervisorEntries`
- `Campaign`
- `ReachoutLog`

### Recommended Rollout Sequence

1. semantic cleanup
2. governed tag introduction
3. `SupervisionNeed` retirement
4. support-state compatibility layer
5. support-state schema simplification
6. campaign targeting rewrite
7. infrastructure cleanup

## Risks And Controls

### Risk: Support state changes break bot workflows

Mitigation:

- keep a compatibility layer first
- do not rename the underlying enum too early
- validate every existing bot write path before cutting over

### Risk: Staff lose useful nuance after simplification

Mitigation:

- move nuance into reason values and system tags
- preserve notes for operator judgment

### Risk: Campaign targeting drifts during transition

Mitigation:

- define explicit eligibility rules before removing old assumptions
- add reviewable campaign targeting rules in docs before implementation

### Risk: `SupportNotification` is removed too early

Mitigation:

- only retire it after dashboard-driven claiming is live and stable

## Verification Checklist

Before final cutover:

1. Staff can explain the difference between owner, support state, tags, and check-ins without help.
2. No bot path reads or writes `SupervisionNeed`.
3. Campaigns target explicit state and cadence rules.
4. Dashboard filters and badges use the same support-state language everywhere.
5. Any remaining notification persistence has a documented reason to exist.
6. `UserSupervisorEntries` has a single clearly defined purpose.

## Staff Terminology Rules

Use these terms:

- `Owner`
- `Support State`
- `Support Tags`
- `Last Check-In`
- `Open`
- `On Hold`
- `Closed`

Avoid these terms in staff UI:

- `Assignment Status`
- `Supervision Need`
- multiple overlapping labels for the same queue concept

Why:

- non-technical staff should not need to translate between several internal models to do routine work

## Success Criteria

This redesign is successful if staff can:

1. open any revert profile and understand the situation in under 10 seconds
2. tell the difference between ownership and workflow state without training
3. find all active work from one or two obvious dashboard entry points
4. use one categorization system instead of choosing between tags and supervision needs
5. understand campaign outcomes without reading engineering documentation

## Final Recommendation

Use one clean model for daily staff work:

- ownership
- support state
- tags
- check-ins

Retire `SupervisionNeed`.

Keep explicit workflow state, but rename and simplify it.

Use governed tags plus custom tags for categorization.

Treat `SupportNotification`, `ReachoutLog`, `Campaign`, and `UserSupervisorEntries` as cleanup and clarification work around the core model, not as the core model itself.