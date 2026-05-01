# Revert Support Staff Workflow Spec

> Staff-facing workflow and language proposal for a simpler daily support experience.

## Metadata

- Date: 2026-04-28
- Status: Review Draft
- Audience: Product, design, moderators, supervisors, dashboard engineering
- Related inputs:
  - [REVERT_SUPPORT_TARGET_MODEL_2026-04-28.md](./REVERT_SUPPORT_TARGET_MODEL_2026-04-28.md)
  - [REVERT_SUPPORT_MIGRATION_PLAN_2026-04-28.md](./REVERT_SUPPORT_MIGRATION_PLAN_2026-04-28.md)
  - [DASHBOARD_UX_AUDIT_2026-03-06.md](./DASHBOARD_UX_AUDIT_2026-03-06.md)
  - [STAFF_DASHBOARD_CONSOLIDATION_PLAN_2026-04-23.md](./STAFF_DASHBOARD_CONSOLIDATION_PLAN_2026-04-23.md)

## Primary Staff Mental Model

The product should teach staff exactly four ideas:

- `Owner`
  - who is responsible for this person now
- `Support State`
  - what should happen next
- `Support Tags`
  - what kind of help or context applies
- `Last Check-In`
  - when staff last followed up

Everything in the UI should reinforce these four concepts.

## Staff Priorities

In daily use, staff should be able to answer these questions in seconds:

1. Is this person assigned to someone?
2. Are they active work, on hold, or closed?
3. What kind of support applies?
4. Is follow-up overdue?
5. What action should I take next?

## Profile Layout Recommendation

When staff open a revert profile, the page or panel should show sections in this order.

### 1. Ownership

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

### 2. Support State

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

### 3. Support Tags

Purpose:

- show support category and context without competing with workflow state

Display rules:

- system tags first
- custom tags second
- separate active tags from tag history

Examples:

- `Prayer Help`
- `Family Issues`
- `Prefers Voice`
- `Needs Female Staff`

### 4. Follow-Up

Purpose:

- show whether follow-up is overdue
- make it easy to log contact

Display:

- last check-in timestamp
- overdue indicator
- quick action to log a new check-in
- check-in history

## Users Table Recommendation

The users table should expose the same concepts in a compact way.

### Recommended Columns

- name
- owner
- support state
- support tags
- last check-in
- overdue flag

### Recommended Quick Filters

Use simple language:

- `Open Support`
- `Unassigned`
- `On Hold`
- `Overdue Follow-Up`
- `Assigned To Me`

Avoid filters that require staff to understand internal data structure.

## Home Dashboard Recommendation

The home dashboard should behave like a practical inbox.

### Recommended Sections

- `My Open Support`
- `Unassigned Open Support`
- `Overdue Follow-Up`
- `Recent Support Activity`

Each section should help staff answer one operational question quickly.

## Campaign Workflow Recommendation

Campaigns should feel like guided outreach, not backend machinery.

### Staff-Facing Inputs

A campaign should let staff choose:

- target support state
- whether assigned or unassigned people are included
- time since last outreach or last check-in
- optional system tags

### Staff-Facing Outcomes

When someone responds, staff should see:

- updated support state
- any tags added automatically
- whether the person is now unassigned active work

### Important Constraint

Campaigns should not require staff to understand null statuses, hidden bot-only logic, or Discord message recovery details.

## Terminology Rules

### Use These Terms

- `Owner`
- `Support State`
- `Support Tags`
- `Last Check-In`
- `Open`
- `On Hold`
- `Closed`

### Avoid These Terms In Staff UI

- `Assignment Status`
- `Supervision Need`
- multiple overlapping labels for the same queue concept

### Why

Non-technical staff should not need to translate between several internal models to do routine work.

## What Should Be Hidden From Staff

These are valid engineering concerns but should not become daily staff concepts:

- Discord notification persistence
- campaign event recovery
- internal source IDs
- raw bot execution details
- historical enum naming

## Success Criteria

This workflow redesign is successful if staff can:

1. open any revert profile and understand the situation in under 10 seconds
2. tell the difference between ownership and workflow state without training
3. find all active work from one or two obvious dashboard entry points
4. use one categorization system instead of choosing between tags and supervision needs
5. understand campaign outcomes without reading engineering documentation

## Product Decision Summary

The daily staff experience should center on:

- ownership
- support state
- tags
- check-ins

This is simpler, clearer, and easier to teach than the current mix of assignment status, supervision needs, tags, and campaign-driven edge behavior.