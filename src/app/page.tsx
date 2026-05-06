'use client';

import { NavigationHeader } from '@/app/components/navigation-header';
import { PageHeader } from '@/app/components/page-header';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSession } from '@/lib/auth-client';
import { useUserPanel } from '@/lib/contexts/user-panel-context';
import {
  useDashboard,
  type DashboardClaimableRevert,
  type DashboardRevert,
  type DashboardShahadaRevert,
  type DashboardTicket,
} from '@/lib/hooks/queries/useDashboard';
import { useUserRole } from '@/lib/hooks/queries/useUserRole';
import {
  AlertTriangle,
  Calendar,
  ChevronDown,
  CheckCircle2,
  CircleHelp,
  ClipboardCheck,
  Clock,
  ExternalLink,
  Heart,
  ListFilter,
  Loader2,
  MessageSquare,
  Phone,
  Ticket,
  UserPlus,
  UserX,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAddCheckIn } from '@/lib/hooks/mutations/useAddCheckIn';
import { useClaimAssignment } from '@/lib/hooks/mutations/useAssignmentMutations';
import { useStartCheckInTicket } from '@/lib/hooks/mutations/useStartCheckInTicket';
import {
  getAssignmentStatusDescriptor,
  getTicketStatusDescriptor,
  getUserAttributeStatusDescriptor,
} from '@/lib/status-system';
import { cn, getErrorMessage } from '@/lib/utils';

const EMPTY_REVERTS: DashboardRevert[] = [];
const EMPTY_SHAHADA_REVERTS: DashboardShahadaRevert[] = [];
const EMPTY_CLAIMABLE_REVERTS: DashboardClaimableRevert[] = [];
const EMPTY_TICKETS: DashboardTicket[] = [];

