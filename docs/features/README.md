# Feature Documentation

> Technical documentation for substantial features in the Reverts Dashboard.

These docs are designed to help LLMs and developers understand feature architecture, patterns, and common modifications.

## Features

| Feature | Description |
|---------|-------------|
| [Dashboard UX Audit](./DASHBOARD_UX_AUDIT_2026-03-06.md) | Canonical UX audit, redesign direction, and implementation backlog for the full dashboard |
| [Dashboard Implementation Backlog](./DASHBOARD_IMPLEMENTATION_BACKLOG_2026-03-06.md) | Execution-ready backlog ordered by delivery sequence across foundation work, shared primitives, page rollout, and later feature expansion |
| [Dashboard Redesign Priority Map](./DASHBOARD_REDESIGN_PRIORITY_MAP_2026-03-06.md) | Implementation-facing redesign sequencing plan across shared system work and page-level rollout |
| [Shared System Redesign Spec](./SHARED_SYSTEM_REDESIGN_SPEC_2026-03-06.md) | Concrete shared UI system rules for semantic colors, statuses, badges, avatars, panels, and page headers |
| [Users Table](./USERS_TABLE.md) | User list with filtering, sorting, pagination, and details side panel |

## Document Structure

Each feature doc includes:

- **Overview** - What the feature does and its components
- **Architecture** - Visual diagram of component relationships
- **Key Patterns** - Important implementation patterns to preserve
- **Data Flow** - API endpoints and React Query hooks
- **Important Considerations** - Performance, accessibility, edge cases
- **Common Modifications** - How to extend the feature
