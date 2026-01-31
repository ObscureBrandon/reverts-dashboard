'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { StaffListItem } from '@/lib/hooks/queries/useStaffTable';
import { UserListItem } from '@/lib/hooks/queries/useUsersTable';
import { formatRelativeTime, roleColorToHex } from '@/lib/utils';
import { ColumnDef } from '@tanstack/react-table';
import { ArrowUpDown, Mic, ShieldCheck, UserX } from 'lucide-react';

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

// Status dot component for compact visual indicators
function StatusDot({ status }: { status: string | null }) {
  const config: Record<string, { color: string; label: string }> = {
    'NEEDS_SUPPORT': { color: 'bg-red-500', label: 'Needs Support' },
    'INACTIVE': { color: 'bg-gray-400', label: 'Inactive' },
    'SELF_SUFFICIENT': { color: 'bg-emerald-500', label: 'Self-Sufficient' },
    'PAUSED': { color: 'bg-amber-500', label: 'Paused' },
    'NOT_READY': { color: 'bg-amber-400', label: 'Not Ready' },
  };
  
  if (!status) return null;
  
  const { color, label } = config[status] || { color: 'bg-gray-400', label: status };
  
  return (
    <div className="flex items-center gap-1.5" title={label}>
      <span className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

// Avatar with status ring
function UserAvatar({ 
  src, 
  name, 
  status 
}: { 
  src: string | null; 
  name: string | null;
  status: string | null;
}) {
  const ringColor: Record<string, string> = {
    'NEEDS_SUPPORT': 'ring-red-500',
    'INACTIVE': 'ring-gray-400',
    'SELF_SUFFICIENT': 'ring-emerald-500',
    'PAUSED': 'ring-amber-500',
    'NOT_READY': 'ring-amber-400',
  };
  
  const ring = status ? ringColor[status] : '';
  
  return (
    <Avatar className={`h-9 w-9 ${ring ? `ring-2 ${ring}` : 'border border-border'}`}>
      <AvatarImage src={src || undefined} alt={name || 'User'} />
      <AvatarFallback className="text-xs font-medium bg-muted">
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

// Sortable header component
interface SortableHeaderProps {
  column: any;
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
        <div className="flex items-center gap-3 group">
          <UserAvatar 
            src={user.displayAvatar} 
            name={displayName} 
            status={user.currentAssignmentStatus}
          />
          <div className="flex flex-col min-w-0">
            <span className="font-medium text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
              {displayName}
            </span>
            {user.displayName && user.name && user.displayName !== user.name && (
              <span className="text-xs text-muted-foreground truncate">
                @{user.name}
              </span>
            )}
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
        <span className={`text-sm capitalize ${isRevert ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}`}>
          {relation.toLowerCase().replace(/_/g, ' ')}
        </span>
      );
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const user = row.original;
      
      return (
        <div className="flex items-center gap-1.5">
          {user.isVerified && (
            <span 
              className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950" 
              title="Verified"
            >
              <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            </span>
          )}
          {user.isVoiceVerified && (
            <span 
              className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950" 
              title="Voice Verified"
            >
              <Mic className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            </span>
          )}
          {!user.inGuild && (
            <span 
              className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 dark:bg-red-950" 
              title="Left Server"
            >
              <UserX className="w-3 h-3 text-red-600 dark:text-red-400" />
            </span>
          )}
          {user.inGuild && !user.isVerified && !user.isVoiceVerified && (
            <span className="text-muted-foreground text-sm">—</span>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: 'currentAssignmentStatus',
    header: 'Assignment',
    cell: ({ row }) => {
      const status = row.original.currentAssignmentStatus;
      return <StatusDot status={status} />;
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
  all: ['user', 'relationToIslam', 'status', 'currentAssignmentStatus', 'topRoles', 'createdAt'],
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
            <span className="font-medium text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
              {displayName}
            </span>
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
    header: 'Supporting',
    cell: ({ row }) => {
      const count = row.original.superviseeCount;
      return (
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 text-sm font-medium">
            {count}
          </span>
          <span className="text-muted-foreground text-sm">
            {count === 1 ? 'person' : 'people'}
          </span>
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
