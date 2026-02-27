# Users Table View

> Technical documentation for the Users Table feature, including the data table, filtering, and user details side panel.

## Overview

The Users Table is the primary interface for admins to browse, filter, and view detailed information about community members. It consists of:

| Component | Purpose |
|-----------|---------|
| [page.tsx](../../src/app/users/page.tsx) | Main page with state management |
| [data-table.tsx](../../src/app/users/components/data-table.tsx) | TanStack Table wrapper |
| [data-table-toolbar.tsx](../../src/app/users/components/data-table-toolbar.tsx) | Filters, search, view presets |
| [columns.tsx](../../src/app/users/components/columns.tsx) | Column definitions |
| [user-details-panel.tsx](../../src/app/users/components/user-details-panel.tsx) | Side panel for user details |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ page.tsx (State Management)                                     │
│  - Filter state, pagination, sorting                            │
│  - Selected user state for panel                                │
│  - Prefetch handlers                                            │
└────────────────────────────────────────────────────────────────┬┘
                                                                  │
     ┌────────────────────────────────────────────────────────────┼───────────────────┐
     │                                                            │                   │
     ▼                                                            ▼                   ▼
┌─────────────────┐  ┌──────────────────────────┐  ┌────────────────────────────────────┐
│ DataTableToolbar │  │ DataTable                │  │ UserDetailsPanel                   │
│ - Search input   │  │ - TanStack react-table   │  │ - Sheet (desktop) / Drawer (mobile)│
│ - View presets   │  │ - Row click → open panel │  │ - Collapsible sections             │
│ - Quick filters  │  │ - Row hover → prefetch   │  │ - Non-modal on desktop             │
│ - Column toggle  │  │ - Pagination             │  │                                    │
└─────────────────┘  └──────────────────────────┘  └────────────────────────────────────┘
```

---

## URL Query Parameters

All table state is synced to the URL via [nuqs](https://nuqs.47ng.com/), enabling shareable links, browser history, and refresh resilience.

### Schema

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | integer | `1` | Current page number |
| `q` | string | `""` | Search query |
| `view` | `all` \| `staff` | `all` | View preset |
| `status` | string | `all` | Assignment status filter |
| `relation` | string | `all` | Relation to Islam filter |
| `role` | string | `all` | Role ID filter |
| `guild` | string | `all` | In guild filter |
| `sort` | string | `createdAt` | Sort column |
| `order` | `asc` \| `desc` | `desc` | Sort direction |
| `filters` | string[] | `[]` | Active quick filters (comma-separated) |
| `user` | string | `null` | Selected user ID (opens panel) |

### Examples

```
# Page 2 with search
/users?page=2&q=john

# Staff view
/users?view=staff&sort=superviseeCount&order=desc

# Multiple quick filters
/users?filters=needs-support,has-shahada

# Deep link to user panel
/users?user=abc123
```

### Behavior

- **Clean URLs**: Default values are omitted (e.g., `page=1` not shown)
- **View presets**: Switching views auto-applies associated filters/sorting
- **Debounced search**: Search input updates URL after 150ms delay
- **History mode**: Uses `replace` to avoid cluttering browser history

---

## Views and Quick Filters

### View Presets

| View | Description | Sort Default | Columns |
|------|-------------|--------------|---------|
| **All Users** | Default view showing all community members | `createdAt` desc | User, Relation, Status, Roles, Created |
| **Staff Overview** | Staff members with their supervisees | `superviseeCount` desc | User, Supporting, Supervisees, Roles |

When switching to Staff Overview, the table uses different columns and data source (`/api/users/staff`). Quick filters are hidden as they don't apply to staff data.

### Quick Filters (All Users view only)

| Filter ID | Label | Effect |
|-----------|-------|--------|
| `needs-support` | Needs Support | `assignmentStatus = 'NEEDS_SUPPORT'` |
| `has-shahada` | Has Shahada | Users with at least one recorded shahada |
| `has-support` | Has Support | Users with active supervisors |
| `assigned-to-me` | Assigned to Me | Users assigned to current staff member |

Quick filters are toggle buttons that apply backend filters. Multiple can be active simultaneously.

---

## Key Patterns

### 1. Non-Modal Side Panel

The desktop panel uses `modal={false}` and `showOverlay={false}` so users can:
- Continue scrolling/interacting with the table
- Click other users to switch the panel content instantly
- Avoid the slide-in animation when switching users

```tsx
<Sheet open={open} onOpenChange={onOpenChange} modal={false}>
  <SheetContent showOverlay={false}>
