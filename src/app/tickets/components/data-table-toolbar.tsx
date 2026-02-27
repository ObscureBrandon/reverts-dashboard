'use client';

import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LayoutGrid, Loader2, X } from 'lucide-react';

export type TicketStatus = 'all' | 'OPEN' | 'CLOSED' | 'DELETED';

export type TicketFilterState = {
  status: TicketStatus;
  panelId: string;
};

type Panel = {
  id: number;
  title: string;
};

interface TicketsToolbarProps {
  filters: TicketFilterState;
  onFiltersChange: (filters: TicketFilterState) => void;
  panels: Panel[];
  authorInfo?: {
    id: string;
    name: string;
    displayName: string | null;
  } | null;
  onClearAuthorFilter?: () => void;
  pendingAction?: 'status' | 'panel' | 'page' | null;
}

export function TicketsToolbar({
  filters,
  onFiltersChange,
  panels,
  authorInfo,
  onClearAuthorFilter,
  pendingAction,
}: TicketsToolbarProps) {
  const selectedPanelCount = filters.panelId !== 'all' ? 1 : 0;
  const isPanelLoading = pendingAction === 'panel';
  
  const hasActiveFilters = filters.panelId !== 'all';

  const clearAllFilters = () => {
    onFiltersChange({
      ...filters,
      panelId: 'all',
    });
  };

  return (
    <div className="space-y-4">
      {/* Author Filter Indicator */}
      {authorInfo && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <p className="text-emerald-800 dark:text-emerald-200 text-sm font-medium">
              Showing tickets by @{authorInfo.name}
              {authorInfo.displayName && authorInfo.displayName !== authorInfo.name && (
                <span className="text-emerald-600 dark:text-emerald-300"> ({authorInfo.displayName})</span>
              )}
            </p>
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={onClearAuthorFilter}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            Clear Filter
          </Button>
        </div>
      )}

      {/* Filters Row */}
      <div className="flex items-center gap-2">
        {/* Panel Filter Dropdown */}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1.5">
              {isPanelLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
              ) : (
                <LayoutGrid className="h-3.5 w-3.5" />
              )}
              Panels
              {selectedPanelCount > 0 && !isPanelLoading && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                  {selectedPanelCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuCheckboxItem
              checked={filters.panelId === 'all'}
              onCheckedChange={() => onFiltersChange({ ...filters, panelId: 'all' })}
              className="[&>span]:data-[state=checked]:bg-emerald-600 [&>span]:data-[state=checked]:text-white"
            >
              All Panels
            </DropdownMenuCheckboxItem>
            {panels.map(panel => (
              <DropdownMenuCheckboxItem
                key={panel.id}
                checked={filters.panelId === panel.id.toString()}
                onCheckedChange={() => onFiltersChange({ ...filters, panelId: panel.id.toString() })}
                className="[&>span]:data-[state=checked]:bg-emerald-600 [&>span]:data-[state=checked]:text-white"
              >
                {panel.title}
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
  );
}
