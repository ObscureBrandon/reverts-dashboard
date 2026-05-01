# Revert Support Migration Plan

> Staged rollout for simplifying revert-support schema and workflows without breaking the bot or daily staff operations.

## Metadata

- Date: 2026-04-28
- Status: Review Draft
- Audience: Dashboard engineering, bot engineering, moderators, supervisors
- Related inputs:
  - [REVERT_SUPPORT_TARGET_MODEL_2026-04-28.md](./REVERT_SUPPORT_TARGET_MODEL_2026-04-28.md)
  - [STAFF_DASHBOARD_CONSOLIDATION_PLAN_2026-04-23.md](./STAFF_DASHBOARD_CONSOLIDATION_PLAN_2026-04-23.md)
  - [continuation_context.md](../../continuation_context.md)

## Planning Assumptions

This plan assumes the following are true:

- `SupervisionNeed` has no live records
- the dashboard is becoming the primary staff workspace
- the bot remains the execution layer for Discord-native side effects during the transition
- staff need a simpler mental model, not just a different schema

## Migration Goals

1. Remove overlapping support concepts.
2. Keep the workflow clear for non-technical staff.
3. Avoid breaking bot assignment, campaign, and notification flows during rollout.
4. End with one categorization system and one workflow-state system.

## End-State Summary

The intended end state is:

- ownership via `UserSupervisor`
- workflow state via `Support State`
- categorization via governed and custom tags
- follow-up cadence via `revert_check_in`
- no `SupervisionNeed`

## Phase A: Semantic Cleanup

### Goal

Make the current product easier to understand before changing deeper schema or automation behavior.

### Changes

- rename staff-facing copy from `Assignment Status` to `Support State`
- remove `SupervisionNeed` from staff-facing dashboard UX and docs
- document the four main concepts clearly:
  - owner
  - support state
  - support tags
  - last check-in
- review all filters and badges for consistent terminology

### Expected Outcome

Staff see a simpler model immediately, even before the deeper migration is complete.

## Phase B: Introduce Governed Tags

### Goal

Replace `SupervisionNeed` with a single staff-facing categorization system.

### Changes

- seed protected system tags for canonical support categories
- define controlled tag categories such as:
  - `support_need`
  - `context`
  - `risk`
  - `logistics`
- preserve optional custom tags for local context
- prevent accidental editing or deletion of protected system tags

### Expected Outcome

Staff use one tag system instead of choosing between tags and supervision needs.

## Phase C: Retire `SupervisionNeed`

### Goal

Remove the legacy categorization model fully.

### Changes

- stop all bot writes and reads to `SupervisionNeed`
- remove `SupervisionNeed` from dashboard API payloads
- delete or archive the table once the short verification window passes

### Why This Can Be Fast

Because there are no live rows, this phase is mostly dependency cleanup rather than data migration.

### Expected Outcome

The support model loses its largest source of conceptual duplication.

## Phase D: Support State Simplification

### Goal

Replace the current five-state mental model with a simpler staff-facing state system.

### Recommended Transition

#### Step 1: Compatibility Layer

Keep the current underlying enum for a short period, but group it into simpler staff-facing buckets:

- `NEEDS_SUPPORT` => `OPEN`
- `PAUSED` => `ON_HOLD`
- `NOT_READY` => `ON_HOLD`
- `SELF_SUFFICIENT` => `CLOSED`
- `INACTIVE` => `CLOSED`

#### Step 2: True Model Simplification

Once bot and dashboard are aligned, move the underlying model to:

- `OPEN`
- `ON_HOLD`
- `CLOSED`

with a controlled `reason` value for nuance.

### Expected Outcome

Staff only need to understand one simple workflow question: is this active work, on hold, or closed?

## Phase E: Campaign And Outreach Rewrite

### Goal

Make campaigns explicit, understandable, and less dependent on accidental state gaps.

### Problems In Current Logic

Current targeting and response handling rely too much on combinations like:

- no active owner
- no active status row
- only one specific status being truly operational

This is hard to reason about and hard to explain.

### Recommended Changes

- target campaigns using explicit rules:
  - current support state
  - current owner or no owner
  - last outreach timestamp
  - last check-in timestamp
  - optional system tags
- let campaign responses set both:
  - support state
  - optional governed tags
- rename `ReachoutLog` later to `OutreachEvent` if the wider team agrees

### Expected Outcome

Campaign logic becomes intentional and reviewable instead of being spread across implicit null-state conditions.

## Phase F: Infrastructure Cleanup

### Goal

Review supporting tables and either clarify or retire them.

### `SupportNotification`

Short-term:

- keep if durable Discord recovery is still required for button-based claiming

Long-term:

- retire if dashboard-driven actions become primary and the bot is called explicitly for side effects

### `UserSupervisorEntries`

- decide if it is notes or history
- rename or redesign accordingly

### `Campaign`

- add lifecycle status and metrics if it becomes a major dashboard surface

### `ReachoutLog`

- consider renaming to `OutreachEvent` for clarity

## Rollout Sequence

Recommended order:

1. semantic cleanup
2. governed tag introduction
3. `SupervisionNeed` retirement
4. support-state compatibility layer
5. support-state schema simplification
6. campaign targeting rewrite
7. infrastructure cleanup

## Risks

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
4. Dashboard filters and badges use the same support-state language everwhere.
5. Any remaining notification persistence has a documented reason to exist.
6. `UserSupervisorEntries` has a single clearly defined purpose.

## Recommended Decision Summary

1. Retire `SupervisionNeed` immediately after dependency cleanup.
2. Keep explicit workflow state, but simplify it.
3. Use protected system tags plus optional custom tags.
4. Rework campaign logic after the state and tag model is clarified.
5. Review `SupportNotification`, `ReachoutLog`, and `UserSupervisorEntries` as supporting cleanup targets, not as the primary model.