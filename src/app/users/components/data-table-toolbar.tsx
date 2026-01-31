'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Table } from '@tanstack/react-table';
import { Columns3, Loader2, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';

export type ViewPreset = 'all' | 'staff';
export type QuickFilter = 'needs-support' | 'has-shahada' | 'has-support' | 'assigned-to-me';

export type FilterState = {
  query: string;
  assignmentStatus: string;
  relationToIslam: string;
  roleId: string;
  inGuild: string;
};

interface DataTableToolbarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onSearch: (query: string) => void;
  activeView: ViewPreset;
  onViewChange: (view: ViewPreset) => void;
  activeQuickFilters: Set<QuickFilter>;
  onQuickFilterToggle: (filter: QuickFilter) => void;
  table: Table<any>;
  isFetching?: boolean;
}

const viewPresets: { id: ViewPreset; label: string }[] = [
  { id: 'all', label: 'All Users' },
  { id: 'staff', label: 'Staff Overview' },
];

const quickFilters: { id: QuickFilter; label: string; color: string }[] = [
  { id: 'needs-support', label: 'Needs Support', color: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900' },
  { id: 'has-shahada', label: 'Has Shahada', color: 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-400 dark:border-teal-900' },
  { id: 'has-support', label: 'Has Support', color: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-400 dark:border-purple-900' },
  { id: 'assigned-to-me', label: 'Assigned to Me', color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-900' },
];

const columnLabels: Record<string, string> = {
  user: 'User',
  relationToIslam: 'Relation to Islam',
  status: 'Status',
  currentAssignmentStatus: 'Assignment',
  topRoles: 'Roles',
  createdAt: 'Joined',
  superviseeCount: 'Supporting',
  supervisees: 'Supervisees',
};

export function DataTableToolbar({
  filters,
  onFiltersChange,
  onSearch,
  activeView,
  onViewChange,
  activeQuickFilters,
  onQuickFilterToggle,
  table,
  isFetching,
}: DataTableToolbarProps) {
  // Track which filter was last clicked to show spinner only on that button
  const [pendingFilter, setPendingFilter] = useState<QuickFilter | null>(null);

  // Clear pending state when fetching completes
  useEffect(() => {
    if (!isFetching) {
      setPendingFilter(null);
    }
  }, [isFetching]);

  const handleQuickFilterClick = (filter: QuickFilter) => {
    setPendingFilter(filter);
    onQuickFilterToggle(filter);
  };

  const hasActiveFilters = 
    filters.assignmentStatus !== 'all' ||
    filters.relationToIslam !== 'all' ||
    filters.roleId !== 'all' ||
    filters.inGuild !== 'all' ||
    activeQuickFilters.size > 0;

  const clearAllFilters = () => {
    onFiltersChange({
      query: filters.query,
      assignmentStatus: 'all',
      relationToIslam: 'all',
      roleId: 'all',
      inGuild: 'all',
    });
    // Clear quick filters by toggling them off
    activeQuickFilters.forEach(filter => onQuickFilterToggle(filter));
  };

  return (
    <div className="space-y-4">
      {/* View Preset Tabs */}
      <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg w-fit">
        {viewPresets.map((preset) => (
          <button
            key={preset.id}
            onClick={() => onViewChange(preset.id)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeView === preset.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Search, Quick Filters and Column Toggle Row */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name..."
            value={filters.query}
            onChange={(e) => onSearch(e.target.value)}
            className="pl-9 bg-background h-9"
          />
        </div>

        {/* Quick Filter Chips - only show for non-staff views */}
        {activeView !== 'staff' && (
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2 sm:flex-wrap">
            {quickFilters.map((filter) => {
              const isActive = activeQuickFilters.has(filter.id);
              const isPending = pendingFilter === filter.id && isFetching;
              return (
                <button
                  key={filter.id}
                  onClick={() => handleQuickFilterClick(filter.id)}
                  className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border transition-all ${
                    isActive
                      ? filter.color
                      : 'bg-background text-muted-foreground border-border hover:border-foreground/30'
                  }`}
                >
                  {isActive && (
                    isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    )
                  )}
                  {filter.label}
                  {isActive && (
                    <X className="h-3 w-3 ml-0.5 opacity-70" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {/* Column visibility toggle */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5">
                <Columns3 className="h-3.5 w-3.5" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {columnLabels[column.id] || column.id}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Clear All */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="text-muted-foreground hover:text-foreground h-9"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Clear all
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
