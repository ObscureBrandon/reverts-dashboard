'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAddCheckIn } from '@/lib/hooks/mutations/useAddCheckIn';
import { useClaimAssignment, useTransferAssignment, useUnassignUser, useUpdateSupportState } from '@/lib/hooks/mutations/useAssignmentMutations';
import { useStartCheckInTicket } from '@/lib/hooks/mutations/useStartCheckInTicket';
import { useAssignTag, useCreateTag, useRemoveTag } from '@/lib/hooks/mutations/useTagMutations';
import { useCheckIns } from '@/lib/hooks/queries/useCheckIns';
import { useAddSupervisorNote } from '@/lib/hooks/mutations/useSupervisorNoteMutations';
import { useRevertTags } from '@/lib/hooks/queries/useRevertTags';
import { type UserDetails } from '@/lib/hooks/queries/useUserDetails';
import { useUserTags } from '@/lib/hooks/queries/useUserTags';
import { useUserRole } from '@/lib/hooks/queries/useUserRole';
import {
  REVERT_TAG_CATEGORY_VALUES,
  SUPPORT_STATE_REASON_LABELS,
  SUPPORT_STATE_REASONS_BY_STATE,
  SUPPORT_STATE_VALUES,
  type RevertTagCategoryValue,
  type SupportStateReasonValue,
  type SupportStateValue,
} from '@/lib/revert-support';
import {
  formatStatusLabel,
  getAssignmentStatusDescriptor,
  getTicketStatusDescriptor,
  getUserAttributeStatusDescriptor,
} from '@/lib/status-system';
import { isRevertLikeRelation } from '@/lib/revert-status';
import { cn, formatRelativeTime, getErrorMessage, roleColorToHex } from '@/lib/utils';
import {
    AlertTriangle,
    ArrowLeftRight,
    Ban,
    Calendar,
    Check,
    ChevronDown,
    ChevronRight,
    Clock,
    Copy,
    ExternalLink,
    Globe,
    Heart,
    Loader2,
    Mars,
    MessageSquare,
    Mic,
    MicOff,
    Phone,
    Plus,
    Shield,
    ShieldAlert,
    ShieldCheck,
    Star,
    Tag,
    Ticket,
    Timer,
    User,
    UserMinus,
    UserPlus,
    UserX,
    Users,
    Venus,
    VolumeX,
    X,
} from 'lucide-react';
import { useCallback, useState } from 'react';
  import { toast } from 'sonner';
import { getCheckInAgeDays, isOverdueCheckIn } from './workspace-signals';

// ============================================================================
// Utility Functions
// ============================================================================

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
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
// Collapsible Section Component
// ============================================================================

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  children: React.ReactNode;
}

