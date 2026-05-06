'use client';

import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ChevronDown, Loader2, Plus, Search, Settings2, X } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';

export type ViewPreset = 'all' | 'staff';
export type QuickFilter = 'needs-support' | 'needs-assignment' | 'overdue-check-in' | 'assigned-to-me';

export type FilterState = {
  query: string;
  assignmentStatus: string;
  relationToIslam: string;
  roleId: string;
  inGuild: string;
  tagId: string;
  assignedStaffId: string;
  overdueCheckIn: string;
  needsAssignment: string;
  verified: string;
  voiceVerified: string;
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
  canAccessStaffOverview?: boolean;
  activeQuickFilters: Set<QuickFilter>;
  onQuickFilterToggle: (filter: QuickFilter) => void;
  columnOptions: ColumnOption[];
  onColumnVisibilityToggle: (columnId: string, visible: boolean) => void;
  isFetching?: boolean;
  staffOptions?: Array<{ id: string; name: string }>;
  tagOptions?: Array<{ id: number; name: string; emoji: string | null }>;
}

const viewPresets: { id: ViewPreset; label: string }[] = [
  { id: 'all', label: 'All Users' },
  { id: 'staff', label: 'Staff Overview' },
];

const quickFilters: { id: QuickFilter; label: string; activeClassName: string }[] = [
  { id: 'needs-support', label: 'Open Support', activeClassName: 'border-status-danger-border bg-status-danger-soft text-status-danger-text' },
  { id: 'needs-assignment', label: 'Needs Assignment', activeClassName: 'border-status-danger-border bg-status-danger-soft text-status-danger-text' },
  { id: 'overdue-check-in', label: 'Overdue Check-in', activeClassName: 'border-status-warning-border bg-status-warning-soft text-status-warning-text' },
  { id: 'assigned-to-me', label: 'Assigned to Me', activeClassName: 'border-brand-accent-border bg-brand-accent-soft text-brand-accent-text' },
];

// ============================================================================
// Filter sheet helpers
// ============================================================================

const assignmentStatusOptions: Array<{ value: string; label: string }> = [
  { value: 'OPEN', label: 'Open' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'CLOSED', label: 'Closed' },
];

const relationOptions: Array<{ value: string; label: string }> = [
  { value: 'Revert Muslim', label: 'Revert' },
  { value: 'Born Muslim', label: 'Born Muslim' },
  { value: 'Interested in Islam', label: 'Interested in Islam' },
];

const booleanOptions: Array<{ value: string; label: string }> = [
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
];

// ============================================================================
// Inline filter dropdown
// ============================================================================

const RADIO_ITEM_CLASS = 'data-[state=checked]:[&_svg]:text-brand-accent-solid';

