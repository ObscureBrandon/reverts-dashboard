'use client';

import { NavigationHeader } from '@/app/components/navigation-header';
import { Skeleton } from '@/components/ui/skeleton';
import { useSession } from '@/lib/auth-client';
import { useUserPanel } from '@/lib/contexts/user-panel-context';
import { useStaffDetails } from '@/lib/hooks/queries/useStaffDetails';
import { StaffListItem, useStaffTable } from '@/lib/hooks/queries/useStaffTable';
import { usePrefetchUserDetails } from '@/lib/hooks/queries/useUserDetails';
import { usePrefetchUsersTable, UserListItem, useUsersTable } from '@/lib/hooks/queries/useUsersTable';
import { cn } from '@/lib/utils';
import { useDebouncedCallback } from '@tanstack/react-pacer';
import { SortingState, VisibilityState } from '@tanstack/react-table';
import { useRouter } from 'next/navigation';
import { parseAsArrayOf, parseAsInteger, parseAsString, parseAsStringLiteral, useQueryState, useQueryStates } from 'nuqs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { columns, staffColumns, viewColumnDefaults } from './components/columns';
import { DataTable } from './components/data-table';
import { DataTableToolbar, FilterState, QuickFilter, ViewPreset } from './components/data-table-toolbar';
import { PanelBreadcrumb, StaffDetailsPanel } from './components/staff-details-panel';
import { UserDetailsPanel } from './components/user-details-panel';

// URL search params schema
const viewOptions = ['all', 'staff'] as const;
const orderOptions = ['asc', 'desc'] as const;

// Note: user/staff params are managed by UserPanelContext, not here
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
  
  // Panel state from context (manages user/staff URL params)
  const { panelState, openUserPanel, openStaffPanel, closePanel } = useUserPanel();
  const selectedStaffId = panelState.panelType === 'staff' ? panelState.userId : null;
  const selectedUserId = panelState.panelType === 'user' ? panelState.userId : null;
  const staffPanelOpen = panelState.isOpen && panelState.panelType === 'staff';
  const userPanelOpen = panelState.isOpen && panelState.panelType === 'user';
  const panelOpen = panelState.isOpen;
  
  // Fetch staff details for breadcrumb when viewing a user from staff panel
  // We need a separate query state to track the "parent" staff when drilling down
  const [parentStaffId] = useQueryState('staff', parseAsString);
  const { data: staffDetailsData } = useStaffDetails(parentStaffId);

  // Track if we've ever loaded data (to prevent full-page skeleton on view switches)
  const hasInitiallyLoaded = useRef(false);

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

  // Handler for row click - opens user details panel (all users view)
  const handleRowClick = useCallback((user: UserListItem) => {
    openUserPanel(user.id);
  }, [openUserPanel]);

  // Handler for staff row click - opens staff details panel (staff view)
  const handleStaffRowClick = useCallback((staff: StaffListItem) => {
    openStaffPanel(staff.id);
  }, [openStaffPanel]);

  // Handler for row hover - prefetches user details
  const handleRowHover = useCallback((user: UserListItem) => {
    prefetchUserDetails(user.id);
  }, [prefetchUserDetails]);

  // Handler for user panel close
  const handleUserPanelOpenChange = useCallback((open: boolean) => {
    if (!open) {
      closePanel();
    }
  }, [closePanel]);

  // Handler for staff panel close
  const handleStaffPanelOpenChange = useCallback((open: boolean) => {
    if (!open) {
      closePanel();
    }
  }, [closePanel]);

  // Handler for clicking a supervisee in staff panel → opens user panel stacked
  const handleSuperviseeClick = useCallback((userId: string) => {
    openUserPanel(userId);
  }, [openUserPanel]);

  // Handler for back navigation in breadcrumb
  const handleBackToStaff = useCallback(() => {
    closePanel();
  }, [closePanel]);

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

  // Mark as initially loaded once we have data from either view
  useEffect(() => {
    if (data && !hasInitiallyLoaded.current) {
      hasInitiallyLoaded.current = true;
    }
  }, [data]);

  // Only show full-page skeleton on initial visit (before any data has loaded)
  // After initial load, view switches will show table skeleton only
  const showInitialLoading = isSessionLoading || (!hasInitiallyLoaded.current && isLoading && !data);
  
  // For view switches: show table skeleton when loading new view data
  const isViewSwitching = hasInitiallyLoaded.current && isLoading && !data;
  
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
        <NavigationHeader />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">
              Users
            </h1>
            <div className="h-1 w-12 bg-emerald-500 rounded-full mt-2" />
            <p className="text-muted-foreground mt-2">
              Manage and view all community members
            </p>
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
            columns={(isStaffView ? staffColumns : columns) as any}
            data={tableData as any}
            isLoading={isLoading || isViewSwitching}
            isFetching={isFetching}
            pagination={data?.pagination}
            onPageChange={handlePageChange}
            columnVisibility={columnVisibility}
            onColumnVisibilityChange={setColumnVisibility}
            sorting={sorting}
            onSortingChange={handleSortingChange}
            onRowClick={isStaffView ? handleStaffRowClick as any : handleRowClick}
            onRowHoverStart={isStaffView ? undefined : handleRowHover}
            selectedRowId={isStaffView ? selectedStaffId : selectedUserId}
            getRowId={(row) => row.id}
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

      {/* Staff Details Side Panel - renders regardless of view, hidden when user panel is open */}
      <StaffDetailsPanel
        staffId={selectedStaffId}
        open={staffPanelOpen && !userPanelOpen}
        onOpenChange={handleStaffPanelOpenChange}
        onSuperviseeClick={handleSuperviseeClick}
      />

      {/* User Details Side Panel */}
      {/* Shows breadcrumb only when opened from staff panel (both staff and user params set) */}
      <UserDetailsPanel
        userId={selectedUserId}
        open={userPanelOpen}
        onOpenChange={handleUserPanelOpenChange}
        breadcrumb={
          selectedStaffId && staffDetailsData ? (
            <PanelBreadcrumb
              staffName={staffDetailsData.staff.displayName || staffDetailsData.staff.name || 'Staff'}
              onBack={handleBackToStaff}
            />
          ) : undefined
        }
      />
    </div>
  );
}
