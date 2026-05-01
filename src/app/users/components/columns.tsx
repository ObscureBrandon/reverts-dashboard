'use client';

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { StaffListItem } from '@/lib/hooks/queries/useStaffTable';
import { UserListItem } from '@/lib/hooks/queries/useUsersTable';
import {
  formatStatusLabel,
  getAssignmentStatusDescriptor,
  getUserAttributeStatusDescriptor,
} from '@/lib/status-system';
import { formatRelativeTime, getErrorMessage, roleColorToHex } from '@/lib/utils';
import { AlertTriangle, ArrowUpDown, ChevronRight, Clock3, Loader2, Ticket, UserPlus, UserX } from 'lucide-react';
import { useClaimAssignment } from '@/lib/hooks/mutations/useAssignmentMutations';
import { toast } from 'sonner';
import { getUserAttentionSignals } from './workspace-signals';
import { Column, ColumnDef } from '@tanstack/react-table';

// ============================================================================
// Assignment Cell
// ============================================================================

function AssignmentCell({ row }: { row: { original: UserListItem } }) {
  const status = row.original.currentAssignmentStatus;
  const reason = row.original.currentAssignmentReason;
  const activeSupervisorCount = row.original.activeSupervisorCount;
  const supervisorName = row.original.supervisorDisplayName || row.original.supervisorName;
  const supervisorAvatar = row.original.supervisorAvatar;
  const relation = row.original.relationToIslam;
  const isRevertLike = !!relation && (
    relation.toLowerCase().includes('revert') || relation.toLowerCase().includes('convert')
  );

  const claimAssignment = useClaimAssignment();

  function handleClaim(e: React.MouseEvent) {
    e.stopPropagation();
    const displayName = row.original.displayName || row.original.name || 'Unknown User';
    claimAssignment.mutate(row.original.id, {
      onSuccess: () => toast.success('Assignment claimed', { description: displayName, duration: 4000 }),
      onError: (error) => toast.error('Failed to claim assignment', { description: getErrorMessage(error, 'Unknown error') }),
    });
  }

  return (
    <div className="space-y-1">
      {status ? (
        <Badge
          tone={getAssignmentStatusDescriptor(status).tone}
          kind={getAssignmentStatusDescriptor(status).kind}
          emphasis={getAssignmentStatusDescriptor(status).emphasis}
        >
          {getAssignmentStatusDescriptor(status).label}
        </Badge>
      ) : null}
      {reason && (
        <p className="text-xs text-muted-foreground">{formatStatusLabel(reason)}</p>
      )}
      {supervisorName ? (
        <div className="flex items-center gap-2 text-xs text-foreground">
          <UserAvatar src={supervisorAvatar} name={supervisorName} />
          <div className="min-w-0">
            <p className="truncate font-medium">{supervisorName}</p>
            <p className="text-muted-foreground">Assigned supervisor</p>
          </div>
        </div>
      ) : activeSupervisorCount > 0 ? (
        <p className="text-xs text-muted-foreground">
          {activeSupervisorCount} active supervisor{activeSupervisorCount === 1 ? '' : 's'}
        </p>
      ) : (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">No supervisor assigned</p>
          {isRevertLike && (
            <button
              onClick={handleClaim}
              disabled={claimAssignment.isPending}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-0.5 rounded hover:bg-muted border border-transparent hover:border-border bg-transparent whitespace-nowrap disabled:opacity-50 transition-colors"
            >
              {claimAssignment.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <UserPlus className="h-3 w-3" />
              )}
              Assign to me
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Helper to get initials from name
function getInitials(name: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function UserAvatar({ 
  src, 
  name 
}: { 
  src: string | null; 
  name: string | null;
}) {
  return (
    <Avatar className="h-9 w-9 border border-border">
      <AvatarImage src={src || undefined} alt={name || 'User'} />
      <AvatarFallback className="text-xs font-medium bg-muted">
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

function getAttentionSignalIcon(signalKey: string) {
  switch (signalKey) {
    case 'active-risk':
      return <AlertTriangle className="h-3 w-3" />;
    case 'open-tickets':
      return <Ticket className="h-3 w-3" />;
    case 'left-server':
      return <UserX className="h-3 w-3" />;
    case 'needs-assignment':
      return <UserPlus className="h-3 w-3" />;
    default:
      return <Clock3 className="h-3 w-3" />;
  }
}

// Sortable header component
interface SortableHeaderProps {
  column: Column<UserListItem, unknown>;
  children: React.ReactNode;
}

function SortableHeader({ column, children }: SortableHeaderProps) {
  return (
    <button
      className="flex items-center gap-1 hover:text-foreground transition-colors -ml-2 px-2 py-1 rounded-md hover:bg-muted/50"
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
    >
      {children}
      <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
    </button>
  );
}

export const columns: ColumnDef<UserListItem>[] = [
  {
    id: 'user',
    accessorFn: (row) => row.displayName || row.name,
    header: ({ column }) => <SortableHeader column={column}>User</SortableHeader>,
    cell: ({ row }) => {
      const user = row.original;
      const displayName = user.displayName || user.name || 'Unknown';
      
      return (
        <div className="flex items-center gap-3 group min-w-[260px]">
          <UserAvatar 
            src={user.displayAvatar} 
            name={displayName} 
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="truncate font-medium text-foreground transition-colors group-hover:text-brand-accent-text">
                {displayName}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {user.displayName && user.name && user.displayName !== user.name && (
                <span className="text-xs text-muted-foreground truncate">
                  @{user.name}
                </span>
              )}
              {user.activeTags.slice(0, 2).map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-medium leading-none whitespace-nowrap"
                  style={{
                    backgroundColor: `${tag.color}22`,
                    color: tag.color,
                    border: `1px solid ${tag.color}44`,
                  }}
                >
                  {tag.emoji && <span>{tag.emoji}</span>}
                  {tag.name}
                </span>
              ))}
              {user.activeTags.length > 2 && (
                <span className="text-xs text-muted-foreground">+{user.activeTags.length - 2}</span>
              )}
            </div>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: 'relationToIslam',
    header: 'Relation',
    cell: ({ row }) => {
      const relation = row.original.relationToIslam;
      if (!relation) return <span className="text-muted-foreground text-sm">—</span>;
      
      // Highlight reverts with accent
      const isRevert = relation.toLowerCase().includes('revert') || 
                       relation.toLowerCase().includes('convert');
      
      return (
        <Badge tone="neutral" kind="meta" emphasis="outline">
          {isRevert ? getUserAttributeStatusDescriptor('revert').label : formatStatusLabel(relation)}
        </Badge>
      );
    },
  },
  {
    id: 'attention',
    header: 'Attention',
    cell: ({ row }) => {
      const user = row.original;
      const wsSignals = getUserAttentionSignals(user);

      // Prepend needs-assignment as a first-class signal if set by the backend
      const allSignals = [
        ...(user.needsAssignment ? [{
          key: 'needs-assignment' as const,
          label: 'Needs Assignment',
          tone: 'danger' as const,
          kind: 'status' as const,
          emphasis: 'soft' as const,
        }] : []),
        ...wsSignals,
      ];

      const primarySignal = allSignals[0];
      const secondarySignals = allSignals.slice(1, 3);
      const overflowCount = Math.max(allSignals.length - 3, 0);

      if (!primarySignal) {
        return <span className="text-muted-foreground">—</span>;
      }

      return (
        <div className="min-w-[220px] space-y-1.5">
          <Badge tone={primarySignal.tone} kind={primarySignal.kind} emphasis={primarySignal.emphasis} className="gap-1.5">
            {getAttentionSignalIcon(primarySignal.key)}
            {primarySignal.label}
          </Badge>
          <div className="flex flex-wrap items-center gap-1.5">
            {secondarySignals.map((signal) => (
              <Badge
                key={signal.key}
                tone={signal.tone}
                kind={signal.kind}
                emphasis={signal.emphasis}
                className="gap-1.5"
              >
                {getAttentionSignalIcon(signal.key)}
                {signal.label}
              </Badge>
            ))}
            {overflowCount > 0 && (
              <Badge tone="neutral" kind="meta" emphasis="outline">
                +{overflowCount}
              </Badge>
            )}
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: 'currentAssignmentStatus',
    header: 'Support State',
    cell: ({ row }) => <AssignmentCell row={row} />,
  },
  {
    accessorKey: 'topRoles',
    header: 'Roles',
    cell: ({ row }) => {
      const roles = row.original.topRoles;
      if (!roles || roles.length === 0) {
        return <span className="text-muted-foreground text-sm">—</span>;
      }
      
      return (
        <div className="flex items-center gap-1 flex-nowrap overflow-hidden max-w-[200px]">
          {roles.slice(0, 2).map(role => (
            <span
              key={role.id}
              className="inline-flex items-center text-xs px-1.5 py-0.5 rounded font-medium whitespace-nowrap"
              style={{
                backgroundColor: `${roleColorToHex(role.color)}15`,
                color: roleColorToHex(role.color),
                border: `1px solid ${roleColorToHex(role.color)}30`,
              }}
            >
              {role.name}
            </span>
          ))}
          {roles.length > 2 && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              +{roles.length - 2}
            </span>
          )}
        </div>
      );
    },
  },
  {
    id: 'createdAt',
    accessorKey: 'createdAt',
    header: ({ column }) => <SortableHeader column={column}>Joined</SortableHeader>,
    cell: ({ row }) => {
      const date = row.original.createdAt;
      const fullDate = new Date(date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-sm text-muted-foreground whitespace-nowrap cursor-default">
              {formatRelativeTime(date)}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {fullDate}
          </TooltipContent>
        </Tooltip>
      );
    },
  },
];

// Column visibility defaults for different views
// Note: 'staff' view uses completely separate staffColumns defined below
export const viewColumnDefaults: Record<string, string[]> = {
  all: ['user', 'relationToIslam', 'currentAssignmentStatus', 'attention', 'createdAt'],
};

// Staff-specific columns for Staff Overview view
export const staffColumns: ColumnDef<StaffListItem>[] = [
  {
    id: 'user',
    accessorFn: (row) => row.displayName || row.name,
    header: 'Staff Member',
    cell: ({ row }) => {
      const staff = row.original;
      const displayName = staff.displayName || staff.name || 'Unknown';
      
      return (
        <div className="flex items-center gap-3 group">
          <Avatar className="h-9 w-9 border border-border">
            <AvatarImage src={staff.displayAvatar || undefined} alt={displayName} />
            <AvatarFallback className="text-xs font-medium bg-muted">
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-medium text-foreground group-hover:text-brand-accent-text transition-colors truncate">
                {displayName}
              </span>
              <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            {staff.displayName && staff.name && staff.displayName !== staff.name && (
              <span className="text-xs text-muted-foreground truncate">
                @{staff.name}
              </span>
            )}
          </div>
        </div>
      );
    },
  },
  {
    id: 'superviseeCount',
    accessorKey: 'superviseeCount',
    header: 'Load',
    cell: ({ row }) => {
      const count = row.original.superviseeCount;
      return (
        <div className="space-y-1">
          <Badge tone={count > 0 ? 'info' : 'neutral'} kind="status" emphasis={count > 0 ? 'soft' : 'outline'} className="min-w-[24px] h-6 px-2 text-sm">
            {count}
          </Badge>
          <span className="text-xs text-muted-foreground">{count === 1 ? 'person assigned' : 'people assigned'}</span>
        </div>
      );
    },
  },
  {
    id: 'supervisees',
    accessorKey: 'supervisees',
    header: 'Supervisees',
    cell: ({ row }) => {
      const supervisees = row.original.supervisees;
      if (!supervisees || supervisees.length === 0) {
        return <span className="text-muted-foreground text-sm">—</span>;
      }
      
      const displayCount = 3;
      const displayed = supervisees.slice(0, displayCount);
      const remaining = supervisees.length - displayCount;
      
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 text-sm cursor-default">
              <span className="text-muted-foreground truncate max-w-[200px]">
                {displayed.map(s => s.displayName || s.name || 'Unknown').join(', ')}
              </span>
              {remaining > 0 && (
                <span className="text-muted-foreground whitespace-nowrap">
                  +{remaining} more
                </span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[300px]">
            <div className="space-y-1">
              {supervisees.map(s => (
                <div key={s.id} className="text-sm">
                  {s.displayName || s.name || 'Unknown'}
                </div>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      );
    },
  },
  {
    accessorKey: 'topRoles',
    header: 'Roles',
    cell: ({ row }) => {
      const roles = row.original.topRoles;
      if (!roles || roles.length === 0) {
        return <span className="text-muted-foreground text-sm">—</span>;
      }
      
      
      return (
        <div className="flex items-center gap-1 flex-nowrap overflow-hidden max-w-[200px]">
          {roles.slice(0, 2).map(role => (
            <span
              key={role.id}
              className="inline-flex items-center text-xs px-1.5 py-0.5 rounded font-medium whitespace-nowrap"
              style={{
                backgroundColor: `${roleColorToHex(role.color)}15`,
                color: roleColorToHex(role.color),
                border: `1px solid ${roleColorToHex(role.color)}30`,
              }}
            >
              {role.name}
            </span>
          ))}
          {roles.length > 2 && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              +{roles.length - 2}
            </span>
          )}
        </div>
      );
    },
  },
];
