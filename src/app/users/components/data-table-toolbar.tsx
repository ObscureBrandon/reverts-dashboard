'use client';

import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Loader2, Search, Settings2, X } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';

export type ViewPreset = 'all' | 'staff';
export type QuickFilter = 'needs-support' | 'has-shahada' | 'has-support' | 'assigned-to-me';

export type FilterState = {
  query: string;
  assignmentStatus: string;
  relationToIslam: string;
  roleId: string;
  inGuild: string;
};

type ColumnOption = {
  id: string;
  label: string;
  visible: boolean;
};

interface DataTableToolbarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onSearch: (query: string) => void;
  activeView: ViewPreset;
  onViewChange: (view: ViewPreset) => void;
  activeQuickFilters: Set<QuickFilter>;
  onQuickFilterToggle: (filter: QuickFilter) => void;
  columnOptions: ColumnOption[];
  onColumnVisibilityToggle: (columnId: string, visible: boolean) => void;
  isFetching?: boolean;
}

const viewPresets: { id: ViewPreset; label: string }[] = [
  { id: 'all', label: 'All Users' },
  { id: 'staff', label: 'Staff Overview' },
];

const quickFilters: { id: QuickFilter; label: string; activeClassName: string }[] = [
  { id: 'needs-support', label: 'Needs Support', activeClassName: 'border-status-danger-border bg-status-danger-soft text-status-danger-text' },
  { id: 'has-shahada', label: 'Has Shahada', activeClassName: 'border-status-success-border bg-status-success-soft text-status-success-text' },
  { id: 'has-support', label: 'Has Support', activeClassName: 'border-status-info-border bg-status-info-soft text-status-info-text' },
  { id: 'assigned-to-me', label: 'Assigned to Me', activeClassName: 'border-brand-accent-border bg-brand-accent-soft text-brand-accent-text' },
];

const columnLabels: Record<string, string> = {
  user: 'User',
  relationToIslam: 'Relation to Islam',
  status: 'Status',
  currentAssignmentStatus: 'Assignment',
  attention: 'Attention',
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
  columnOptions,
  onColumnVisibilityToggle,
  isFetching,
}: DataTableToolbarProps) {
  // Track which filter was last clicked to show spinner only on that button
  const [pendingFilter, setPendingFilter] = useState<QuickFilter | null>(null);

  // Refs for measuring tab positions for sliding underline
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const tabLabelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [underlineStyle, setUnderlineStyle] = useState({ left: 0, width: 0 });

  // Update underline position when active view changes
  useLayoutEffect(() => {
    const activeIndex = viewPresets.findIndex(p => p.id === activeView);
    const activeLabel = tabLabelRefs.current[activeIndex];
    const container = tabsContainerRef.current;
    
    if (activeLabel && container) {
      const containerRect = container.getBoundingClientRect();
      const labelRect = activeLabel.getBoundingClientRect();
      setUnderlineStyle({
        left: labelRect.left - containerRect.left,
        width: labelRect.width,
      });
    }
  }, [activeView]);

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
      <div ref={tabsContainerRef} className="flex items-center gap-6 relative">
        {viewPresets.map((preset, index) => (
          <button
            key={preset.id}
            onClick={() => onViewChange(preset.id)}
            className={`py-2 text-sm font-medium transition-colors ${
              activeView === preset.id
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span ref={(el) => { tabLabelRefs.current[index] = el; }}>
              {preset.label}
            </span>
          </button>
        ))}
        <span className="absolute bottom-0 left-0 right-0 h-px bg-border" />
        {/* Sliding underline */}
        <span 
          className="absolute bottom-0 z-10 h-0.5 rounded-full bg-brand-accent-solid transition-all duration-300 ease-out"
          style={{
            left: underlineStyle.left,
            width: underlineStyle.width,
          }}
        />
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
                  className={cn(
                    'inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                    isActive
                      ? filter.activeClassName
                      : 'border-border bg-background text-muted-foreground hover:border-foreground/20 hover:text-foreground'
                  )}
                >
                  {isActive && (
                    isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    )
                  )}
                  {filter.label}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-2 sm:ml-auto">
          {/* Column visibility toggle */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5">
                <Settings2 className="h-3.5 w-3.5" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {columnOptions.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.visible}
                  onCheckedChange={(value) => onColumnVisibilityToggle(column.id, !!value)}
                >
                  {columnLabels[column.id] || column.label}
                </DropdownMenuCheckboxItem>
              ))}
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