function FilterDropdown({
  label,
  value,
  options,
  onValueChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onValueChange: (value: string) => void;
}) {
  const isActive = value !== 'all';
  const activeLabel = isActive ? (options.find(o => o.value === value)?.label ?? value) : null;

  return (
    <div
      className={cn(
        'inline-flex h-7 items-center rounded-md border text-xs font-medium transition-colors',
        isActive
          ? 'border-border bg-muted/60 text-foreground hover:bg-muted'
          : 'border-dashed border-border bg-transparent text-muted-foreground hover:border-foreground/30 hover:text-foreground'
      )}
    >
      {/* Clear button — entirely outside the DropdownMenuTrigger */}
      {isActive && (
        <button
          type="button"
          onClick={() => onValueChange('all')}
          className="flex h-full items-center pl-2 pr-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      )}

      {/* Dropdown trigger — clicking opens picker */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="flex h-full items-center outline-none">
            {isActive ? (
              <>
                <span className="pl-1 text-muted-foreground">{label}</span>
                <span className="mx-1.5 h-3.5 w-px bg-border" />
                <span className="max-w-[120px] truncate text-brand-accent-text">{activeLabel}</span>
                <ChevronDown className="mx-1.5 h-3 w-3 shrink-0 opacity-50" />
              </>
            ) : (
              <span className="flex items-center gap-1.5 px-2.5">
                <Plus className="h-3 w-3 opacity-50" />
                {label}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-40">
          <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">{label}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
            <DropdownMenuRadioItem value="all" className={RADIO_ITEM_CLASS}>Any</DropdownMenuRadioItem>
            {options.map((opt) => (
              <DropdownMenuRadioItem key={opt.value} value={opt.value} className={RADIO_ITEM_CLASS}>
                {opt.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ============================================================================
// Column labels
// ============================================================================

const columnLabels: Record<string, string> = {
  user: 'User',
  relationToIslam: 'Relation to Islam',
  status: 'Status',
  currentAssignmentStatus: 'Support State',
  attention: 'Attention',
  topRoles: 'Roles',
  createdAt: 'Joined',
  superviseeCount: 'Supporting',
  supervisees: 'Supervisees',
};

// ============================================================================
// Main toolbar
// ============================================================================

export function DataTableToolbar({
  filters,
  onFiltersChange,
  onSearch,
  activeView,
  onViewChange,
  canAccessStaffOverview = true,
  activeQuickFilters,
  onQuickFilterToggle,
  columnOptions,
  onColumnVisibilityToggle,
  isFetching,
  staffOptions = [],
  tagOptions = [],
}: DataTableToolbarProps) {
  const [pendingFilter, setPendingFilter] = useState<QuickFilter | null>(null);

  // Refs for measuring tab positions for sliding underline
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const tabLabelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [underlineStyle, setUnderlineStyle] = useState({ left: 0, width: 0 });

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

  const update = (key: keyof FilterState, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const hasActiveFilters =
    filters.assignmentStatus !== 'all' ||
    filters.relationToIslam !== 'all' ||
    filters.roleId !== 'all' ||
    filters.inGuild !== 'all' ||
    filters.tagId !== 'all' ||
    filters.assignedStaffId !== 'all' ||
    filters.overdueCheckIn !== 'all' ||
    filters.needsAssignment !== 'all' ||
    filters.verified !== 'all' ||
    filters.voiceVerified !== 'all' ||
    activeQuickFilters.size > 0;

  const clearAllFilters = () => {
    onFiltersChange({
      query: filters.query,
      assignmentStatus: 'all',
      relationToIslam: 'all',
      roleId: 'all',
      inGuild: 'all',
      tagId: 'all',
      assignedStaffId: 'all',
      overdueCheckIn: 'all',
      needsAssignment: 'all',
      verified: 'all',
      voiceVerified: 'all',
    });
    activeQuickFilters.forEach(filter => onQuickFilterToggle(filter));
  };

  const staffOptionsForDropdown = staffOptions.map(s => ({ value: s.id, label: s.name }));
  const tagOptionsForDropdown = tagOptions.map(t => ({
    value: String(t.id),
    label: t.emoji ? `${t.emoji} ${t.name}` : t.name,
  }));
  const visibleViewPresets = canAccessStaffOverview
    ? viewPresets
    : viewPresets.filter((preset) => preset.id !== 'staff');

  return (
    <div className="space-y-3">
      {/* View Preset Tabs */}
      <div ref={tabsContainerRef} className="relative flex items-center gap-6">
        {visibleViewPresets.map((preset, index) => (
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
        <span
          className="absolute bottom-0 z-10 h-0.5 rounded-full bg-brand-accent-solid transition-all duration-300 ease-out"
          style={{ left: underlineStyle.left, width: underlineStyle.width }}
        />
      </div>

      {/* Search + Quick Filters + Actions Row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name..."
            value={filters.query}
            onChange={(e) => onSearch(e.target.value)}
            className="h-9 bg-background pl-9"
          />
        </div>

        {/* Quick Filter Chips */}
        {activeView !== 'staff' && (
          <div className="flex flex-wrap items-center gap-2">
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
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    )
                  )}
                  {filter.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Right side: Columns + Clear all */}
        <div className="ml-auto flex items-center gap-2">
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

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="h-9 text-muted-foreground hover:text-foreground"
            >
              <X className="mr-1 h-3.5 w-3.5" />
              Clear all
            </Button>
          )}
        </div>
      </div>

      {/* Inline Filter Bar — always visible for users view */}
      {activeView !== 'staff' && (
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown
            label="Relation"
            value={filters.relationToIslam}
            options={relationOptions}
            onValueChange={(v) => update('relationToIslam', v)}
          />
          <FilterDropdown
            label="Support State"
            value={filters.assignmentStatus}
            options={assignmentStatusOptions}
            onValueChange={(v) => update('assignmentStatus', v)}
          />
          <FilterDropdown
            label="Assigned Staff"
            value={filters.assignedStaffId}
            options={staffOptionsForDropdown}
            onValueChange={(v) => update('assignedStaffId', v)}
          />
          <FilterDropdown
            label="Tag"
            value={filters.tagId}
            options={tagOptionsForDropdown}
            onValueChange={(v) => update('tagId', v)}
          />
          <FilterDropdown
            label="In Guild"
            value={filters.inGuild}
            options={booleanOptions}
            onValueChange={(v) => update('inGuild', v)}
          />
          <FilterDropdown
            label="Verified"
            value={filters.verified}
            options={booleanOptions}
            onValueChange={(v) => update('verified', v)}
          />
          <FilterDropdown
            label="Voice Verified"
            value={filters.voiceVerified}
            options={booleanOptions}
            onValueChange={(v) => update('voiceVerified', v)}
          />
        </div>
      )}
    </div>
  );
}