function CollapsibleSection({
  title,
  icon,
  defaultOpen = true,
  badge,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors min-h-11"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <span className="text-muted-foreground">{icon}</span>
          {title}
          {badge}
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// ============================================================================
// Status Badge Component
// ============================================================================

function AssignmentStatusBadge({ status }: { status: string }) {
  const descriptor = getAssignmentStatusDescriptor(status);

  return (
    <Badge tone={descriptor.tone} kind={descriptor.kind} emphasis={descriptor.emphasis}>
      {descriptor.label}
    </Badge>
  );
}

// ============================================================================
// Infraction Type Icon
// ============================================================================

function InfractionTypeIcon({ type }: { type: string }) {
  const icons: Record<string, React.ReactNode> = {
    NOTE: <MessageSquare className="h-3.5 w-3.5" />,
    WARNING: <AlertTriangle className="h-3.5 w-3.5" />,
    TIMEOUT: <Timer className="h-3.5 w-3.5" />,
    KICK: <UserMinus className="h-3.5 w-3.5" />,
    BAN: <Ban className="h-3.5 w-3.5" />,
    JAIL: <ShieldAlert className="h-3.5 w-3.5" />,
    VOICE_MUTE: <MicOff className="h-3.5 w-3.5" />,
    VOICE_BAN: <VolumeX className="h-3.5 w-3.5" />,
  };

  return icons[type] || <AlertTriangle className="h-3.5 w-3.5" />;
}

// ============================================================================
// Mini Avatar Component
// ============================================================================

function MiniAvatar({ src, name }: { src?: string | null; name?: string | null }) {
  return (
    <Avatar className="h-5 w-5 border border-border">
      <AvatarImage src={src || undefined} />
      <AvatarFallback className="text-[10px] bg-muted">{getInitials(name)}</AvatarFallback>
    </Avatar>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function UserDetailsSkeleton({ isMobile = false }: { isMobile?: boolean }) {
  if (isMobile) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="sticky top-0 z-10 border-b border-border bg-background p-4">
            <div className="flex items-start gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="mt-1 h-4 w-24" />
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              </div>
            </div>
          </div>

          <div className="border-b border-border bg-muted/20 px-3 py-3">
            <div className="space-y-2.5">
              <div className="rounded-xl border border-primary/15 bg-primary/5 px-3 py-2.5">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="mt-2 h-4 w-40" />
                <Skeleton className="mt-1 h-4 w-full" />
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="rounded-lg border border-border bg-background px-2.5 py-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="mt-1 h-4 w-full" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            {['Profile', 'Roles', 'Revert Journey', 'Supervisor Notes', 'Moderation', 'Tickets'].map((section, i) => (
              <div key={i} className="border-b border-border last:border-b-0">
                <div className="flex min-h-11 w-full items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="h-4 w-4" />
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-border bg-muted/30 p-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-40" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Header skeleton - matches UserHeader structure */}
      <div className="p-4 border-b border-border sticky top-0 bg-background z-10">
        <div className="flex items-start gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="flex-1 min-w-0">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24 mt-1" />
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        {['Profile', 'Roles', 'Revert Journey', 'Supervisor Notes', 'Moderation', 'Tickets'].map((section, i) => (
          <div key={i} className="border-b border-border last:border-b-0">
            <div className="w-full flex items-center justify-between px-4 py-3 min-h-11">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-4 w-4" />
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
    </>
  );
}

// ============================================================================
// Supervision Actions Row
// ============================================================================

const ASSIGNMENT_STATUSES = SUPPORT_STATE_VALUES;
type AssignmentStatusChoice = SupportStateValue;

const REASONS_BY_STATE: Record<AssignmentStatusChoice, { value: SupportStateReasonValue; label: string }[]> = {
  OPEN: SUPPORT_STATE_REASONS_BY_STATE.OPEN.map((value) => ({ value, label: SUPPORT_STATE_REASON_LABELS[value] })),
  ON_HOLD: SUPPORT_STATE_REASONS_BY_STATE.ON_HOLD.map((value) => ({ value, label: SUPPORT_STATE_REASON_LABELS[value] })),
  CLOSED: SUPPORT_STATE_REASONS_BY_STATE.CLOSED.map((value) => ({ value, label: SUPPORT_STATE_REASON_LABELS[value] })),
};

function compareTagPresentation(
  left: { kind: 'system' | 'custom'; name: string },
  right: { kind: 'system' | 'custom'; name: string }
) {
  if (left.kind !== right.kind) {
    return left.kind === 'system' ? -1 : 1;
  }

  return left.name.localeCompare(right.name);
}

function SupervisionActionsRow({
  userId,
  isRevertLike,
  activeSupervisors,
}: {
  userId: string;
  isRevertLike: boolean;
  activeSupervisors: UserDetails['supervisors'];
}) {
  const { canPerformCrossStaffActions, discordId } = useUserRole();
  const claimAssignment = useClaimAssignment();
  const transferAssignment = useTransferAssignment();
  const unassignUser = useUnassignUser();
  const updateSupportState = useUpdateSupportState();

  const [showUnassignForm, setShowUnassignForm] = useState(false);
  const [unassignStatus, setUnassignStatus] = useState<AssignmentStatusChoice>('CLOSED');
  const [unassignReason, setUnassignReason] = useState<string | undefined>(undefined);
  const [unassignNote, setUnassignNote] = useState('');

  const [showStateForm, setShowStateForm] = useState(false);
  const [stateFormStatus, setStateFormStatus] = useState<AssignmentStatusChoice>('OPEN');
  const [stateFormReason, setStateFormReason] = useState<string | undefined>(undefined);

  if (!isRevertLike) return null;

  const activeSup = activeSupervisors.find(s => s.active) ?? null;
  const isAssigned = !!activeSup;
  const isAssignedToMe = activeSup?.supervisor?.id === discordId;
  const canManageAssignedUser = !isAssigned || isAssignedToMe || canPerformCrossStaffActions;
  const isPending = claimAssignment.isPending || transferAssignment.isPending || unassignUser.isPending || updateSupportState.isPending;

  function handleClaim() {
    claimAssignment.mutate(userId, {
      onSuccess: () => toast.success('Assignment claimed', { duration: 4000 }),
      onError: (e) => toast.error('Failed to claim assignment', { description: getErrorMessage(e, 'Unknown error') }),
    });
  }

  function handleTakeOver() {
    if (!discordId) return;
    transferAssignment.mutate({ userId, supervisorId: discordId }, {
      onSuccess: () => toast.success('Assignment transferred to you', { duration: 4000 }),
      onError: (e) => toast.error('Failed to transfer assignment', { description: getErrorMessage(e, 'Unknown error') }),
    });
  }

  function handleUpdateState() {
    updateSupportState.mutate(
      { userId, nextState: stateFormStatus, reason: stateFormReason },
      {
        onSuccess: () => {
          toast.success('Support state updated', { duration: 4000 });
          setShowStateForm(false);
          setStateFormReason(undefined);
        },
        onError: (e) => toast.error('Failed to update state', { description: getErrorMessage(e, 'Unknown error') }),
      },
    );
  }

  function handleUnassign() {
    unassignUser.mutate(
      { userId, nextState: unassignStatus, reason: unassignReason, note: unassignNote.trim() || undefined },
      {
        onSuccess: () => {
          toast.success('User unassigned', { duration: 4000 });
          setShowUnassignForm(false);
          setUnassignNote('');
          setUnassignReason(undefined);
        },
        onError: (e) => toast.error('Failed to unassign', { description: getErrorMessage(e, 'Unknown error') }),
      },
    );
  }

  return (
    <div className="border-b border-border bg-muted/20 px-4 py-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        {!isAssigned && (
          <Button size="sm" variant="outline" onClick={handleClaim} disabled={isPending}>
            {claimAssignment.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
            Assign to me
          </Button>
        )}
        {isAssigned && (isAssignedToMe || canPerformCrossStaffActions) && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowUnassignForm(v => !v)}
            disabled={isPending}
          >
            <UserMinus className="h-3.5 w-3.5" />
            Unassign
          </Button>
        )}
        {isAssigned && canManageAssignedUser && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowStateForm(v => !v)}
            disabled={isPending}
          >
            Change state
          </Button>
        )}
        {isAssigned && !isAssignedToMe && canPerformCrossStaffActions && (
          <Button size="sm" variant="outline" onClick={handleTakeOver} disabled={isPending}>
            {transferAssignment.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowLeftRight className="h-3.5 w-3.5" />}
            Take over
          </Button>
        )}
      </div>

      {showUnassignForm && (
        <div className="rounded-lg border border-border bg-background p-3 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Select next support state</p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {ASSIGNMENT_STATUSES.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => { setUnassignStatus(s); setUnassignReason(undefined); }}
                className={cn(
                  'text-xs px-2 py-1.5 rounded border transition-colors',
                  unassignStatus === s
                    ? 'border-primary/50 bg-primary/10 text-primary font-medium'
                    : 'border-border bg-muted text-muted-foreground hover:bg-muted/70',
                )}
              >
                {getAssignmentStatusDescriptor(s).label}
              </button>
            ))}
          </div>
          {REASONS_BY_STATE[unassignStatus].length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Reason (optional)</p>
              <div className="flex flex-wrap gap-1.5">
                {REASONS_BY_STATE[unassignStatus].map(r => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setUnassignReason(unassignReason === r.value ? undefined : r.value)}
                    className={cn(
                      'text-xs px-2 py-1 rounded border transition-colors',
                      unassignReason === r.value
                        ? 'border-primary/50 bg-primary/10 text-primary font-medium'
                        : 'border-border bg-muted text-muted-foreground hover:bg-muted/70',
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <textarea
            placeholder="Optional note…"
            value={unassignNote}
            onChange={e => setUnassignNote(e.target.value)}
            rows={2}
            className="w-full text-sm bg-muted rounded px-2.5 py-2 outline-none placeholder:text-muted-foreground resize-none"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleUnassign} disabled={unassignUser.isPending}>
              {unassignUser.isPending ? 'Unassigning…' : 'Confirm unassign'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setShowUnassignForm(false); setUnassignNote(''); setUnassignReason(undefined); }}
              disabled={unassignUser.isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {showStateForm && (
        <div className="rounded-lg border border-border bg-background p-3 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Update support state</p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {ASSIGNMENT_STATUSES.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => { setStateFormStatus(s); setStateFormReason(undefined); }}
                className={cn(
                  'text-xs px-2 py-1.5 rounded border transition-colors',
                  stateFormStatus === s
                    ? 'border-primary/50 bg-primary/10 text-primary font-medium'
                    : 'border-border bg-muted text-muted-foreground hover:bg-muted/70',
                )}
              >
                {getAssignmentStatusDescriptor(s).label}
              </button>
            ))}
          </div>
          {REASONS_BY_STATE[stateFormStatus].length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Reason (optional)</p>
              <div className="flex flex-wrap gap-1.5">
                {REASONS_BY_STATE[stateFormStatus].map(r => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setStateFormReason(stateFormReason === r.value ? undefined : r.value)}
                    className={cn(
                      'text-xs px-2 py-1 rounded border transition-colors',
                      stateFormReason === r.value
                        ? 'border-primary/50 bg-primary/10 text-primary font-medium'
                        : 'border-border bg-muted text-muted-foreground hover:bg-muted/70',
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleUpdateState} disabled={updateSupportState.isPending}>
              {updateSupportState.isPending ? 'Saving…' : 'Save'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setShowStateForm(false); setStateFormReason(undefined); }}
              disabled={updateSupportState.isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// User Header Component
// ============================================================================

interface UserHeaderProps {
  user: UserDetails['user'];
}

function UserHeader({ user }: UserHeaderProps) {
  const [copied, setCopied] = useState(false);
  
  const copyId = useCallback(() => {
    navigator.clipboard.writeText(user.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [user.id]);

  const displayName = user.displayName || user.name || 'Unknown';
  const relationIsRevert = isRevertLikeRelation(user.relationToIslam);

  return (
    <div className="p-4 border-b border-border sticky top-0 bg-background z-10">
      <div className="flex items-start gap-4">
        <Avatar className="h-16 w-16 border border-border">
          <AvatarImage src={user.displayAvatar || undefined} />
          <AvatarFallback className="text-lg font-medium bg-muted">
            {getInitials(displayName)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          {/* Name */}
          <h2 className="text-lg font-semibold text-foreground truncate">{displayName}</h2>
          
          {/* Username and ID */}
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {user.name && user.displayName !== user.name && (
              <span className="text-sm text-muted-foreground">@{user.name}</span>
            )}
            <button
              onClick={copyId}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              title="Copy Discord ID"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
              <span className="font-mono">{user.id}</span>
            </button>
          </div>

          {/* Status badges */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {!user.inGuild && (
              <Badge
                tone={getUserAttributeStatusDescriptor('left-server').tone}
                kind={getUserAttributeStatusDescriptor('left-server').kind}
                emphasis={getUserAttributeStatusDescriptor('left-server').emphasis}
                className="gap-1"
              >
                <UserX className="h-3 w-3" />
                {getUserAttributeStatusDescriptor('left-server').label}
              </Badge>
            )}
            {user.isVerified && (
              <Badge
                tone={getUserAttributeStatusDescriptor('verified').tone}
                kind={getUserAttributeStatusDescriptor('verified').kind}
                emphasis={getUserAttributeStatusDescriptor('verified').emphasis}
                className="gap-1"
              >
                <ShieldCheck className="h-3 w-3" />
                {getUserAttributeStatusDescriptor('verified').label}
              </Badge>
            )}
            {user.isVoiceVerified && (
              <Badge
                tone={getUserAttributeStatusDescriptor('voice').tone}
                kind={getUserAttributeStatusDescriptor('voice').kind}
                emphasis={getUserAttributeStatusDescriptor('voice').emphasis}
                className="gap-1"
              >
                <Mic className="h-3 w-3" />
                {getUserAttributeStatusDescriptor('voice').label}
              </Badge>
            )}
            {relationIsRevert && (
              <Badge
                tone={getUserAttributeStatusDescriptor('revert').tone}
                kind={getUserAttributeStatusDescriptor('revert').kind}
                emphasis={getUserAttributeStatusDescriptor('revert').emphasis}
                className="gap-1"
              >
                <Heart className="h-3 w-3" />
                {getUserAttributeStatusDescriptor('revert').label}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Profile Section
// ============================================================================

function ProfileSection({ user }: { user: UserDetails['user'] }) {
  const getGenderConfig = (gender: string | null) => {
    if (!gender) return null;
    const lowerGender = gender.toLowerCase();
    if (lowerGender === 'male' || lowerGender === 'm') {
      return {
        label: 'Male',
        icon: <Mars className="h-3 w-3" />,
      };
    }
    if (lowerGender === 'female' || lowerGender === 'f') {
      return {
        label: 'Female',
        icon: <Venus className="h-3 w-3" />,
      };
    }
    return {
      label: gender,
      icon: <User className="h-3 w-3" />,
    };
  };

  const genderConfig = getGenderConfig(user.gender);
  
  const pills = [
    user.age && { label: user.age, icon: <Calendar className="h-3 w-3" /> },
    user.region && { label: user.region, icon: <Globe className="h-3 w-3" /> },
  ].filter(Boolean) as { label: string; icon: React.ReactNode }[];

  const hasContent = genderConfig || pills.length > 0 || user.relationToIslam || user.religiousAffiliation || 
    user.referralSource || user.wantsDiscussion;

  if (!hasContent) {
    return (
      <p className="text-sm text-muted-foreground">No profile information available</p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Pills row */}
      {(genderConfig || pills.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {genderConfig && (
            <Badge tone="neutral" kind="meta" emphasis="outline" className="gap-1.5 px-2.5 py-1">
              {genderConfig.icon}
              {genderConfig.label}
            </Badge>
          )}
          {pills.map((pill, i) => (
            <Badge key={i} tone="neutral" kind="meta" emphasis="outline" className="gap-1.5 px-2.5 py-1">
              <span className="text-muted-foreground">{pill.icon}</span>
              {pill.label}
            </Badge>
          ))}
        </div>
      )}

      {/* Detail rows */}
      <dl className="grid gap-2 text-sm">
        {user.relationToIslam && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Relation to Islam</dt>
            <dd className="font-medium capitalize">{user.relationToIslam.toLowerCase().replace(/_/g, ' ')}</dd>
          </div>
        )}
        {user.religiousAffiliation && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Affiliation</dt>
            <dd className="font-medium">{user.religiousAffiliation}</dd>
          </div>
        )}
        {user.referralSource && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Referral Source</dt>
            <dd className="font-medium">{user.referralSource}</dd>
          </div>
        )}
        {user.wantsDiscussion && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Wants Discussion</dt>
            <dd className="font-medium">{user.wantsDiscussion}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

// ============================================================================
// Roles Section
// ============================================================================

function RolesSection({ roles }: { roles: UserDetails['roles'] }) {
  if (roles.length === 0) {
    return <p className="text-sm text-muted-foreground">No roles assigned</p>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {roles.map((role) => (
        <span
          key={role.id}
          className="inline-flex items-center text-xs px-2 py-1 rounded-full font-medium"
          style={{
            backgroundColor: `${roleColorToHex(role.color)}15`,
            color: roleColorToHex(role.color),
            border: `1px solid ${roleColorToHex(role.color)}30`,
          }}
        >
          {role.name}
        </span>
      ))}
    </div>
  );
}

// ============================================================================
// Revert Journey Section
// ============================================================================

function RevertJourneySection({
  shahadas,
  assignmentHistory,
  supervisors,
}: {
  shahadas: UserDetails['shahadas'];
  assignmentHistory: UserDetails['assignmentHistory'];
  supervisors: UserDetails['supervisors'];
}) {
  const activeSupervisors = supervisors.filter((s) => s.active);
  const hasShahada = shahadas.length > 0;

  return (
    <div className="space-y-4">
      {/* Shahada Record */}
      {hasShahada && (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <Heart className="h-4 w-4" />
            <span className="font-medium text-sm">Shahada Taken</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            {formatDate(shahadas[0].createdAt)}
            {shahadas[0].supervisor && (
              <>
                <span className="text-muted-foreground/50">•</span>
                <div className="flex items-center gap-1">
                  <MiniAvatar
                    src={shahadas[0].supervisor.avatar}
                    name={shahadas[0].supervisor.displayName || shahadas[0].supervisor.name}
                  />
                  <span>{shahadas[0].supervisor.displayName || shahadas[0].supervisor.name}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Active Supervisors */}
      {activeSupervisors.length > 0 && (
        <div className="space-y-2">
          <span className="text-sm font-medium">Assigned Supervisor{activeSupervisors.length > 1 ? 's' : ''}</span>
          <div className="flex flex-wrap gap-2">
            {activeSupervisors.map((sup) => (
              <div key={sup.id} className="flex items-center gap-2 text-sm">
                <MiniAvatar
                  src={sup.supervisor?.avatar}
                  name={sup.supervisor?.displayName || sup.supervisor?.name}
                />
                <span>{sup.supervisor?.displayName || sup.supervisor?.name || 'Unknown'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assignment History */}
      {assignmentHistory.length > 0 && (
        <div className="space-y-2">
          <span className="text-sm font-medium">Assignment History</span>
          <div className="space-y-2">
            {assignmentHistory.map((entry) => (
              <div key={entry.id} className="rounded-md border border-border/50 p-2.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AssignmentStatusBadge status={entry.status} />
                    {entry.reason && (
                      <span className="text-xs text-muted-foreground">{formatStatusLabel(entry.reason)}</span>
                    )}
                    {entry.active && (
                      <span className="text-xs text-muted-foreground">Current</span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{formatRelativeTime(entry.createdAt)}</span>
                </div>
                {entry.priority > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                    <Star className="h-3 w-3" />
                    Priority: {entry.priority}
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MiniAvatar
                    src={entry.addedBy?.avatar}
                    name={entry.addedBy?.displayName || entry.addedBy?.name}
                  />
                  <span>{entry.addedBy?.displayName || entry.addedBy?.name || 'Unknown'}</span>
                </div>
                {entry.notes && (
                  <p className="text-xs text-muted-foreground border-l-2 border-border pl-2">
                    {entry.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!hasShahada && assignmentHistory.length === 0 && activeSupervisors.length === 0 && (
        <p className="text-sm text-muted-foreground">No revert journey information</p>
      )}
    </div>
  );
}

// ============================================================================
// Tags Section
// ============================================================================

const CHECK_IN_METHOD_ICONS: Record<string, React.ReactNode> = {
  DM: <MessageSquare className="h-3.5 w-3.5" />,
  'Voice Call': <Phone className="h-3.5 w-3.5" />,
  Ticket: <Ticket className="h-3.5 w-3.5" />,
};

const CHECK_IN_METHODS = ['Ticket', 'Voice Call', 'DM'];

// Preset colors for inline tag creation
const TAG_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#64748b',
];

function TagsSection({ userId, canManageTags }: { userId: string; canManageTags: boolean }) {
  const { data: tagsData, isLoading } = useUserTags(userId);
  const { data: allTagsData } = useRevertTags();
  const createTag = useCreateTag();
  const assignTag = useAssignTag();
  const removeTag = useRemoveTag();

  // Picker state
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null);
  const [assignNote, setAssignNote] = useState('');

  // Inline create state
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(TAG_COLORS[0]);
  const [newEmoji, setNewEmoji] = useState('');
  const [newCategory, setNewCategory] = useState<RevertTagCategoryValue | ''>('');
  const [newNote, setNewNote] = useState('');

  // Remove state
  const [showHistory, setShowHistory] = useState(false);
  const [removeId, setRemoveId] = useState<number | null>(null);
  const [removalNote, setRemovalNote] = useState('');

  const activeTags = [...(tagsData?.activeTags || [])].sort(compareTagPresentation);
  const history = tagsData?.history || [];
  const resolvedHistory = history.filter(h => h.removedAt);

  const activeTagIds = new Set(activeTags.map(t => t.tagId));
  const availableTags = (allTagsData || [])
    .filter(t => !activeTagIds.has(t.id))
    .sort(compareTagPresentation);
  const filteredTags = availableTags.filter(t =>
    t.name.toLowerCase().includes(pickerSearch.toLowerCase()) ||
    (t.category || '').toLowerCase().includes(pickerSearch.toLowerCase())
  );
  const grouped = filteredTags.reduce((acc, tag) => {
    const cat = tag.category || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(tag);
    return acc;
  }, {} as Record<string, typeof filteredTags>);

  const availableCategories = REVERT_TAG_CATEGORY_VALUES;

  const showCreateOption = pickerSearch.trim().length > 0 && !creating;

  function closePicker() {
    setShowPicker(false);
    setPickerSearch('');
    setSelectedTagId(null);
    setAssignNote('');
    setCreating(false);
    setNewName('');
    setNewColor(TAG_COLORS[0]);
    setNewEmoji('');
    setNewCategory('');
    setNewNote('');
  }

  function startCreating() {
    setCreating(true);
    setNewName(pickerSearch.trim());
    setSelectedTagId(null);
  }

  function handleAssign(tagId: number) {
    assignTag.mutate(
      { userId, tagId, note: assignNote || undefined },
      { onSuccess: closePicker }
    );
  }

  async function handleCreateAndAssign() {
    if (!newName.trim()) return;
    createTag.mutate(
      { name: newName.trim(), color: newColor, emoji: newEmoji || undefined, category: newCategory || undefined },
      {
        onSuccess: (result: { tag?: { id?: number } }) => {
          const tagId = result?.tag?.id;
          if (tagId) {
            assignTag.mutate(
              { userId, tagId, note: newNote || undefined },
              { onSuccess: closePicker }
            );
          } else {
            closePicker();
          }
        },
      }
    );
  }

  function handleRemove() {
    if (!removeId) return;
    removeTag.mutate(
      { userId, assignmentId: removeId, removalNote: removalNote || undefined },
      { onSuccess: () => { setRemoveId(null); setRemovalNote(''); } }
    );
  }

  if (isLoading) {
    return <div className="flex gap-1.5">{[1,2].map(i => <Skeleton key={i} className="h-6 w-20 rounded-full" />)}</div>;
  }

  return (
    <div className="space-y-3">
      {/* Active tags */}
      <div className="flex flex-wrap gap-1.5">
        {activeTags.map(tag => (
          <span
            key={tag.assignmentId}
            className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-xs font-medium"
            title={tag.kind === 'system' ? 'System tag' : 'Custom tag'}
            style={{
              backgroundColor: `${tag.color}22`,
              color: tag.color,
              border: `1px solid ${tag.color}44`,
            }}
          >
            {tag.emoji && <span>{tag.emoji}</span>}
            {tag.name}
            {canManageTags ? (
              <button
                onClick={() => { setRemoveId(tag.assignmentId); setRemovalNote(''); }}
                className="ml-0.5 p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                title="Remove tag"
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </span>
        ))}

        {/* Add tag button */}
        {canManageTags ? (
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted hover:bg-muted/80 text-muted-foreground border border-dashed border-border transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add Tag
          </button>
        ) : null}
      </div>

      {/* Empty state */}
      {activeTags.length === 0 && !showPicker && (
        <p className="text-xs text-muted-foreground">No tags assigned</p>
      )}

      {/* Picker panel */}
      {canManageTags && showPicker && (
        <div className="border border-border rounded-lg bg-background shadow-md overflow-hidden">

          {/* Search / name input */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            {creating ? (
              <>
                <span className="text-muted-foreground" title="Color">
                  <span
                    className="inline-block h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: newColor }}
                  />
                </span>
                <input
                  autoFocus
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Tag name"
                  className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                />
                <button
                  onClick={() => { setCreating(false); setNewName(''); }}
                  className="text-muted-foreground hover:text-foreground"
                  title="Back"
                >
                  <ChevronDown className="h-4 w-4 rotate-90" />
                </button>
              </>
            ) : (
              <input
                autoFocus
                placeholder="Search or create a tag…"
                value={pickerSearch}
                onChange={e => setPickerSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && showCreateOption) startCreating(); }}
                className="w-full text-sm bg-transparent outline-none placeholder:text-muted-foreground"
              />
            )}
          </div>

          {/* Create form (inline) */}
          {creating ? (
            <div className="p-3 space-y-3 max-h-[70vh] overflow-y-auto">
              {/* Color swatches */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Color</label>
                <div className="flex flex-wrap gap-2">
                  {TAG_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setNewColor(c)}
                      className="h-6 w-6 rounded-full transition-transform hover:scale-110 shrink-0"
                      style={{
                        backgroundColor: c,
                        outline: newColor === c ? `2px solid ${c}` : 'none',
                        outlineOffset: '2px',
                      }}
                      title={c}
                    />
                  ))}
                  {/* Custom hex */}
                  <label className="h-6 w-6 rounded-full border-2 border-dashed border-border flex items-center justify-center cursor-pointer text-muted-foreground hover:border-foreground transition-colors shrink-0" title="Custom color">
                    <Plus className="h-3 w-3" />
                    <input
                      type="color"
                      value={newColor}
                      onChange={e => setNewColor(e.target.value)}
                      className="sr-only"
                    />
                  </label>
                </div>
              </div>

              {/* Emoji + Category — side by side */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Emoji</label>
                  <input
                    value={newEmoji}
                    onChange={e => {
                      const stripped = e.target.value.replace(/[^\p{Extended_Pictographic}\u200D\uFE0F\u20E3\p{Emoji_Modifier}]/gu, '');
                      const segments = [...new Intl.Segmenter().segment(stripped)];
                      setNewEmoji(segments[0]?.segment ?? '');
                    }}
                    placeholder="Emoji (optional)"
                    className="w-full text-sm bg-muted rounded px-2 py-1.5 outline-none placeholder:text-muted-foreground"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Category</label>
                  <div className="flex flex-wrap gap-1 rounded bg-muted p-1">
                    {availableCategories.map(category => (
                      <button
                        key={category}
                        onClick={() => setNewCategory(newCategory === category ? '' : category)}
                        className={cn(
                          'text-[11px] px-2 py-1 rounded-full border transition-colors',
                          newCategory === category
                            ? 'border-primary/50 bg-primary/10 text-primary'
                            : 'border-transparent text-muted-foreground hover:bg-background'
                        )}
                      >
                        {formatStatusLabel(category)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Assign note */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Note (optional)</label>
                <input
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  placeholder="Reason for this tag…"
                  className="mt-1 w-full text-sm bg-muted rounded px-2 py-1.5 outline-none placeholder:text-muted-foreground"
                />
              </div>

              {/* Preview */}
              {newName && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Preview</span>
                  <span
                    className="inline-flex items-center gap-1 pl-2 pr-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: `${newColor}22`, color: newColor, border: `1px solid ${newColor}44` }}
                  >
                    {newEmoji && <span>{newEmoji}</span>}
                    {newName}
                  </span>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleCreateAndAssign}
                  disabled={!newName.trim() || createTag.isPending || assignTag.isPending}
                  className="flex-1 text-xs py-1.5 rounded font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {createTag.isPending || assignTag.isPending ? 'Creating…' : 'Create & Assign'}
                </button>
                <button onClick={closePicker} className="text-xs px-3 py-1.5 bg-muted rounded hover:bg-muted/80 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* Existing tag list */
            <div className="max-h-48 overflow-y-auto">
              {filteredTags.length === 0 && !showCreateOption && (
                <p className="p-3 text-sm text-muted-foreground">No tags available</p>
              )}
              {Object.entries(grouped).map(([cat, tags]) => (
                <div key={cat}>
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/50">
                    {formatStatusLabel(cat)}
                  </div>
                  {tags.map(tag => (
                    <button
                      key={tag.id}
                      onClick={() => setSelectedTagId(selectedTagId === tag.id ? null : tag.id)}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 transition-colors',
                        selectedTagId === tag.id && 'bg-muted'
                      )}
                    >
                      <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                      {tag.emoji && <span>{tag.emoji}</span>}
                      <span className="flex-1 text-left">{tag.name}</span>
                      {tag.kind === 'system' && (
                        <Badge tone="info" kind="meta" emphasis="outline" className="h-5 px-1.5 text-[10px]">
                          System
                        </Badge>
                      )}
                      {tag.category && <span className="text-[10px] text-muted-foreground">{formatStatusLabel(tag.category)}</span>}
                      {selectedTagId === tag.id && <Check className="h-3.5 w-3.5 text-primary" />}
                    </button>
                  ))}
                </div>
              ))}

              {/* Create new option */}
              {showCreateOption && (
                <button
                  onClick={startCreating}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-primary/10 transition-colors border-t border-border"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create <span className="font-semibold">&quot;{pickerSearch.trim()}&quot;</span>
                </button>
              )}
            </div>
          )}

          {/* Assign existing tag footer */}
          {!creating && selectedTagId !== null && (
            <div className="p-2 border-t border-border space-y-2">
              <input
                placeholder="Optional note…"
                value={assignNote}
                onChange={e => setAssignNote(e.target.value)}
                className="w-full text-xs bg-muted rounded px-2 py-1.5 outline-none placeholder:text-muted-foreground"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleAssign(selectedTagId)}
                  disabled={assignTag.isPending}
                  className="flex-1 text-xs py-1.5 rounded font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {assignTag.isPending ? 'Assigning…' : 'Assign Tag'}
                </button>
                <button onClick={closePicker} className="text-xs px-3 py-1.5 bg-muted rounded hover:bg-muted/80 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Remove confirmation */}
      {canManageTags && removeId !== null && (
        <div className="border border-border rounded-lg bg-muted/30 p-3 space-y-3">
          <p className="text-sm font-medium text-foreground">Remove this tag?</p>
          <input
            placeholder="Optional reason…"
            value={removalNote}
            onChange={e => setRemovalNote(e.target.value)}
            className="w-full text-xs bg-background border border-border rounded px-2 py-1.5 outline-none placeholder:text-muted-foreground"
          />
          <div className="flex gap-2">
            <button
              onClick={handleRemove}
              disabled={removeTag.isPending}
              className="flex-1 text-xs py-1.5 bg-muted text-destructive rounded hover:bg-muted/60 transition-colors disabled:opacity-50 font-medium border border-border"
            >
              {removeTag.isPending ? 'Removing…' : 'Remove'}
            </button>
            <button
              onClick={() => { setRemoveId(null); setRemovalNote(''); }}
              className="text-xs px-3 py-1.5 bg-muted rounded hover:bg-muted/80 transition-colors border border-border"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Tag history */}
      {resolvedHistory.length > 0 && (
        <div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showHistory && 'rotate-180')} />
            {showHistory ? 'Hide' : 'Show'} history ({resolvedHistory.length})
          </button>
          {showHistory && (
            <div className="mt-2 space-y-2">
              {resolvedHistory.map(item => (
                <div key={item.id} className="text-xs border-l-2 border-muted pl-3 py-1 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">{item.tagName}</span>
                    {item.tagEmoji && <span>{item.tagEmoji}</span>}
                  </div>
                  <div className="text-muted-foreground">
                    Assigned {formatRelativeTime(item.assignedAt)}
                    {item.assignedBy && ` by ${item.assignedBy}`}
                    {item.note && <span className="italic"> — {item.note}</span>}
                  </div>
                  {item.removedAt && (
                    <div className="text-muted-foreground">
                      Removed {formatRelativeTime(item.removedAt)}
                      {item.removedBy && ` by ${item.removedBy}`}
                      {item.removalNote && <span className="italic"> — {item.removalNote}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Check-ins Section
// ============================================================================

type TicketActionState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'success'; discordUrl: string; outcome: string }
  | { status: 'error'; message: string };

function CheckInsSection({
  userId,
  displayName,
  openCheckInTicketId,
  canManageCheckIns,
}: {
  userId: string;
  displayName: string;
  openCheckInTicketId: number | null;
  canManageCheckIns: boolean;
}) {
  const { data: checkIns, isLoading } = useCheckIns(userId);
  const addCheckIn = useAddCheckIn();
  const startTicket = useStartCheckInTicket();

  const [showForm, setShowForm] = useState(false);
  const [method, setMethod] = useState('Ticket');
  const [summary, setSummary] = useState('');
  const [ticketState, setTicketState] = useState<TicketActionState>({ status: 'idle' });
  const openCheckInTicketHref = openCheckInTicketId ? `/tickets/${openCheckInTicketId}` : null;

  function handleSubmit() {
    addCheckIn.mutate(
      { userId, method, summary: summary || undefined },
      {
        onSuccess: () => {
          setShowForm(false);
          setSummary('');
          setMethod('Ticket');
        },
      }
    );
  }

  async function createTicket(toastId?: string | number) {
    setTicketState({ status: 'pending' });

    const activeToastId = toast.loading('Creating check-in ticket…', {
      id: toastId,
      description: displayName,
    });

    try {
      const data = await startTicket.mutateAsync({ userId });

      setTicketState({ status: 'success', discordUrl: data.discordUrl, outcome: data.outcome });
      toast.success(getTicketToastTitle(data.outcome), {
        id: activeToastId,
        description: displayName,
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

  function handleStartTicket() {
    void createTicket();
  }

  if (isLoading) {
    return <div className="space-y-2">{[1, 2].map((index) => <Skeleton key={index} className="h-12 w-full rounded" />)}</div>;
  }

  const items = checkIns || [];

  return (
    <div className="space-y-3">
      {canManageCheckIns ? (
        <div className="flex flex-wrap items-center gap-2">
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
            >
              <Plus className="h-3.5 w-3.5" />
              Log Check-in
            </button>
          )}
          {ticketState.status === 'idle' && openCheckInTicketHref ? (
            <a
              href={openCheckInTicketHref}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-muted border border-border text-foreground hover:bg-muted/80 transition-colors font-medium"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Jump to ticket
            </a>
          ) : null}
          {ticketState.status === 'idle' && !openCheckInTicketHref ? (
            <button
              onClick={handleStartTicket}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-muted border border-border text-foreground hover:bg-muted/80 transition-colors font-medium"
            >
              <Ticket className="h-3.5 w-3.5" />
              Create ticket
            </button>
          ) : null}
          {ticketState.status === 'pending' ? (
            <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Creating…
            </span>
          ) : null}
          {ticketState.status === 'success' ? (
            <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-medium text-brand-accent-text">
              <Check className="h-3.5 w-3.5" />
              {getTicketInlineLabel(ticketState.outcome)}
            </span>
          ) : null}
          {ticketState.status === 'error' ? (
            <span className="text-xs font-medium text-destructive">
              Failed to create ticket
            </span>
          ) : null}
        </div>
      ) : null}

      {canManageCheckIns && showForm ? (
        <div className="border border-border rounded-lg p-3 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {CHECK_IN_METHODS.map((checkInMethod) => (
              <button
                key={checkInMethod}
                onClick={() => setMethod(checkInMethod)}
                className={cn(
                  'flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border',
                  method === checkInMethod
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted border-border text-muted-foreground hover:bg-muted/80'
                )}
              >
                {CHECK_IN_METHOD_ICONS[checkInMethod]}
                {checkInMethod}
              </button>
            ))}
          </div>
          <textarea
            placeholder="Optional summary…"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            rows={2}
            className="w-full text-sm bg-muted rounded px-2.5 py-2 outline-none placeholder:text-muted-foreground resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={addCheckIn.isPending}
              className="flex-1 text-sm py-1.5 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {addCheckIn.isPending ? 'Saving…' : 'Save Check-in'}
            </button>
            <button
              onClick={() => { setShowForm(false); setSummary(''); setMethod('Ticket'); }}
              className="text-sm px-3 py-1.5 bg-muted rounded hover:bg-muted/80 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {items.length === 0 && !showForm ? (
        <p className="text-sm text-muted-foreground">No check-ins recorded</p>
      ) : null}

      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((checkIn) => (
            <div key={checkIn.id} className="text-sm border-l-2 border-primary/25 pl-3 py-1 space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-primary">
                  {CHECK_IN_METHOD_ICONS[checkIn.method] || <MessageSquare className="h-3.5 w-3.5" />}
                </span>
                <span className="font-medium text-xs">{checkIn.method}</span>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground">{formatRelativeTime(checkIn.checkedInAt)}</span>
              </div>
              {checkIn.staffName ? (
                <div className="flex items-center gap-1.5">
                  <Avatar className="h-4 w-4">
                    <AvatarImage src={checkIn.staffAvatar || undefined} />
                    <AvatarFallback className="text-[8px] bg-muted">{getInitials(checkIn.staffName)}</AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-muted-foreground">{checkIn.staffName}</span>
                </div>
              ) : null}
              {checkIn.summary ? (
                <p className="mt-0.5 overflow-hidden text-xs text-muted-foreground wrap-break-word">{checkIn.summary}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ============================================================================
// Tickets Section
// ============================================================================

function TicketsSection({
  ticketStats,
  recentTickets,
}: {
  ticketStats: UserDetails['ticketStats'];
  recentTickets: UserDetails['recentTickets'];
  userId: string;
}) {
  const statItems = [
    { label: 'Open', value: ticketStats.open },
    { label: 'Closed', value: ticketStats.closed },
    { label: 'Deleted', value: ticketStats.deleted },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {statItems.map((item) => (
          <div key={item.label} className="rounded-lg border border-border bg-muted/40 p-3 text-center">
            <p className="text-lg font-semibold text-foreground">{item.value}</p>
            <p className="text-xs text-muted-foreground">{item.label}</p>
          </div>
        ))}
      </div>

      {recentTickets.length === 0 ? (
        <p className="text-sm text-muted-foreground">No recent tickets</p>
      ) : (
        <div className="space-y-2">
          {recentTickets.map((ticket) => {
            const descriptor = getTicketStatusDescriptor(ticket.status);

            return (
              <a
                key={ticket.id}
                href={`/tickets/${ticket.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    Ticket #{ticket.sequence ?? ticket.id}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Opened {formatRelativeTime(ticket.createdAt)}
                  </p>
                </div>
                <Badge tone={descriptor.tone} kind={descriptor.kind} emphasis={descriptor.emphasis}>
                  {descriptor.label}
                </Badge>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Supervisor Notes Section
// ============================================================================

function SupervisorNotesSection({
  entries,
  userId,
  canAddNotes,
}: {
  entries: UserDetails['supervisorNotes'];
  userId: string;
  canAddNotes: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const [noteText, setNoteText] = useState('');
  const addNote = useAddSupervisorNote();

  function handleAddNote() {
    if (!noteText.trim()) return;
    addNote.mutate(
      { userId, note: noteText.trim() },
      {
        onSuccess: () => setNoteText(''),
        onError: (e) => toast.error('Failed to add note', { description: getErrorMessage(e, 'Unknown error') }),
      }
    );
  }

  const displayedEntries = showAll ? entries : entries.slice(0, 3);

  return (
    <div className="space-y-3">
      {/* Note composer */}
      {canAddNotes ? (
        <div className="space-y-2">
          <textarea
            placeholder="Add a note…"
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            rows={2}
            className="w-full text-sm bg-muted rounded px-2.5 py-2 outline-none placeholder:text-muted-foreground resize-none"
          />
          <Button
            size="sm"
            onClick={handleAddNote}
            disabled={!noteText.trim() || addNote.isPending}
          >
            {addNote.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {addNote.isPending ? 'Adding…' : 'Add note'}
          </Button>
        </div>
      ) : null}

      {entries.length === 0 && (
        <p className="text-sm text-muted-foreground">No supervisor notes yet</p>
      )}

      {displayedEntries.map((entry) => (
        <div key={entry.id} className="text-sm border-l-2 border-muted pl-3 py-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MiniAvatar
              src={entry.supervisor?.avatar ?? null}
              name={entry.supervisor?.displayName || entry.supervisor?.name}
            />
            <span className="font-medium text-foreground">
              {entry.supervisor?.displayName || entry.supervisor?.name || 'Unknown'}
            </span>
            <span className="text-xs">•</span>
            <span className="text-xs">{formatRelativeTime(entry.createdAt)}</span>
          </div>
          {entry.note && (
            <p className="mt-1 text-muted-foreground">{entry.note}</p>
          )}
        </div>
      ))}
      
      {entries.length > 3 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-sm text-primary hover:underline"
        >
          {showAll ? 'Show less' : `Show ${entries.length - 3} more`}
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Moderation Section
// ============================================================================

function ModerationSection({ infractions }: { infractions: UserDetails['infractions'] }) {
  if (infractions.length === 0) {
    return <p className="text-sm text-muted-foreground">No infractions</p>;
  }

  const activeInfractions = infractions.filter((i) => i.status === 'ACTIVE');
  const hiddenCount = infractions.filter((i) => i.hidden).length;
  const typeCounts = infractions.reduce((acc, inf) => {
    acc[inf.type] = (acc[inf.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-sm">
        <span className="font-medium text-foreground">
          {activeInfractions.length} active
        </span>
        <span className="text-muted-foreground">
          / {infractions.length} total
        </span>
        {hiddenCount > 0 && (
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {hiddenCount} hidden
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {Object.entries(typeCounts).map(([type, count]) => (
          <span
            key={type}
            className="inline-flex items-center gap-1.5 px-2 py-1 bg-muted rounded-md text-xs"
          >
            <InfractionTypeIcon type={type} />
            <span className="font-medium text-foreground">{type}</span>
            <span className="text-muted-foreground">{count}</span>
          </span>
        ))}
      </div>

      <div className="space-y-3">
        {infractions.map((infraction) => (
          <div key={infraction.id} className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 font-medium text-foreground">
                <InfractionTypeIcon type={infraction.type} />
                {infraction.type}
              </span>
              <span className={cn(
                'rounded-md px-2 py-1 font-medium',
                infraction.status === 'ACTIVE'
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-muted text-muted-foreground'
              )}>
                {infraction.status}
              </span>
              {infraction.hidden ? (
                <span className="rounded-md bg-muted px-2 py-1 text-muted-foreground">Hidden</span>
              ) : null}
              {infraction.expiresAt ? (
                <span className="text-muted-foreground">Expires {formatRelativeTime(infraction.expiresAt)}</span>
              ) : null}
            </div>

            {infraction.reason ? (
              <p className="text-sm text-foreground wrap-break-word">{infraction.reason}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No reason recorded</p>
            )}

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Added {formatRelativeTime(infraction.createdAt)}</span>
              {infraction.moderator?.name ? <span>by {infraction.moderator.name}</span> : null}
              {infraction.pardonedBy ? <span>Pardoned</span> : null}
              {infraction.jumpUrl ? (
                <a
                  href={infraction.jumpUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  View source
                </a>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Timeline Footer
// ============================================================================

function TimelineFooter({ user }: { user: UserDetails['user'] }) {
  return (
    <div className="p-4 border-t border-border bg-muted/30">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>Member since {formatDate(user.createdAt)}</span>
      </div>
    </div>
  );
}

function OperationalSummary({ data }: { data: UserDetails }) {
  const { data: checkIns } = useCheckIns(data.user.id);

  const currentSupportState = data.assignmentHistory.find((item) => item.active)?.status ?? null;
  const activeInfractions = data.infractions.filter((item) => item.status === 'ACTIVE');
  const activeSupervisors = data.supervisors.filter((item) => item.active);
  const latestCheckIn = checkIns?.[0]?.checkedInAt ?? null;
  const isRevertLike = isRevertLikeRelation(data.user.relationToIslam);
  const overdueCheckIn = isOverdueCheckIn(latestCheckIn);
  const openTickets = data.ticketStats.open;

  let nextActionTitle = 'Start with the current support state';
  let nextActionDescription = 'Use the signals below to decide where to dig in first.';

  if (activeInfractions.length > 0) {
    nextActionTitle = 'Start with active moderation risk';
    nextActionDescription = 'Review the active infractions first so you can act on the highest-risk issues before anything else.';
  } else if (latestCheckIn && overdueCheckIn) {
    nextActionTitle = 'Follow up on overdue contact';
    nextActionDescription = `The last check-in was ${getCheckInAgeDays(latestCheckIn)} days ago, so confirm the next follow-up before you review older context.`;
  } else if (!latestCheckIn && isRevertLike) {
    nextActionTitle = 'Log the first check-in';
    nextActionDescription = 'There is no recorded check-in yet, so confirm first contact before you spend time on older context.';
  } else if (!latestCheckIn) {
    nextActionTitle = 'Review current support context';
    nextActionDescription = 'Start with tickets, support state, or moderation context before deciding whether outreach is needed.';
  } else if (currentSupportState === 'OPEN') {
    nextActionTitle = 'Review the open support state';
    nextActionDescription = 'Check the current support context now so you stay aligned with the active workflow instead of older history.';
  } else if (!data.user.inGuild) {
    nextActionTitle = 'Confirm the off-server state';
    nextActionDescription = 'Verify whether follow-up is still possible before you spend time on lower-priority profile details.';
  } else if (openTickets > 0) {
    nextActionTitle = 'Check the open ticket context';
    nextActionDescription = 'Open tickets may already contain the latest conversation or the next action you need.';
  }

  const contactLabel = latestCheckIn
    ? formatRelativeTime(latestCheckIn)
    : isRevertLike
    ? 'No check-ins'
    : 'No contact';

  const supervisorLabel =
    activeSupervisors.length > 0
      ? `${activeSupervisors.length} supervisor${activeSupervisors.length === 1 ? '' : 's'}`
      : 'No supervisor';

  const ticketLabel = `${openTickets} open ticket${openTickets === 1 ? '' : 's'}`;

  const moderationLabel =
    activeInfractions.length > 0
      ? `${activeInfractions.length} infraction${activeInfractions.length === 1 ? '' : 's'}`
      : 'No infractions';

  return (
    <div className="border-b border-border bg-muted/20 px-3 py-2 space-y-1.5">
      {/* Next action — single-line chip; description available on hover */}
      <div
        className="flex items-center gap-1.5 rounded-lg border border-primary/15 bg-primary/5 px-2.5 py-1.5"
        title={nextActionDescription}
      >
        <ChevronRight className="h-3 w-3 text-primary shrink-0" />
        <p className="text-xs font-medium text-foreground truncate">{nextActionTitle}</p>
      </div>

      {/* Stat chips — 2×2 grid */}
      <div className="grid grid-cols-2 gap-1.5">
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5">
          <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
          <p className="text-xs font-medium text-foreground truncate">{contactLabel}</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5">
          <Users className="h-3 w-3 text-muted-foreground shrink-0" />
          <p className="text-xs font-medium text-foreground truncate">{supervisorLabel}</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5">
          <Ticket className="h-3 w-3 text-muted-foreground shrink-0" />
          <p className="text-xs font-medium text-foreground truncate">{ticketLabel}</p>
        </div>
        <div
          className={cn(
            'flex items-center gap-1.5 rounded-md border bg-background px-2 py-1.5',
            activeInfractions.length > 0 ? 'border-destructive/30 bg-destructive/5' : 'border-border',
          )}
        >
          <ShieldAlert className={cn('h-3 w-3 shrink-0', activeInfractions.length > 0 ? 'text-destructive' : 'text-muted-foreground')} />
          <p className={cn('text-xs font-medium truncate', activeInfractions.length > 0 ? 'text-destructive' : 'text-foreground')}>{moderationLabel}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Shared Panel Content Component
// ============================================================================

export interface UserPanelContentProps {
  data: UserDetails | undefined;
  isLoading: boolean;
  error: Error | null;
  isMobile: boolean;
  breadcrumb?: React.ReactNode;
}

function UserPanelSections({ data, isMobile }: { data: UserDetails; isMobile: boolean }) {
  const { canPerformCrossStaffActions, discordId } = useUserRole();
  const activeSupervisor = data.supervisors.find((supervisor) => supervisor.active) ?? null;
  const canManageTarget = !activeSupervisor || activeSupervisor.supervisor?.id === discordId || canPerformCrossStaffActions;

  return (
    <>
      <CollapsibleSection
        title="Current State"
        icon={<Heart className="h-4 w-4" />}
        defaultOpen={!isMobile}
      >
        <RevertJourneySection
          shahadas={data.shahadas}
          assignmentHistory={data.assignmentHistory}
          supervisors={data.supervisors}
        />
      </CollapsibleSection>

      <CollapsibleSection
        title="Check-ins"
        icon={<Clock className="h-4 w-4" />}
        defaultOpen={!isMobile}
      >
        <CheckInsSection
          userId={data.user.id}
          displayName={data.user.displayName || data.user.name || 'Unknown User'}
          openCheckInTicketId={data.openCheckInTicketId}
          canManageCheckIns={canManageTarget}
        />
      </CollapsibleSection>

      <CollapsibleSection
        title="Tags"
        icon={<Tag className="h-4 w-4" />}
        defaultOpen={false}
      >
        <TagsSection userId={data.user.id} canManageTags={canManageTarget} />
      </CollapsibleSection>

      <CollapsibleSection
        title="Tickets"
        icon={<Ticket className="h-4 w-4" />}
        defaultOpen={!isMobile && data.ticketStats.open > 0}
      >
        <TicketsSection
          ticketStats={data.ticketStats}
          recentTickets={data.recentTickets}
          userId={data.user.id}
        />
      </CollapsibleSection>

      <CollapsibleSection
        title="Supervisor Notes"
        icon={<MessageSquare className="h-4 w-4" />}
        badge={
          data.supervisorNotes.length > 0 && (
            <span className="text-xs text-muted-foreground ml-1">
              ({data.supervisorNotes.length})
            </span>
          )
        }
        defaultOpen={false}
      >
        <SupervisorNotesSection entries={data.supervisorNotes} userId={data.user.id} canAddNotes={canManageTarget} />
      </CollapsibleSection>

      <CollapsibleSection
        title="Moderation"
        icon={<ShieldAlert className="h-4 w-4" />}
        badge={
          data.infractions.filter((i) => i.status === 'ACTIVE').length > 0 && (
            <Badge variant="destructive" className="ml-2 text-[10px] px-1.5 py-0">
              {data.infractions.filter((i) => i.status === 'ACTIVE').length}
            </Badge>
          )
        }
        defaultOpen={!isMobile && data.infractions.some((i) => i.status === 'ACTIVE')}
      >
        <ModerationSection infractions={data.infractions} />
      </CollapsibleSection>

      <CollapsibleSection
        title="Profile"
        icon={<User className="h-4 w-4" />}
        defaultOpen={false}
      >
        <ProfileSection user={data.user} />
      </CollapsibleSection>

      <CollapsibleSection
        title="Roles"
        icon={<Shield className="h-4 w-4" />}
        badge={
          <span className="text-xs text-muted-foreground ml-1">
            ({data.roles.length})
          </span>
        }
        defaultOpen={false}
      >
        <RolesSection roles={data.roles} />
      </CollapsibleSection>
    </>
  );
}

export function UserPanelContent({ 
  data, 
  isLoading, 
  error, 
  isMobile,
  breadcrumb,
}: UserPanelContentProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {isLoading && <UserDetailsSkeleton />}
      
      {error && (
        <div className="p-4 text-center">
          <p className="text-sm text-destructive">Failed to load user details</p>
        </div>
      )}

      {data && (
        <>
          {/* Breadcrumb for stacked navigation */}
          {breadcrumb && (
            <div className="px-4 pt-4 pb-2 border-b border-border bg-muted/30">
              {breadcrumb}
            </div>
          )}
          {isMobile ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <UserHeader user={data.user} />
                <SupervisionActionsRow
                  userId={data.user.id}
                  isRevertLike={isRevertLikeRelation(data.user.relationToIslam)}
                  activeSupervisors={data.supervisors}
                />
                <OperationalSummary data={data} />
                <UserPanelSections data={data} isMobile={isMobile} />
                <TimelineFooter user={data.user} />
              </div>
            </div>
          ) : (
            <>
              <UserHeader user={data.user} />
              <SupervisionActionsRow
                userId={data.user.id}
                isRevertLike={isRevertLikeRelation(data.user.relationToIslam)}
                activeSupervisors={data.supervisors}
              />
              <div className="flex-1 overflow-y-auto overscroll-contain">
                <OperationalSummary data={data} />
                <UserPanelSections data={data} isMobile={isMobile} />
              </div>

              <TimelineFooter user={data.user} />
            </>
          )}
        </>
      )}
    </div>
  );
}


