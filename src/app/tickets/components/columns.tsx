'use client';

import { Avatar } from '@/app/components/Avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ColumnDef } from '@tanstack/react-table';
import { ArrowUpDown, ChevronDown, Loader2 } from 'lucide-react';
import Link from 'next/link';

export type TicketListItem = {
  id: number;
  sequence: number | null;
  status: string | null;
  messageCount: number;
  createdAt: string;
  closedAt: string | null;
  channel: {
    id: string;
    name: string;
  } | null;
  author: {
    id: string;
    name: string;
    displayName: string | null;
    displayAvatar: string | null;
  } | null;
};

// Column definitions for tickets table
export const ticketColumns: ColumnDef<TicketListItem>[] = [
  {
    id: 'ticket',
    accessorKey: 'sequence',
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8 hover:bg-transparent"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Ticket
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const ticket = row.original;
      return (
        <div>
          <Link 
            href={`/tickets/${ticket.id}`}
            className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-medium"
          >
            #{ticket.sequence !== null ? ticket.sequence : ticket.id}
          </Link>
          {ticket.channel && (
            <div className="text-xs text-muted-foreground mt-0.5">
              #{ticket.channel.name}
            </div>
          )}
        </div>
      );
    },
  },
  {
    id: 'author',
    accessorKey: 'author',
    header: 'Author',
    cell: ({ row, table }) => {
      const author = row.original.author;
      const meta = table.options.meta as { 
        onUserClick?: (e: React.MouseEvent, userId: string) => void;
        onUserHover?: (userId: string) => void;
      } | undefined;
      
      if (!author) {
        return <span className="text-sm text-muted-foreground">Unknown</span>;
      }

      return (
        <div 
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={(e) => meta?.onUserClick?.(e, author.id)}
          onMouseEnter={() => meta?.onUserHover?.(author.id)}
        >
          <Avatar 
            src={author.displayAvatar}
            name={author.displayName || author.name}
            size={32}
          />
          <div>
            <div className="text-sm font-medium text-foreground">
              {author.displayName || author.name}
            </div>
            {author.displayName && author.name && author.displayName !== author.name && (
              <div className="text-xs text-muted-foreground">
                @{author.name}
              </div>
            )}
          </div>
        </div>
      );
    },
  },
  {
    id: 'status',
    accessorKey: 'status',
    header: ({ table }) => {
      const meta = table.options.meta as { 
        statusFilter?: string;
        onStatusFilterChange?: (status: string) => void;
        pendingAction?: 'status' | 'panel' | 'page' | null;
      } | undefined;
      
      const currentFilter = meta?.statusFilter || 'all';
      const isStatusLoading = meta?.pendingAction === 'status';
      const statusOptions = [
        { value: 'all', label: 'All Statuses' },
        { value: 'OPEN', label: 'Open' },
        { value: 'CLOSED', label: 'Closed' },
        { value: 'DELETED', label: 'Deleted' },
      ];
      
      return (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="-ml-3 h-8 hover:bg-transparent gap-1"
            >
              Status
              {currentFilter !== 'all' && !isStatusLoading && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                  1
                </span>
              )}
              {isStatusLoading ? (
                <Loader2 className="ml-1 h-4 w-4 animate-spin text-emerald-600" />
              ) : (
                <ChevronDown className="ml-1 h-4 w-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            {statusOptions.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.value}
                checked={currentFilter === option.value}
                onCheckedChange={() => meta?.onStatusFilterChange?.(option.value)}
                className="[&>span]:data-[state=checked]:bg-emerald-600 [&>span]:data-[state=checked]:text-white"
              >
                {option.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
    cell: ({ row }) => {
      const status = row.original.status;
      
      const getStatusVariant = (status: string | null): 'default' | 'secondary' | 'destructive' => {
        switch (status) {
          case 'OPEN':
            return 'default';
          case 'CLOSED':
            return 'secondary';
          case 'DELETED':
            return 'destructive';
          default:
            return 'secondary';
        }
      };
      
      return (
        <Badge 
          variant={getStatusVariant(status)}
          className={status === 'OPEN' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' : ''}
        >
          {status || 'Unknown'}
        </Badge>
      );
    },
  },
  {
    id: 'messageCount',
    accessorKey: 'messageCount',
    header: ({ column }) => (
      <div className="flex justify-center w-full">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 hover:bg-transparent"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Messages
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-center -translate-x-3">
        <span className="text-sm text-foreground">{row.original.messageCount}</span>
      </div>
    ),
  },
  {
    id: 'createdAt',
    accessorKey: 'createdAt',
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8 hover:bg-transparent"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Created
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {new Date(row.original.createdAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </span>
    ),
  },
  {
    id: 'closedAt',
    accessorKey: 'closedAt',
    header: 'Closed',
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.closedAt 
          ? new Date(row.original.closedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : '-'
        }
      </span>
    ),
  },
];