```

### 2. Responsive Design
- **Desktop/Tablet (≥768px)**: Right-side Sheet panel (420px wide)
- **Mobile (<768px)**: Bottom Drawer with swipe-to-dismiss via Vaul

```tsx
if (isMobile) {
  return <Drawer>...</Drawer>
}
return <Sheet modal={false}>...</Sheet>
```

### 3. Prefetching on Hover

Data is prefetched when hovering a row for instant panel display:

```tsx
// page.tsx
const handleRowHover = useCallback((user: UserListItem) => {
  prefetchUserDetails(user.id);
}, [prefetchUserDetails]);

// data-table.tsx
<TableRow onMouseEnter={() => onRowHoverStart?.(row.original)} />
```

### 4. No Layout Shift

The Sheet uses fixed positioning and portal rendering. The table content never moves:
- Panel slides in from right edge
- Overlay is disabled (`showOverlay={false}`)
- Body scroll is not blocked

---

## Data Flow

### API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/users` | Paginated user list with filters |
| `GET /api/users/staff` | Staff members with supervisee data |
| `GET /api/users/[id]?full=true` | Full user details for panel |
| `GET /api/users/relations` | Distinct relation values for filter dropdown |
| `GET /api/roles` | Roles for filter dropdown |

### React Query Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useUsersTable` | `useUsersTable.ts` | Fetches paginated user list |
| `useStaffTable` | `useStaffTable.ts` | Fetches staff with supervisee data |
| `usePrefetchUsersTable` | `useUsersTable.ts` | Prefetches adjacent pages |
| `useUserDetails` | `useUserDetails.ts` | Fetches full user details |
| `usePrefetchUserDetails` | `useUserDetails.ts` | Prefetches user on hover |

---

## User Details Panel Sections

The panel displays comprehensive user information in collapsible sections:

| Section | Data Source | Default State |
|---------|-------------|---------------|
| **Header** | `user.*` | Always visible, sticky |
| **Profile** | `user.gender`, `age`, `region`, etc. | Open (desktop) |
| **Roles** | `roles[]` | Open (desktop) |
| **Revert Journey** | `shahadas[]`, `assignmentHistory[]`, `supervisionNeeds[]`, `supervisors[]` | Always open |
| **Supervisor Notes** | `supervisorEntries[]` | Open (desktop) |
| **Moderation** | `infractions[]` | **Collapsed** by default |
| **Tickets** | `ticketStats` | Open (desktop) |

### Gender Badge Styling

Gender pills use distinct icons and colors:
- **Male**: `<Mars />` icon with blue styling (`bg-blue-100`)
- **Female**: `<Venus />` icon with pink styling (`bg-pink-100`)

---

## Important Considerations

### Performance
- Adjacent pages are prefetched for smooth pagination
- User details are prefetched on row hover
- `keepPreviousData` prevents layout shift during refetch

### Accessibility
- `VisuallyHidden` wraps Sheet/Drawer titles for screen readers
- Close button has `sr-only` label
- Escape key closes the panel

### Animation Speed
- Sheet animation: 200ms open, 150ms close
- Faster than default shadcn (500ms/300ms)

### Mobile Drawer
- Uses Vaul for native swipe gestures
- Max height: 85vh
- Has drag handle indicator

---

## Common Modifications

### Adding a New Column

1. Add column definition in `columns.tsx`
2. Update `viewColumnDefaults` for each view preset
3. Ensure API returns the field

### Adding a Panel Section

1. Create section component in `user-details-panel.tsx`
2. Add to `PanelContent` with `CollapsibleSection` wrapper
3. Set `defaultOpen` based on mobile/desktop

### Adding a Filter

1. Add to `FilterState` type in `data-table-toolbar.tsx`
2. Add UI control in toolbar
3. Update `queryParams` in `page.tsx`
4. Ensure API endpoint supports the filter
