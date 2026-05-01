'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/avatar';
import { getTicketStatusDescriptor } from '@/lib/status-system';
import { formatRelativeTime } from '@/lib/utils';
import { ColumnDef } from '@tanstack/react-table';
import { ArrowUpDown } from 'lucide-react';
import Link from 'next/link';

export type TicketQueueState = 'stale' | 'waiting_staff' | 'waiting_user' | 'recent';
export type TicketWaitingOn = 'staff' | 'user' | 'none';

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
  panel: {
    id: number;
    title: string;
  } | null;
  author: {
    id: string;
    name: string;
    displayName: string | null;
    displayAvatar: string | null;
  } | null;
  searchMatchedByParticipant?: boolean;
  // Queue metadata — server-derived, present on all ticket list rows
  lastMessageAt?: string | null;
  lastStaffReplyAt?: string | null;
  lastOwnerMessageAt?: string | null;
  waitingOn?: TicketWaitingOn;
  isStale?: boolean;
  queueState?: TicketQueueState;
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
    cell: (info) => {
      const ticket = info.row.original;
      const meta = info.table.options.meta as {
        getTicketHref?: (ticketId: number) => string;
      } | undefined;
      const ticketHref = meta?.getTicketHref?.(ticket.id) ?? `/tickets/${ticket.id}`;

      return (
        <div className="space-y-1 min-w-[220px]">
          <Link 
            href={ticketHref}
            className="font-medium text-foreground transition-colors hover:text-brand-accent-text"
          >
            #{ticket.sequence !== null ? ticket.sequence : ticket.id}
          </Link>
          {ticket.channel ? (
            <div className="text-xs text-muted-foreground">
              #{ticket.channel.name}
            </div>
          ) : null}
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
          className="flex min-w-[220px] items-center gap-3 cursor-pointer"
          onClick={(e) => meta?.onUserClick?.(e, author.id)}
          onMouseEnter={() => meta?.onUserHover?.(author.id)}
        >
          <UserAvatar
            src={author.displayAvatar}
            name={author.displayName || author.name}
            size="md"
            className="border border-border"
          />
          <div className="min-w-0 space-y-1">
            <div className="truncate text-sm font-medium text-foreground">
              {author.displayName || author.name}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {author.displayName && author.name && author.displayName !== author.name ? (
                <span>@{author.name}</span>
              ) : null}
              {row.original.searchMatchedByParticipant ? <span>Matched via participant activity</span> : null}
            </div>
          </div>
        </div>
      );
    },
  },
  {
    id: 'status',
    accessorKey: 'status',
    header: 'Ticket State',
    cell: ({ row }) => {
      const status = row.original.status;
      const descriptor = getTicketStatusDescriptor(status);
      
      return (
        <Badge tone={descriptor.tone} kind={descriptor.kind} emphasis={descriptor.emphasis}>
          {descriptor.label}
        </Badge>
      );
    },
  },
  {
    id: 'queue',
    header: 'Queue',
    cell: ({ row }) => {
      const ticket = row.original;
      const { queueState, lastOwnerMessageAt, lastStaffReplyAt, lastMessageAt, createdAt } = ticket;

      // Badge only rendered for actionable open-ticket queue states
      let badge: React.ReactNode = null;
      if (queueState === 'stale') {
        badge = <Badge tone="danger" kind="status" emphasis="soft">Stale</Badge>;
      } else if (queueState === 'waiting_staff') {
        badge = <Badge tone="warning" kind="status" emphasis="soft">Waiting on Staff</Badge>;
      } else if (queueState === 'waiting_user') {
        badge = <Badge tone="info" kind="status" emphasis="soft">Waiting on User</Badge>;
      }

      // Timing line — most operationally relevant timestamp for the queue state
      let timingLabel: string | null = null;
      if (queueState === 'stale' || queueState === 'waiting_staff') {
        if (lastOwnerMessageAt) {
          timingLabel = `User msg ${formatRelativeTime(lastOwnerMessageAt)}`;
        } else {
          timingLabel = `Opened ${formatRelativeTime(createdAt)}`;
        }
      } else if (queueState === 'waiting_user') {
        if (lastStaffReplyAt) {
          timingLabel = `Staff replied ${formatRelativeTime(lastStaffReplyAt)}`;
        }
      } else if (lastMessageAt) {
        timingLabel = `Active ${formatRelativeTime(lastMessageAt)}`;
      }

      if (!badge && !timingLabel) return null;

      return (
        <div className="min-w-40 space-y-1">
          {badge}
          {timingLabel ? (
            <div className="text-xs text-muted-foreground">{timingLabel}</div>
          ) : null}
        </div>
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
];