// ============================================================================
// Helpers
// ============================================================================

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getFirstName(name: string | null | undefined): string {
  if (!name) return 'there';
  return name.split(' ')[0];
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function isOverdueCheckIn(lastCheckIn: string | null): boolean {
  if (!lastCheckIn) return true;
  return Date.now() - new Date(lastCheckIn).getTime() > 14 * 24 * 60 * 60 * 1000;
}

function getCheckInAgeDays(lastCheckIn: string | null): number {
  if (!lastCheckIn) return Number.MAX_SAFE_INTEGER;
  return Math.floor((Date.now() - new Date(lastCheckIn).getTime()) / (24 * 60 * 60 * 1000));
}

function formatRelative(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function isNewlyAssigned(assignedAt: string): boolean {
  return Date.now() - new Date(assignedAt).getTime() < 7 * 24 * 60 * 60 * 1000;
}

function openDiscordLink(discordUrl: string) {
  window.location.assign(discordUrl.replace(/^https:\/\//, 'discord://'));
}

function getTicketInlineLabel(outcome: string): string {
  return outcome === 'created' ? 'Ticket opened' : 'Already open';
}

function getTicketToastTitle(outcome: string): string {
  return outcome === 'created' ? 'Check-in ticket created' : 'Open check-in ticket found';
}

// ============================================================================
// Stat Card
// ============================================================================

interface StatCardProps {
  label: string;
  description: string;
  value: number | undefined;
  icon: React.ReactNode;
}

function StatCard({ label, description, value, icon }: StatCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 transition-colors">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-lg bg-muted">
          <span className="text-muted-foreground">
            {icon}
          </span>
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground font-medium leading-tight inline-flex items-center gap-1">
            <span>{label}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={`About ${label}`}
                  className="inline-flex items-center text-muted-foreground/70 hover:text-foreground transition-colors"
                >
                  <CircleHelp className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-44 text-xs text-center">
                {description}
              </TooltipContent>
            </Tooltip>
          </div>
          {value === undefined ? (
            <Skeleton className="h-7 w-10 mt-0.5" />
          ) : (
            <p className="text-2xl font-bold leading-tight text-foreground">
              {value}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Tag Badges
// ============================================================================

function TagBadges({ tags }: { tags: Array<{ id: number; name: string; color: string; emoji: string | null }> }) {
  if (!tags.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {tags.slice(0, 3).map(tag => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border"
          style={{
            backgroundColor: `${tag.color}18`,
            borderColor: `${tag.color}40`,
            color: tag.color,
          }}
        >
          {tag.emoji && <span className="leading-none">{tag.emoji}</span>}
          {tag.name}
        </span>
      ))}
      {tags.length > 3 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground border border-border cursor-default">
              +{tags.length - 3}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {tags.slice(3).map(t => t.name).join(', ')}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

// ============================================================================
// Assignment Status Badge
// ============================================================================

function StatusBadge({ status }: { status: string | null }) {
  const descriptor = getAssignmentStatusDescriptor(status);
  return (
    <Badge tone={descriptor.tone} kind={descriptor.kind} emphasis={descriptor.emphasis}>
      {descriptor.label}
    </Badge>
  );
}

// ============================================================================
// Ticket Status Badge
// ============================================================================

function TicketStatusBadge({ status }: { status: string | null }) {
  const descriptor = getTicketStatusDescriptor(status);
  return (
    <Badge tone={descriptor.tone} kind={descriptor.kind} emphasis={descriptor.emphasis}>
      {descriptor.label}
    </Badge>
  );
}

// ============================================================================
// Revert Row
// ============================================================================

type TicketActionState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'success'; discordUrl: string; outcome: string }
  | { status: 'error'; message: string };

function RevertRow({ revert, onClick, showCheckIn }: { revert: DashboardRevert; onClick: () => void; showCheckIn?: boolean }) {
  const overdue = isOverdueCheckIn(revert.lastCheckIn);
  const newlyAssigned = isNewlyAssigned(revert.assignedAt);
  const openCheckInTicketHref = revert.openCheckInTicketId ? `/tickets/${revert.openCheckInTicketId}` : null;
  const [formState, setFormState] = useState<'closed' | 'open' | 'success'>('closed');
  const [ticketState, setTicketState] = useState<TicketActionState>({ status: 'idle' });
  const startTicket = useStartCheckInTicket();
  const revertDisplayName = revert.displayName ?? revert.name ?? 'Unknown User';

  function handleSuccess() {
    setFormState('success');
    setTimeout(() => setFormState('closed'), 2000);
  }

  async function createTicket(toastId?: string | number) {
    setTicketState({ status: 'pending' });

    const activeToastId = toast.loading('Creating check-in ticket…', {
      id: toastId,
      description: revertDisplayName,
    });

    try {
      const data = await startTicket.mutateAsync({ userId: revert.id });

      setTicketState({ status: 'success', discordUrl: data.discordUrl, outcome: data.outcome });
      toast.success(getTicketToastTitle(data.outcome), {
        id: activeToastId,
        description: revertDisplayName,
        action: {
          label: <span className="flex items-center gap-1.5"><ExternalLink className="size-3" />Open in Discord</span>,
          onClick: () => {
            openDiscordLink(data.discordUrl);
            toast.dismiss(activeToastId);
          },
        },
      });
      window.setTimeout(() => setTicketState({ status: 'idle' }), 6000);
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to create check-in ticket');

      setTicketState({ status: 'error', message });
      toast.error('Failed to create ticket', {
        id: activeToastId,
        description: message,
        action: {
          label: 'Retry',
          onClick: () => {
            void createTicket(activeToastId);
          },
        },
      });
      window.setTimeout(() => setTicketState({ status: 'idle' }), 4000);
    }
  }

  function handleStartTicket(e: React.MouseEvent) {
    e.stopPropagation();
    void createTicket();
  }

  return (
    <div className="group border-b border-border last:border-b-0">
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer"
      >
        <Avatar className="h-8 w-8 shrink-0 border border-border">
          <AvatarImage src={revert.displayAvatar ?? undefined} />
          <AvatarFallback className="text-xs bg-muted">{getInitials(revert.displayName ?? revert.name)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-medium text-foreground truncate">
              {revert.displayName ?? revert.name ?? 'Unknown User'}
            </span>
            {!revert.inGuild && (
              <Badge
                tone={getUserAttributeStatusDescriptor('left-server').tone}
                kind={getUserAttributeStatusDescriptor('left-server').kind}
                emphasis={getUserAttributeStatusDescriptor('left-server').emphasis}
                className="shrink-0"
              >
                {getUserAttributeStatusDescriptor('left-server').label}
              </Badge>
            )}
            {newlyAssigned && (
              <Badge tone="info" kind="attribute" emphasis="soft" className="shrink-0">
                New
              </Badge>
            )}
            <StatusBadge status={revert.assignmentStatus} />
          </div>
          <TagBadges tags={revert.activeTags} />
        </div>
        <div className="shrink-0 flex items-center gap-2">
            {showCheckIn && formState === 'closed' && (
              <button
                onClick={e => { e.stopPropagation(); setFormState('open'); }}
                aria-label="Log check-in"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted border border-transparent hover:border-border bg-transparent"
              >
                <ClipboardCheck className="h-3 w-3" />
                <span className="hidden sm:inline">Log check-in</span>
              </button>
            )}
            {formState === 'success' && (
              <span className="flex items-center gap-1 text-xs font-medium text-status-success-text whitespace-nowrap">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Logged!
              </span>
            )}
            {showCheckIn && ticketState.status === 'idle' && openCheckInTicketHref && (
              <Link
                href={openCheckInTicketHref}
                onClick={e => e.stopPropagation()}
                aria-label="Jump to ticket"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted border border-transparent hover:border-border bg-transparent"
              >
                <ExternalLink className="h-3 w-3" />
                <span className="hidden sm:inline">Jump to ticket</span>
              </Link>
            )}
            {showCheckIn && ticketState.status === 'idle' && !openCheckInTicketHref && (
              <button
                onClick={handleStartTicket}
                aria-label="Create ticket"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted border border-transparent hover:border-border bg-transparent"
              >
                <Ticket className="h-3 w-3" />
                <span className="hidden sm:inline">Create ticket</span>
              </button>
            )}
            {ticketState.status === 'pending' && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                <Loader2 className="h-3 w-3 animate-spin" />
                Creating…
              </span>
            )}
            {ticketState.status === 'success' && (
              <span className="flex items-center gap-1 text-xs font-medium text-brand-accent-text whitespace-nowrap">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {getTicketInlineLabel(ticketState.outcome)}
              </span>
            )}
            {ticketState.status === 'error' && (
              <span className="rounded-md border border-destructive/20 bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive whitespace-nowrap">
                Failed to create
              </span>
            )}
          <div className={`text-xs flex items-center gap-1 ${overdue ? 'font-medium text-status-warning-text' : 'text-muted-foreground'}`}>
            <Clock className="h-3 w-3 shrink-0" />
            <span className="whitespace-nowrap">
              {revert.lastCheckIn ? formatRelative(revert.lastCheckIn) : 'No check-in'}
            </span>
          </div>
        </div>
      </div>
      {formState === 'open' && (
        <InlineCheckInForm
          userId={revert.id}
          onSuccess={handleSuccess}
          onCancel={() => setFormState('closed')}
        />
      )}
    </div>
  );
}

// ============================================================================
// Ticket Row
// ============================================================================

function TicketRow({ ticket }: { ticket: DashboardTicket }) {
  return (
    <Link
      href={`/tickets/${ticket.id}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border last:border-b-0"
    >
      <Avatar className="h-8 w-8 shrink-0 border border-border">
        <AvatarImage src={ticket.author.avatar ?? undefined} />
        <AvatarFallback className="text-xs bg-muted">{getInitials(ticket.author.name)}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-foreground truncate">
            {ticket.author.name ?? 'Unknown'}
          </span>
          {ticket.sequence != null && (
            <span className="text-xs text-muted-foreground shrink-0">#{ticket.sequence}</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {formatRelative(ticket.createdAt)}
          {ticket.lastStaffMessageAt && ` · Last reply ${formatRelative(ticket.lastStaffMessageAt)}`}
        </p>
        {ticket.lastOwnerMessageAt !== undefined && (
          <p className="text-xs mt-0.5 truncate text-status-warning-text">
            {ticket.lastOwnerMessageAt
              ? `User messaged ${formatRelative(ticket.lastOwnerMessageAt)}`
              : ticket.lastMessageAt
                ? `Last activity ${formatRelative(ticket.lastMessageAt)}`
                : `Open since ${formatRelative(ticket.createdAt)}`}
          </p>
        )}
      </div>
      <div className="shrink-0">
        <TicketStatusBadge status={ticket.status} />
      </div>
    </Link>
  );
}

// ============================================================================
// Section Card
// ============================================================================

function SectionCard({
  title,
  icon,
  count,
  action,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-lg border border-border bg-card">
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brand-accent-solid/30 via-brand-accent-solid to-brand-accent-solid/30" />
      <div className="flex min-h-11 items-center gap-2 border-b border-border bg-muted/30 px-4 py-3">
        <span className="text-muted-foreground">{icon}</span>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <div className="ml-auto flex items-center gap-2">
          {count !== undefined && (
            <Badge tone="neutral" kind="meta" emphasis="outline">
              {count}
            </Badge>
          )}
          {action}
        </div>
      </div>
      {children}
    </section>
  );
}

// ============================================================================
// Skeleton rows
// ============================================================================

function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full shrink-0" />
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Empty state
// ============================================================================

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-10 text-center">
      <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// ============================================================================
// Inline Check-in Form
// ============================================================================

const CHECK_IN_METHODS = [
  { value: 'Ticket', icon: <Ticket className="h-3.5 w-3.5" /> },
  { value: 'Voice Call', icon: <Phone className="h-3.5 w-3.5" /> },
  { value: 'DM', icon: <MessageSquare className="h-3.5 w-3.5" /> },
];

function InlineCheckInForm({
  userId,
  onSuccess,
  onCancel,
}: {
  userId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [method, setMethod] = useState('Ticket');
  const [summary, setSummary] = useState('');
  const { mutate, isPending } = useAddCheckIn();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutate(
      { userId, method, summary: summary.trim() || undefined },
      { onSuccess },
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      onClick={e => e.stopPropagation()}
      className="flex flex-wrap items-end gap-2 border-t border-border bg-muted/30 px-4 py-3"
    >
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          Method
        </label>
        <div className="flex gap-1">
          {CHECK_IN_METHODS.map(({ value, icon }) => (
            <button
              key={value}
              type="button"
              disabled={isPending}
              onClick={() => setMethod(value)}
              className={`flex items-center gap-1.5 px-2.5 h-8 rounded-full text-xs font-medium transition-colors border ${
                method === value
                  ? 'border-brand-accent-solid bg-brand-accent-solid text-brand-accent-contrast'
                  : 'bg-background border-border text-muted-foreground hover:bg-accent hover:text-foreground'
              } disabled:opacity-50`}
            >
              {icon}
              {value}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 min-w-0 sm:min-w-40 flex flex-col gap-1">
        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          Summary <span className="normal-case font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={summary}
          onChange={e => setSummary(e.target.value)}
          disabled={isPending}
          placeholder="Brief note…"
          className="h-8 text-sm border border-input rounded-md px-3 bg-transparent dark:bg-input/30 text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring disabled:opacity-50 transition-[color,box-shadow] shadow-xs"
        />
      </div>
      <div className="flex gap-1.5">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? 'Saving…' : 'Log'}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ============================================================================
// Sub-group header
// ============================================================================

type RevertSort = 'alphabetical' | 'needs-check-in' | 'recently-assigned';
type ShahadaSort = 'alphabetical' | 'recent-shahada' | 'oldest-shahada';

function RevertListControls({
  sortBy,
  onSortChange,
  availableTags,
  selectedTagIds,
  onToggleTag,
  onClearTags,
}: {
  sortBy: RevertSort;
  onSortChange: (sortBy: RevertSort) => void;
  availableTags: Array<{ id: number; name: string; color: string; emoji: string | null }>;
  selectedTagIds: number[];
  onToggleTag: (tagId: number) => void;
  onClearTags: () => void;
}) {
  const isFiltered = selectedTagIds.length > 0;
  const sortLabels: Record<RevertSort, string> = {
    alphabetical: 'A–Z',
    'needs-check-in': 'Needs check-in',
    'recently-assigned': 'Recently assigned',
  };

  return (
    <>
      <div className="inline-flex h-7 items-center rounded-md border border-border bg-muted/60 text-xs font-medium text-foreground transition-colors hover:bg-muted">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="flex h-full items-center outline-none">
              <span className="pl-2.5 text-muted-foreground">Sort</span>
              <span className="mx-1.5 h-3.5 w-px bg-border" />
              <span className="truncate text-brand-accent-text">{sortLabels[sortBy]}</span>
              <ChevronDown className="mx-1.5 h-3 w-3 shrink-0 opacity-50" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuRadioGroup value={sortBy} onValueChange={(v) => onSortChange(v as RevertSort)}>
              <DropdownMenuRadioItem value="alphabetical" className="data-[state=checked]:[&_svg]:text-brand-accent-solid">A–Z</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="needs-check-in" className="data-[state=checked]:[&_svg]:text-brand-accent-solid">Needs check-in</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="recently-assigned" className="data-[state=checked]:[&_svg]:text-brand-accent-solid">Recently assigned</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="h-3.5 w-px bg-border/70" />

      <div
        className={cn(
          'inline-flex h-7 items-center rounded-md border text-xs font-medium transition-colors',
          isFiltered
            ? 'border-border bg-muted/60 text-foreground hover:bg-muted'
            : 'border-border bg-transparent text-muted-foreground hover:border-foreground/30 hover:text-foreground'
        )}
      >
        {isFiltered && (
          <button
            type="button"
            onClick={onClearTags}
            className="flex h-full items-center pl-2 pr-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="flex h-full items-center outline-none">
              {isFiltered ? (
                <>
                  <span className="pl-1 text-muted-foreground">Tags</span>
                  <span className="mx-1.5 h-3.5 w-px bg-border" />
                  <span className="text-brand-accent-text">
                    {selectedTagIds.length === 1 ? '1 tag' : `${selectedTagIds.length} tags`}
                  </span>
                  <ChevronDown className="mx-1.5 h-3 w-3 shrink-0 opacity-50" />
                </>
              ) : (
                <span className="flex items-center gap-1.5 px-2.5">
                  <ListFilter className="h-3 w-3 opacity-50" />
                  Tags
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Filter by tags</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {availableTags.length === 0 ? (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">No tags available</div>
            ) : (
              availableTags.map(tag => (
                <DropdownMenuCheckboxItem
                  key={tag.id}
                  checked={selectedTagIds.includes(tag.id)}
                  onSelect={e => e.preventDefault()}
                  onCheckedChange={() => onToggleTag(tag.id)}
                >
                  <span
                    className="inline-flex h-2.5 w-2.5 rounded-full border border-border/60"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.emoji && <span>{tag.emoji}</span>}
                  <span className="truncate">{tag.name}</span>
                </DropdownMenuCheckboxItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}

function ShahadaListControls({
  sortBy,
  onSortChange,
  availableTags,
  selectedTagIds,
  onToggleTag,
  onClearTags,
}: {
  sortBy: ShahadaSort;
  onSortChange: (sortBy: ShahadaSort) => void;
  availableTags: Array<{ id: number; name: string; color: string; emoji: string | null }>;
  selectedTagIds: number[];
  onToggleTag: (tagId: number) => void;
  onClearTags: () => void;
}) {
  const isFiltered = selectedTagIds.length > 0;
  const sortLabels: Record<ShahadaSort, string> = {
    alphabetical: 'A–Z',
    'recent-shahada': 'Recent shahada',
    'oldest-shahada': 'Oldest shahada',
  };

  return (
    <>
      <div className="inline-flex h-7 items-center rounded-md border border-border bg-muted/60 text-xs font-medium text-foreground transition-colors hover:bg-muted">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="flex h-full items-center outline-none">
              <span className="pl-2.5 text-muted-foreground">Sort</span>
              <span className="mx-1.5 h-3.5 w-px bg-border" />
              <span className="truncate text-brand-accent-text">{sortLabels[sortBy]}</span>
              <ChevronDown className="mx-1.5 h-3 w-3 shrink-0 opacity-50" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuRadioGroup value={sortBy} onValueChange={(v) => onSortChange(v as ShahadaSort)}>
              <DropdownMenuRadioItem value="alphabetical" className="data-[state=checked]:[&_svg]:text-brand-accent-solid">A–Z</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="recent-shahada" className="data-[state=checked]:[&_svg]:text-brand-accent-solid">Recent shahada</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="oldest-shahada" className="data-[state=checked]:[&_svg]:text-brand-accent-solid">Oldest shahada</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="h-3.5 w-px bg-border/70" />

      <div
        className={cn(
          'inline-flex h-7 items-center rounded-md border text-xs font-medium transition-colors',
          isFiltered
            ? 'border-border bg-muted/60 text-foreground hover:bg-muted'
            : 'border-border bg-transparent text-muted-foreground hover:border-foreground/30 hover:text-foreground'
        )}
      >
        {isFiltered && (
          <button
            type="button"
            onClick={onClearTags}
            className="flex h-full items-center pl-2 pr-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="flex h-full items-center outline-none">
              {isFiltered ? (
                <>
                  <span className="pl-1 text-muted-foreground">Tags</span>
                  <span className="mx-1.5 h-3.5 w-px bg-border" />
                  <span className="text-brand-accent-text">
                    {selectedTagIds.length === 1 ? '1 tag' : `${selectedTagIds.length} tags`}
                  </span>
                  <ChevronDown className="mx-1.5 h-3 w-3 shrink-0 opacity-50" />
                </>
              ) : (
                <span className="flex items-center gap-1.5 px-2.5">
                  <ListFilter className="h-3 w-3 opacity-50" />
                  Tags
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Filter by tags</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {availableTags.length === 0 ? (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">No tags available</div>
            ) : (
              availableTags.map(tag => (
                <DropdownMenuCheckboxItem
                  key={tag.id}
                  checked={selectedTagIds.includes(tag.id)}
                  onSelect={e => e.preventDefault()}
                  onCheckedChange={() => onToggleTag(tag.id)}
                >
                  <span
                    className="inline-flex h-2.5 w-2.5 rounded-full border border-border/60"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.emoji && <span>{tag.emoji}</span>}
                  <span className="truncate">{tag.name}</span>
                </DropdownMenuCheckboxItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}

function ShahadaRow({ revert, onClick }: { revert: DashboardShahadaRevert; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left border-b border-border last:border-b-0"
    >
      <Avatar className="h-8 w-8 shrink-0 border border-border">
        <AvatarImage src={revert.displayAvatar ?? undefined} />
        <AvatarFallback className="text-xs bg-muted">{getInitials(revert.displayName ?? revert.name)}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium text-foreground truncate">
            {revert.displayName ?? revert.name ?? 'Unknown User'}
          </span>
          {!revert.inGuild && (
            <Badge
              tone={getUserAttributeStatusDescriptor('left-server').tone}
              kind={getUserAttributeStatusDescriptor('left-server').kind}
              emphasis={getUserAttributeStatusDescriptor('left-server').emphasis}
              className="shrink-0"
            >
              {getUserAttributeStatusDescriptor('left-server').label}
            </Badge>
          )}
          {revert.assignee ? (
            <Badge tone="neutral" kind="meta" emphasis="outline" className="shrink-0 gap-1.5">
              <Avatar className="h-3.5 w-3.5 border border-border">
                <AvatarImage src={revert.assignee.avatar ?? undefined} />
                <AvatarFallback className="text-[8px] bg-background">
                  {getInitials(revert.assignee.name)}
                </AvatarFallback>
              </Avatar>
              <span className="max-w-24 truncate">{revert.assignee.name ?? 'Unknown'}</span>
              {revert.activeAssigneeCount > 1 && (
                <span className="text-muted-foreground">+{revert.activeAssigneeCount - 1}</span>
              )}
            </Badge>
          ) : (
            <Badge tone="neutral" kind="meta" emphasis="outline" className="shrink-0">
              Unassigned
            </Badge>
          )}
        </div>
        <TagBadges tags={revert.activeTags} />
      </div>
      <div className="shrink-0 text-right text-xs text-muted-foreground">
        {revert.shahadaAt ? `Shahada ${formatRelative(revert.shahadaAt)}` : 'Shahada date unknown'}
      </div>
    </button>
  );
}

// ============================================================================
// Stale Tickets Card
// ============================================================================

function StaleTicketsCard({ tickets, count, isLoading }: { tickets: DashboardTicket[]; count: number | undefined; isLoading: boolean }) {
  const hasStale = !isLoading && count !== undefined && count > 0;
  const overflowCount = count !== undefined && count > tickets.length ? count - tickets.length : 0;
  return (
    <SectionCard
      title="Stale Tickets"
      icon={<Clock className="h-4 w-4" />}
      count={isLoading ? undefined : count}
      action={
        hasStale ? (
          <Link
            href="/tickets?queue=stale"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            View queue →
          </Link>
        ) : undefined
      }
    >
      {isLoading ? (
        <SkeletonRows count={5} />
      ) : hasStale ? (
        <>
          {tickets.map(t => <TicketRow key={t.id} ticket={t} />)}
          {overflowCount > 0 && (
            <Link
              href="/tickets?queue=stale"
              className="flex items-center justify-center gap-1.5 px-4 py-3 text-xs text-muted-foreground hover:text-foreground transition-colors border-t border-border"
            >
              <ExternalLink className="h-3 w-3" />
              {overflowCount} more stale ticket{overflowCount !== 1 ? 's' : ''} in queue
            </Link>
          )}
        </>
      ) : (
        <EmptyState message="No stale tickets right now." />
      )}
    </SectionCard>
  );
}

// ============================================================================
// Loading skeleton
// ============================================================================

// ============================================================================
// Claimable Revert Row
// ============================================================================

function ClaimableRevertRow({ revert, onClick }: { revert: DashboardClaimableRevert; onClick: () => void }) {
  const claimAssignment = useClaimAssignment();
  const displayName = revert.displayName ?? revert.name ?? 'Unknown User';
  const overdue = isOverdueCheckIn(revert.lastCheckIn);

  function handleClaim(e: React.MouseEvent) {
    e.stopPropagation();
    claimAssignment.mutate(revert.id, {
      onSuccess: () => toast.success('Assignment claimed', { description: displayName, duration: 4000 }),
      onError: (error) => toast.error('Failed to claim assignment', { description: getErrorMessage(error, 'Unknown error') }),
    });
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer border-b border-border last:border-b-0"
    >
      <Avatar className="h-8 w-8 shrink-0 border border-border">
        <AvatarImage src={revert.displayAvatar ?? undefined} />
        <AvatarFallback className="text-xs bg-muted">{getInitials(revert.displayName ?? revert.name)}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium text-foreground truncate">{displayName}</span>
          {!revert.inGuild && (
            <Badge
              tone={getUserAttributeStatusDescriptor('left-server').tone}
              kind={getUserAttributeStatusDescriptor('left-server').kind}
              emphasis={getUserAttributeStatusDescriptor('left-server').emphasis}
              className="shrink-0"
            >
              <UserX className="h-3 w-3" />
              {getUserAttributeStatusDescriptor('left-server').label}
            </Badge>
          )}
          <StatusBadge status={revert.assignmentStatus} />
        </div>
        <TagBadges tags={revert.activeTags} />
      </div>
      <div className="shrink-0 flex items-center gap-2">
        <div className={`text-xs flex items-center gap-1 ${overdue ? 'font-medium text-status-warning-text' : 'text-muted-foreground'}`}>
          <Clock className="h-3 w-3 shrink-0" />
          <span className="whitespace-nowrap">
            {revert.lastCheckIn ? formatRelative(revert.lastCheckIn) : 'No check-in'}
          </span>
        </div>
        <button
          onClick={handleClaim}
          disabled={claimAssignment.isPending}
          aria-label="Assign to me"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted border border-transparent hover:border-border bg-transparent disabled:opacity-50"
        >
          {claimAssignment.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <UserPlus className="h-3 w-3" />
          )}
          <span className="hidden sm:inline">Assign to me</span>
        </button>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <NavigationHeader />
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                <div className="space-y-1.5 min-w-0">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-7 w-10" />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="grid lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3">
            <div className="relative overflow-hidden rounded-lg border border-border bg-card">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brand-accent-solid/30 via-brand-accent-solid to-brand-accent-solid/30" />
              <div className="px-4 py-3 border-b border-border bg-muted/30">
                <Skeleton className="h-4 w-40" />
              </div>
              <SkeletonRows count={5} />
            </div>
          </div>
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="relative overflow-hidden rounded-lg border border-border bg-card">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brand-accent-solid/30 via-brand-accent-solid to-brand-accent-solid/30" />
              <div className="px-4 py-3 border-b border-border bg-muted/30">
                <Skeleton className="h-4 w-36" />
              </div>
              <SkeletonRows count={5} />
            </div>
            <div className="relative overflow-hidden rounded-lg border border-border bg-card">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brand-accent-solid/30 via-brand-accent-solid to-brand-accent-solid/30" />
              <div className="px-4 py-3 border-b border-border bg-muted/30">
                <Skeleton className="h-4 w-28" />
              </div>
              <SkeletonRows count={5} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ============================================================================
// Main Dashboard Page
// ============================================================================

export default function Home() {
  const { canAccessDashboard, isLoading: roleLoading } = useUserRole();
  const { data: session } = useSession();
  const { data, isLoading } = useDashboard();
  const { openUserPanel } = useUserPanel();
  const router = useRouter();
  const [activeScope, setActiveScope] = useState<'assigned' | 'needs-assignment' | 'shahada'>('assigned');
  const [sortBy, setSortBy] = useState<RevertSort>('needs-check-in');
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [shahadaSortBy, setShahadaSortBy] = useState<ShahadaSort>('recent-shahada');
  const [selectedShahadaTagIds, setSelectedShahadaTagIds] = useState<number[]>([]);

  useEffect(() => {
    if (!roleLoading && !canAccessDashboard) {
      router.replace('/my-tickets');
    }
  }, [canAccessDashboard, roleLoading, router]);

  const stats = data?.stats;
  const assignedReverts = data?.assignedReverts ?? EMPTY_REVERTS;
  const shahadaWithMe = data?.shahadaWithMe ?? EMPTY_SHAHADA_REVERTS;
  const claimableReverts = data?.claimableReverts ?? EMPTY_CLAIMABLE_REVERTS;
  const recentTickets = data?.recentTickets ?? EMPTY_TICKETS;
  const staleTicketCount = data?.staleTicketCount;
  const staleTickets = data?.staleTickets ?? EMPTY_TICKETS;

  const availableTags = useMemo(() => {
    const unique = new Map<number, { id: number; name: string; color: string; emoji: string | null }>();
    for (const revert of assignedReverts) {
      for (const tag of revert.activeTags) {
        if (!unique.has(tag.id)) {
          unique.set(tag.id, {
            id: tag.id,
            name: tag.name,
            color: tag.color,
            emoji: tag.emoji,
          });
        }
      }
    }
    return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [assignedReverts]);

  const filteredAndSortedReverts = useMemo(() => {
    const filtered = selectedTagIds.length
      ? assignedReverts.filter(revert => revert.activeTags.some(tag => selectedTagIds.includes(tag.id)))
      : assignedReverts;

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sortBy === 'needs-check-in') {
        const ageDiff = getCheckInAgeDays(b.lastCheckIn) - getCheckInAgeDays(a.lastCheckIn);
        if (ageDiff !== 0) return ageDiff;
        return (a.displayName ?? a.name ?? '').localeCompare(b.displayName ?? b.name ?? '');
      }

      if (sortBy === 'recently-assigned') {
        const assignedDiff = new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime();
        if (assignedDiff !== 0) return assignedDiff;
        return (a.displayName ?? a.name ?? '').localeCompare(b.displayName ?? b.name ?? '');
      }

      return (a.displayName ?? a.name ?? '').localeCompare(b.displayName ?? b.name ?? '');
    });

    return sorted;
  }, [assignedReverts, selectedTagIds, sortBy]);

  const availableShahadaTags = useMemo(() => {
    const unique = new Map<number, { id: number; name: string; color: string; emoji: string | null }>();
    for (const revert of shahadaWithMe) {
      for (const tag of revert.activeTags) {
        if (!unique.has(tag.id)) {
          unique.set(tag.id, {
            id: tag.id,
            name: tag.name,
            color: tag.color,
            emoji: tag.emoji,
          });
        }
      }
    }
    return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [shahadaWithMe]);

  const filteredAndSortedShahadas = useMemo(() => {
    const filtered = selectedShahadaTagIds.length
      ? shahadaWithMe.filter(revert => revert.activeTags.some(tag => selectedShahadaTagIds.includes(tag.id)))
      : shahadaWithMe;

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (shahadaSortBy === 'recent-shahada') {
        const timeA = a.shahadaAt ? new Date(a.shahadaAt).getTime() : 0;
        const timeB = b.shahadaAt ? new Date(b.shahadaAt).getTime() : 0;
        if (timeA !== timeB) return timeB - timeA;
      }

      if (shahadaSortBy === 'oldest-shahada') {
        const timeA = a.shahadaAt ? new Date(a.shahadaAt).getTime() : Number.MAX_SAFE_INTEGER;
        const timeB = b.shahadaAt ? new Date(b.shahadaAt).getTime() : Number.MAX_SAFE_INTEGER;
        if (timeA !== timeB) return timeA - timeB;
      }

      return (a.displayName ?? a.name ?? '').localeCompare(b.displayName ?? b.name ?? '');
    });

    return sorted;
  }, [selectedShahadaTagIds, shahadaSortBy, shahadaWithMe]);

  function toggleTagFilter(tagId: number) {
    setSelectedTagIds(current => (
      current.includes(tagId)
        ? current.filter(id => id !== tagId)
        : [...current, tagId]
    ));
  }

  function toggleShahadaTagFilter(tagId: number) {
    setSelectedShahadaTagIds(current => (
      current.includes(tagId)
        ? current.filter(id => id !== tagId)
        : [...current, tagId]
    ));
  }

  if (roleLoading || !canAccessDashboard) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      <NavigationHeader />

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <PageHeader
          title="Home"
          utility={
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-foreground">
                {getGreeting()}, {getFirstName(session?.user?.name)}.
              </p>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(new Date())}
              </p>
            </div>
          }
        />

        {/* ── Stats Row ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard
            label="Assigned Reverts"
            description="Users currently assigned to you."
            value={stats?.totalReverts}
            icon={<Users className="h-4 w-4" />}
          />
          <StatCard
            label="Open Support"
            description="Assigned users currently in the open support state."
            value={stats?.needsSupport}
            icon={<AlertTriangle className="h-4 w-4" />}
          />
          <StatCard
            label="Overdue Check-ins"
            description="Assigned users with no check-in in 14+ days, or no check-in yet."
            value={stats?.overdueCheckIns}
            icon={<Clock className="h-4 w-4" />}
          />
          <StatCard
            label="My Active Tickets"
            description="Open tickets where you have sent at least one message."
            value={stats?.openTickets}
            icon={<Ticket className="h-4 w-4" />}
          />
          <StatCard
            label="Shahadas"
            description="Users who took the shahada with you."
            value={stats?.shahadaCount}
            icon={<Heart className="h-4 w-4" />}
          />
        </div>

        {/* ── Body ────────────────────────────────────────────────── */}
        <div className="grid lg:grid-cols-5 gap-4">

          {/* Left column — My Assigned Reverts */}
          <div className="lg:col-span-3 min-w-0">

            <SectionCard
              title="My Reverts"
              icon={<Users className="h-4 w-4" />}
              count={isLoading ? undefined : (
                activeScope === 'assigned' ? filteredAndSortedReverts.length :
                activeScope === 'needs-assignment' ? claimableReverts.length :
                filteredAndSortedShahadas.length
              )}
              action={
                !isLoading && (
                  activeScope === 'assigned' ? filteredAndSortedReverts.length > 0 :
                  activeScope === 'needs-assignment' ? claimableReverts.length > 0 :
                  filteredAndSortedShahadas.length > 0
                ) ? (
                  <Link
                    href={
                      activeScope === 'assigned' ? '/users?filters=assigned-to-me' :
                      activeScope === 'needs-assignment' ? '/users?filters=needs-assignment' :
                      '/users?filters=has-shahada'
                    }
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    View all →
                  </Link>
                ) : undefined
              }
            >
              <Tabs value={activeScope} onValueChange={(v) => setActiveScope(v as 'assigned' | 'needs-assignment' | 'shahada')} className="gap-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-border bg-muted/20 pl-4 pr-2 pt-3 pb-2 overflow-x-auto">
                  <TabsList variant="line">
                    <TabsTrigger value="assigned" className="group-data-[variant=line]/tabs-list:data-[state=active]:after:bg-brand-accent-solid">
                      <span className="sm:hidden">Assigned</span>
                      <span className="hidden sm:inline">Assigned to me</span>
                    </TabsTrigger>
                    <TabsTrigger value="needs-assignment" className="group-data-[variant=line]/tabs-list:data-[state=active]:after:bg-brand-accent-solid">
                      <span className="sm:hidden">Unassigned</span>
                      <span className="hidden sm:inline">Needs assignment</span>
                    </TabsTrigger>
                    <TabsTrigger value="shahada" className="group-data-[variant=line]/tabs-list:data-[state=active]:after:bg-brand-accent-solid">
                      <span className="sm:hidden">Shahada</span>
                      <span className="hidden sm:inline">Shahada with me</span>
                    </TabsTrigger>
                  </TabsList>
                  {!isLoading && activeScope === 'assigned' && assignedReverts.length > 0 && (
                    <div className="sm:ml-auto flex items-center gap-1">
                      <RevertListControls
                        sortBy={sortBy}
                        onSortChange={setSortBy}
                        availableTags={availableTags}
                        selectedTagIds={selectedTagIds}
                        onToggleTag={toggleTagFilter}
                        onClearTags={() => setSelectedTagIds([])}
                      />
                    </div>
                  )}
                  {!isLoading && activeScope === 'shahada' && shahadaWithMe.length > 0 && (
                    <div className="sm:ml-auto flex items-center gap-1">
                      <ShahadaListControls
                        sortBy={shahadaSortBy}
                        onSortChange={setShahadaSortBy}
                        availableTags={availableShahadaTags}
                        selectedTagIds={selectedShahadaTagIds}
                        onToggleTag={toggleShahadaTagFilter}
                        onClearTags={() => setSelectedShahadaTagIds([])}
                      />
                    </div>
                  )}
                </div>

                <TabsContent value="assigned" className="mt-0">
                  {isLoading ? (
                    <SkeletonRows count={5} />
                  ) : assignedReverts.length === 0 ? (
                    <EmptyState message="You have no assigned reverts yet." />
                  ) : filteredAndSortedReverts.length === 0 ? (
                    <EmptyState message="No reverts match your selected tags." />
                  ) : (
                    filteredAndSortedReverts.map(r => (
                      <RevertRow
                        key={r.id}
                        revert={r}
                        onClick={() => openUserPanel(r.id)}
                        showCheckIn={isOverdueCheckIn(r.lastCheckIn)}
                      />
                    ))
                  )}
                </TabsContent>

                <TabsContent value="needs-assignment" className="mt-0">
                  {isLoading ? (
                    <SkeletonRows count={5} />
                  ) : (
                    <>
                      {claimableReverts.length === 0 ? (
                        <EmptyState message="No reverts need assignment right now." />
                      ) : (
                        claimableReverts.map(r => (
                          <ClaimableRevertRow key={r.id} revert={r} onClick={() => openUserPanel(r.id)} />
                        ))
                      )}
                      <div className="border-t border-border px-4 py-2.5 flex justify-center">
                        <Link
                          href="/users?filters=needs-assignment"
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                        >
                          View full queue
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </div>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="shahada" className="mt-0">
                  {isLoading ? (
                    <SkeletonRows count={5} />
                  ) : shahadaWithMe.length === 0 ? (
                    <EmptyState message="No reverts have taken shahada with you yet." />
                  ) : filteredAndSortedShahadas.length === 0 ? (
                    <EmptyState message="No shahada reverts match your selected tags." />
                  ) : (
                    filteredAndSortedShahadas.map(r => (
                      <ShahadaRow key={r.id} revert={r} onClick={() => openUserPanel(r.id)} />
                    ))
                  )}
                </TabsContent>
              </Tabs>
            </SectionCard>

          </div>

          {/* Right column — Recent Tickets + Stale Tickets */}
          <div className="lg:col-span-2 flex flex-col gap-4 min-w-0">

            <SectionCard
              title="My Recent Tickets"
              icon={<Ticket className="h-4 w-4" />}
              count={isLoading ? undefined : recentTickets.length}
            >
              {isLoading ? (
                <SkeletonRows count={5} />
              ) : recentTickets.length === 0 ? (
                <EmptyState message="No recent tickets." />
              ) : (
                recentTickets.map(t => <TicketRow key={t.id} ticket={t} />)
              )}
            </SectionCard>

            <StaleTicketsCard tickets={staleTickets} count={staleTicketCount} isLoading={isLoading} />

          </div>
        </div>

      </main>
    </div>
  );
}
