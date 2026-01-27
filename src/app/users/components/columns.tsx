'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { UserListItem } from '@/lib/hooks/queries/useUsersTable';
import { ColumnDef } from '@tanstack/react-table';
import { ArrowUpDown, Mic, ShieldCheck, UserX } from 'lucide-react';
import Link from 'next/link';

// Helper to format relative time
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
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

// Helper to convert Discord role color to CSS
function roleColorToHex(color: number): string {
  if (color === 0) return '#99AAB5'; // Default gray for no color
  return `#${color.toString(16).padStart(6, '0')}`;
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
        <Link 
          href={`/users/${user.id}`}
          className="flex items-center gap-3 group"
        >
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
        </Link>
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
export const viewColumnDefaults: Record<string, string[]> = {
  all: ['user', 'relationToIslam', 'status', 'currentAssignmentStatus', 'topRoles', 'createdAt'],
  priority: ['user', 'currentAssignmentStatus', 'status', 'createdAt'],
  newThisWeek: ['user', 'relationToIslam', 'topRoles', 'createdAt'],
};
