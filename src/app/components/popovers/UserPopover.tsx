'use client';

import { useState } from 'react';
import Link from 'next/link';
import { UserAvatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getTicketStatusDescriptor, getUserAttributeStatusDescriptor } from '@/lib/status-system';
import { Check, Copy, ExternalLink, ShieldCheck, ShieldX } from 'lucide-react';
import { roleColorToHex } from '../utils';
import { PopoverWrapper, Position } from './PopoverWrapper';

export type UserPopoverData = {
  id: string;
  name: string;
  displayName: string | null;
  displayAvatar: string | null;
};

type UserRole = {
  id: string;
  name: string;
  color: number;
  position: number;
};

type RecentTicket = {
  id: number;
  sequence: number | null;
  status: string | null;
  createdAt: string;
};

type PopoverData = {
  user: {
    id: string;
    name: string;
    displayName: string | null;
    displayAvatar: string | null;
    nick: string | null;
    inGuild: boolean | null;
    isVerified: boolean | null;
    isVoiceVerified: boolean | null;
  };
  roles: UserRole[];
  ticketStats: {
    open: number;
    closed: number;
  };
  recentTickets: RecentTicket[];
};

type UserPopoverProps = {
  isOpen: boolean;
  onClose: () => void;
  triggerElement: HTMLElement | null;
  triggerRect: Position | null;
  userData: UserPopoverData;
  popoverData: PopoverData;
};

export function UserPopover({ isOpen, onClose, triggerElement, triggerRect, userData, popoverData }: UserPopoverProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const userRoles = popoverData.roles || [];
  const ticketStats = popoverData.ticketStats;
  const recentTickets = popoverData.recentTickets || [];
  const userDetails = popoverData.user;

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(text);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <PopoverWrapper
      isOpen={isOpen}
      onClose={onClose}
      triggerElement={triggerElement}
      triggerRect={triggerRect}
      title="User"
      dependencies={[userRoles.length, recentTickets.length]}
    >
      <div className="flex items-start gap-3 border-b border-border pb-4">
        <UserAvatar
          src={userData.displayAvatar}
          name={userData.displayName || userData.name}
          size="xl"
          className="border border-border"
        />
        <div className="flex-1 min-w-0">
          <p className="truncate text-base font-semibold text-foreground">
            {userData.displayName || userData.name}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            @{userData.name}
          </p>
          {userDetails && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {userDetails.inGuild ? (
                <Badge tone="success" kind="attribute" emphasis="soft" className="gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  In Server
                </Badge>
              ) : (
                <Badge
                  tone={getUserAttributeStatusDescriptor('left-server').tone}
                  kind={getUserAttributeStatusDescriptor('left-server').kind}
                  emphasis={getUserAttributeStatusDescriptor('left-server').emphasis}
                  className="gap-1"
                >
                  <ShieldX className="h-3 w-3" />
                  {getUserAttributeStatusDescriptor('left-server').label}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>
      
      <div>
        <label className="text-xs font-medium text-muted-foreground">User ID</label>
        <div className="flex items-center gap-2 mt-1">
          <p className="flex-1 rounded-md bg-muted px-2 py-1 font-mono text-xs text-foreground">
            {userData.id}
          </p>
          <Button
            type="button"
            onClick={() => copyToClipboard(userData.id)}
            variant="ghost"
            size="icon-xs"
            className="shrink-0 rounded-full text-muted-foreground hover:text-foreground"
            title="Copy ID"
          >
            {copiedId === userData.id ? (
              <Check className="h-3.5 w-3.5 text-status-success-text" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
      
      {/* Roles Section */}
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          Roles
        </label>
        {userRoles.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {userRoles.map(role => (
              <div
                key={role.id}
                className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium"
                style={{
                  backgroundColor: `${role.color === 0 ? '#99AAB5' : roleColorToHex(role.color)}18`,
                  borderColor: `${role.color === 0 ? '#99AAB5' : roleColorToHex(role.color)}3a`,
                  color: role.color === 0 ? '#99AAB5' : roleColorToHex(role.color),
                }}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: role.color === 0 ? '#99AAB5' : roleColorToHex(role.color) }}
                />
                <span>{role.name}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-2 text-xs text-muted-foreground">No roles</div>
        )}
      </div>
      
      {/* Tickets Section */}
      <div className="border-t border-border pt-4">
        <label className="text-xs font-medium text-muted-foreground">
          Support Tickets
        </label>
        {ticketStats ? (
          <>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-border bg-muted/40 p-3">
                <div className="text-2xl font-semibold text-foreground">
                  {ticketStats.open}
                </div>
                <div className="mt-1">
                  <Badge tone="neutral" kind="status" emphasis="soft">Open</Badge>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-muted/40 p-3">
                <div className="text-2xl font-semibold text-foreground">
                  {ticketStats.closed}
                </div>
                <div className="mt-1">
                  <Badge tone="neutral" kind="status" emphasis="soft">Closed</Badge>
                </div>
              </div>
            </div>
            
            {recentTickets.length > 0 && (
              <div className="mt-4 space-y-1.5">
                <div className="text-xs font-medium text-muted-foreground">
                  Recent Tickets
                </div>
                {recentTickets.map(ticket => (
                  <Link
                    key={ticket.id}
                    href={`/tickets/${ticket.id}`}
                    className="group block rounded-xl border border-transparent px-2 py-2 transition-colors hover:border-border hover:bg-muted/50"
                    onClick={onClose}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-brand-accent-text group-hover:underline">
                          #{ticket.sequence !== null ? ticket.sequence : ticket.id}
                        </span>
                        <Badge
                          tone={getTicketStatusDescriptor(ticket.status).tone}
                          kind={getTicketStatusDescriptor(ticket.status).kind}
                          emphasis={getTicketStatusDescriptor(ticket.status).emphasis}
                        >
                          {getTicketStatusDescriptor(ticket.status).label}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(ticket.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            
            {(ticketStats.open > 0 || ticketStats.closed > 0) && (
              <Button asChild className="mt-4 w-full justify-center">
                <Link href={`/tickets?author=${userData.id}`} onClick={onClose}>
                  View All Tickets
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </>
        ) : (
          <div className="mt-2 text-xs text-muted-foreground">No tickets found</div>
        )}
      </div>
    </PopoverWrapper>
  );
}
