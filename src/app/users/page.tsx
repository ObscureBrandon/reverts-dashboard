'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { useSession } from '@/lib/auth-client';
import { useStaffTable } from '@/lib/hooks/queries/useStaffTable';
import { usePrefetchUserDetails } from '@/lib/hooks/queries/useUserDetails';
import { usePrefetchUsersTable, UserListItem, useUsersTable } from '@/lib/hooks/queries/useUsersTable';
import { cn } from '@/lib/utils';
import { useDebouncedCallback } from '@tanstack/react-pacer';
import { SortingState, VisibilityState } from '@tanstack/react-table';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { parseAsArrayOf, parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { columns, staffColumns, viewColumnDefaults } from './components/columns';
import { DataTable } from './components/data-table';
import { DataTableToolbar, FilterState, QuickFilter, ViewPreset } from './components/data-table-toolbar';
import { UserDetailsPanel } from './components/user-details-panel';

// URL search params schema
const viewOptions = ['all', 'staff'] as const;
const orderOptions = ['asc', 'desc'] as const;

const searchParamsSchema = {
  page: parseAsInteger.withDefault(1),
  q: parseAsString.withDefault(''),
  view: parseAsStringLiteral(viewOptions).withDefault('all'),
  status: parseAsString.withDefault('all'),
  relation: parseAsString.withDefault('all'),
  role: parseAsString.withDefault('all'),
  guild: parseAsString.withDefault('all'),
  sort: parseAsString.withDefault('createdAt'),
  order: parseAsStringLiteral(orderOptions).withDefault('desc'),
  filters: parseAsArrayOf(parseAsString).withDefault([]),
  user: parseAsString,
};

// Loading skeleton component
function UsersLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header skeleton */}
        <div className="mb-8">
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>

        {/* Toolbar skeleton */}
        <div className="mb-6 space-y-4">
          <Skeleton className="h-10 w-full max-w-md" />
          <div className="flex gap-3">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-36" />
          </div>
        </div>

        {/* Table skeleton */}
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border p-4">
            <div className="flex gap-4">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-16" />
            </div>
          </div>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="border-b border-border p-4 last:border-0">
              <div className="flex gap-4 items-center">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div>
                    <Skeleton className="h-5 w-32 mb-1" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const router = useRouter();
  const { data: session, isPending: isSessionLoading } = useSession();
  
  // URL-synced state using nuqs
  const [params, setParams] = useQueryStates(searchParamsSchema, {
    history: 'replace',
    shallow: true,
    throttleMs: 50,
  });

  // Local state for search input (for immediate UI feedback)
  const [searchInput, setSearchInput] = useState(params.q);
  
  // Column visibility (local state, not URL-synced)
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  
  // User details panel prefetching
  const { prefetch: prefetchUserDetails } = usePrefetchUserDetails();

  // Derive state from URL params
  const page = params.page;
  const activeView = params.view as ViewPreset;
  const sorting: SortingState = [{ id: params.sort, desc: params.order === 'desc' }];
  const activeQuickFilters = new Set(params.filters as QuickFilter[]);
  const selectedUserId = params.user;
  const panelOpen = !!params.user;

  const filters: FilterState = {
    query: searchInput,
    assignmentStatus: params.status,
    relationToIslam: params.relation,
    roleId: params.role,
    inGuild: params.guild,
  };

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isSessionLoading && !session) {
      router.push('/login?callbackUrl=/users');
    }
  }, [session, isSessionLoading, router]);

  // Sync search input with URL on mount/navigation
  useEffect(() => {
    setSearchInput(params.q);
  }, [params.q]);

  // Update column visibility when view changes
  useEffect(() => {
    if (activeView === 'staff') {
      // Staff view uses its own columns, so just show all of them
      const staffColumnIds = ['user', 'superviseeCount', 'supervisees', 'topRoles'];
      const newVisibility: VisibilityState = {};
      staffColumnIds.forEach(id => {
        newVisibility[id] = true;
      });
      setColumnVisibility(newVisibility);
    } else {
      const visibleColumns = viewColumnDefaults[activeView] || viewColumnDefaults.all;
      const allColumnIds = ['user', 'relationToIslam', 'status', 'currentAssignmentStatus', 'topRoles', 'createdAt'];
      
      const newVisibility: VisibilityState = {};
      allColumnIds.forEach(id => {
        newVisibility[id] = visibleColumns.includes(id);
      });
      
      setColumnVisibility(newVisibility);
    }
  }, [activeView]);

  // Debounced search - updates URL after typing stops
  const debouncedSearch = useDebouncedCallback(
    (query: string) => {
      setParams({ q: query || null, page: 1 });
    },
    { wait: 150 }
  );

  const handleSearch = useCallback((query: string) => {
    setSearchInput(query);
    debouncedSearch(query);
  }, [debouncedSearch]);

  const handleFiltersChange = useCallback((newFilters: FilterState) => {
    setSearchInput(newFilters.query);
    setParams({
      status: newFilters.assignmentStatus === 'all' ? null : newFilters.assignmentStatus,
      relation: newFilters.relationToIslam === 'all' ? null : newFilters.relationToIslam,
      role: newFilters.roleId === 'all' ? null : newFilters.roleId,
      guild: newFilters.inGuild === 'all' ? null : newFilters.inGuild,
      page: 1,
    });
  }, [setParams]);

  const handleViewChange = useCallback((view: ViewPreset) => {
    if (view === 'staff') {
      // Set sort to a valid staff column
      setParams({ 
        view: 'staff',
        filters: null, 
        sort: 'superviseeCount', 
        order: 'desc', 
        page: 1 
      });
    } else {
      // 'all' view - reset to defaults
      setParams({ 
        view: null, 
        filters: null, 
        sort: null, 
        order: null, 
        page: 1 
      });
    }
  }, [setParams]);

  const handleQuickFilterToggle = useCallback((filter: QuickFilter) => {
    const current = new Set(params.filters as QuickFilter[]);
    if (current.has(filter)) {
      current.delete(filter);
    } else {
      current.add(filter);
    }
    const newFilters = Array.from(current);
    setParams({ filters: newFilters.length > 0 ? newFilters : null, page: 1 });
  }, [params.filters, setParams]);

  const handlePageChange = useCallback((newPage: number) => {
    setParams({ page: newPage === 1 ? null : newPage });
  }, [setParams]);

  const handleSortingChange = useCallback((newSorting: SortingState) => {
    if (newSorting.length > 0) {
      const { id, desc } = newSorting[0];
      setParams({
        sort: id === 'createdAt' ? null : id,
        order: desc ? null : 'asc',
      });
    }
  }, [setParams]);

  // Handler for row click - opens user details panel
  const handleRowClick = useCallback((user: UserListItem) => {
    setParams({ user: user.id });
  }, [setParams]);

  // Handler for row hover - prefetches user details
  const handleRowHover = useCallback((user: UserListItem) => {
    prefetchUserDetails(user.id);
  }, [prefetchUserDetails]);

  // Handler for panel close
  const handlePanelOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setParams({ user: null });
    }
  }, [setParams]);

  // Build query params for API based on all filters
  const queryParams = useMemo(() => {
    const apiParams: Record<string, any> = {
      query: params.q || undefined,
      page: params.page,
      limit: 50,
      sortBy: params.sort === 'user' ? 'name' : params.sort,
      sortOrder: params.order,
    };

    // Apply quick filters
    if (activeQuickFilters.has('needs-support')) {
      apiParams.assignmentStatus = 'NEEDS_SUPPORT';
    }

    if (activeQuickFilters.has('has-shahada')) {
      apiParams.hasShahada = true;
    }

    if (activeQuickFilters.has('has-support')) {
      apiParams.hasSupport = true;
    }

    if (activeQuickFilters.has('assigned-to-me')) {
      apiParams.assignedToMe = true;
    }

    // Apply manual filters (except if quick filters override them)
    if (params.status !== 'all' && !apiParams.assignmentStatus) {
      apiParams.assignmentStatus = params.status;
    }
    if (params.relation !== 'all' && !apiParams.relationToIslam) {
      apiParams.relationToIslam = params.relation;
    }
    if (params.guild !== 'all' && apiParams.inGuild === undefined) {
      apiParams.inGuild = params.guild === 'true';
    }
    if (params.role !== 'all') {
      apiParams.roleId = params.role;
    }

    return apiParams;
  }, [params, activeQuickFilters]);

  // Staff query params (simpler, just query and pagination)
  const staffQueryParams = useMemo(() => ({
    query: params.q || undefined,
    page: params.page,
    limit: 50,
    sortBy: params.sort === 'user' ? 'name' as const : 'superviseeCount' as const,
    sortOrder: params.order as 'asc' | 'desc',
  }), [params]);

  // Use conditional hooks - disable the inactive one to prevent stale data issues
  const usersQuery = useUsersTable(queryParams, { enabled: activeView !== 'staff' });
  const staffQuery = useStaffTable(staffQueryParams, { enabled: activeView === 'staff' });
  
  const { prefetchPage } = usePrefetchUsersTable();

  // Get the right data based on active view
  const isStaffView = activeView === 'staff';
  const data = isStaffView ? staffQuery.data : usersQuery.data;
  const isLoading = isStaffView ? staffQuery.isLoading : usersQuery.isLoading;
  const isFetching = isStaffView ? staffQuery.isFetching : usersQuery.isFetching;
  const error = isStaffView ? staffQuery.error : usersQuery.error;
  
  // Get the data array based on view
  const tableData = isStaffView 
    ? (staffQuery.data?.staff || []) 
    : (usersQuery.data?.users || []);

  // Prefetch adjacent pages (only for users view)
  useEffect(() => {
    if (!isStaffView && usersQuery.data?.pagination) {
      const { page: currentPage, totalPages } = usersQuery.data.pagination;
      
      if (currentPage < totalPages) {
        prefetchPage({ ...queryParams, page: currentPage + 1 });
      }
      if (currentPage > 1) {
        prefetchPage({ ...queryParams, page: currentPage - 1 });
      }
    }
  }, [isStaffView, usersQuery.data?.pagination, prefetchPage, queryParams]);

  // Show skeleton while checking session OR loading initial data
  const showInitialLoading = isSessionLoading || (isLoading && !data);
  
  if (showInitialLoading) {
    return <UsersLoading />;
  }

  // Don't render content if not authenticated (will redirect)
  if (!session) {
    return <UsersLoading />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Main content - adds margin when panel is open to make room */}
      <div className={cn(
        "transition-[margin] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
        panelOpen && "lg:mr-[420px]"
      )}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-foreground tracking-tight">
                  Users
                </h1>
                <p className="text-muted-foreground mt-1">
                  Manage and view all community members
                </p>
              </div>
              <div className="flex items-center gap-4">
                <Link
                  href="/"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Home
                </Link>
                <Link
                  href="/tickets"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Tickets
                </Link>
                <Link
                  href="/messages"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Messages
                </Link>
              </div>
            </div>
          </div>

          {/* Error state */}
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 mb-6">
              <p className="text-destructive text-sm">
                Failed to load users. Please try again.
              </p>
            </div>
          )}

          {/* Data Table */}
          <DataTable
            columns={isStaffView ? staffColumns : columns}
            data={tableData as any}
            isLoading={isLoading}
            isFetching={isFetching}
            pagination={data?.pagination}
            onPageChange={handlePageChange}
            columnVisibility={columnVisibility}
            onColumnVisibilityChange={setColumnVisibility}
            sorting={sorting}
            onSortingChange={handleSortingChange}
            onRowClick={isStaffView ? undefined : handleRowClick}
            onRowHoverStart={isStaffView ? undefined : handleRowHover}
            renderToolbar={(table) => (
              <DataTableToolbar
                filters={filters}
                onFiltersChange={handleFiltersChange}
                onSearch={handleSearch}
                activeView={activeView}
                onViewChange={handleViewChange}
                activeQuickFilters={activeQuickFilters}
                onQuickFilterToggle={handleQuickFilterToggle}
                table={table}
                isFetching={isFetching}
              />
            )}
          />
        </div>
      </div>

      {/* User Details Side Panel */}
      <UserDetailsPanel
        userId={selectedUserId}
        open={panelOpen}
        onOpenChange={handlePanelOpenChange}
      />
    </div>
  );
}
