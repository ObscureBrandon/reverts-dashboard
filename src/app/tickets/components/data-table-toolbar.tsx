'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LayoutGrid, Search, X } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';

export type TicketStatus = 'all' | 'OPEN' | 'CLOSED' | 'DELETED';

export type TicketFilterState = {
  query: string;
  status: TicketStatus;
  panelIds: number[];
};

type Panel = {
  id: number;
  title: string;
};

interface TicketsToolbarProps {
  filters: TicketFilterState;
  onFiltersChange: (filters: TicketFilterState) => void;
  onSearch: (query: string) => void;
  panels: Panel[];
  authorInfo?: {
    id: string;
    name: string;
    displayName: string | null;
  } | null;
  onClearAuthorFilter?: () => void;
}

const queuePresets: { id: TicketStatus; label: string }[] = [
  { id: 'all', label: 'All Tickets' },
  { id: 'OPEN', label: 'Open Queue' },
  { id: 'CLOSED', label: 'Closed' },
  { id: 'DELETED', label: 'Deleted' },
];

export function TicketsToolbar({
  filters,
  onFiltersChange,
  onSearch,
  panels,
  authorInfo,
  onClearAuthorFilter,
}: TicketsToolbarProps) {
  const selectedPanelCount = filters.panelIds.length;

  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const tabLabelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [underlineStyle, setUnderlineStyle] = useState({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const activeIndex = queuePresets.findIndex((preset) => preset.id === filters.status);
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
  }, [filters.status]);

  const handlePresetChange = (status: TicketStatus) => {
    onFiltersChange({
      ...filters,
      status,
    });
  };

  const handleAllPanelsChange = () => {
    onFiltersChange({
      ...filters,
      panelIds: [],
    });
  };

  const handlePanelToggle = (panelId: number, checked: boolean) => {
    const nextPanelIds = checked
      ? [...filters.panelIds, panelId]
      : filters.panelIds.filter((id) => id !== panelId);

    onFiltersChange({
      ...filters,
      panelIds: nextPanelIds,
    });
  };

  return (
    <div className="space-y-4">
      <div ref={tabsContainerRef} className="relative flex items-center gap-6 overflow-x-auto pb-0.5">
        {queuePresets.map((preset, index) => {
          const isActive = filters.status === preset.id;

          return (
            <button
              key={preset.id}
              onClick={() => handlePresetChange(preset.id)}
              className={cn(
                'flex items-center gap-1.5 py-2 text-sm font-medium transition-colors',
                isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <span ref={(el) => { tabLabelRefs.current[index] = el; }}>
                {preset.label}
              </span>
            </button>
          );
        })}
        <span className="absolute bottom-0 left-0 right-0 h-px bg-border" />
        <span
          className="absolute bottom-0 z-10 h-0.5 rounded-full bg-brand-accent-solid transition-all duration-300 ease-out"
          style={{
            left: underlineStyle.left,
            width: underlineStyle.width,
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1 md:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by ticket, Discord ID, or username..."
            value={filters.query}
            onChange={(event) => onSearch(event.target.value)}
            className="h-9 bg-background pl-9 pr-9"
          />
        </div>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {authorInfo ? (
            <Badge tone="info" kind="meta" emphasis="soft" className="gap-1.5">
              <span className="truncate max-w-[180px]">
                Owner: @{authorInfo.name}
              </span>
              <button
                type="button"
                onClick={onClearAuthorFilter}
                className="rounded-full p-0.5 hover:bg-black/5 dark:hover:bg-white/10"
                aria-label="Clear author filter"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ) : null}

          {/* Panel Filter Dropdown */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5">
                <LayoutGrid className="h-3.5 w-3.5" />
                Panels
                {selectedPanelCount > 0 && (
                  <span className="ml-1 rounded bg-brand-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-brand-accent-text">
                    {selectedPanelCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuCheckboxItem
                checked={filters.panelIds.length === 0}
                onSelect={(event) => event.preventDefault()}
                onCheckedChange={handleAllPanelsChange}
                className="[&>span]:data-[state=checked]:bg-brand-accent-solid [&>span]:data-[state=checked]:text-brand-accent-contrast"
              >
                All Panels
              </DropdownMenuCheckboxItem>
              {panels.map(panel => (
                <DropdownMenuCheckboxItem
                  key={panel.id}
                  checked={filters.panelIds.includes(panel.id)}
                  onSelect={(event) => event.preventDefault()}
                  onCheckedChange={(checked) => handlePanelToggle(panel.id, Boolean(checked))}
                  className="[&>span]:data-[state=checked]:bg-brand-accent-solid [&>span]:data-[state=checked]:text-brand-accent-contrast"
                >
                  {panel.title}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
