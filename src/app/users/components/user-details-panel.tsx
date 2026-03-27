'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAddCheckIn } from '@/lib/hooks/mutations/useAddCheckIn';
import { useAssignTag, useCreateTag, useRemoveTag } from '@/lib/hooks/mutations/useTagMutations';
import { useCheckIns } from '@/lib/hooks/queries/useCheckIns';
import { useRevertTags } from '@/lib/hooks/queries/useRevertTags';
import { type UserDetails } from '@/lib/hooks/queries/useUserDetails';
import { useUserTags } from '@/lib/hooks/queries/useUserTags';
import {
  getAssignmentStatusDescriptor,
  getTicketStatusDescriptor,
  getUserAttributeStatusDescriptor,
} from '@/lib/status-system';
import { cn, formatRelativeTime, roleColorToHex } from '@/lib/utils';
import {
    AlertTriangle,
    Ban,
    Calendar,
    Check,
    ChevronDown,
    ChevronRight,
    Clock,
    Copy,
    Globe,
    Heart,
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
    UserX,
    Users,
    Venus,
    VolumeX,
    X,
} from 'lucide-react';
import { useCallback, useState } from 'react';
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
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors min-h-[44px]"
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
                <div className="flex min-h-[44px] w-full items-center justify-between px-4 py-3">
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
            <div className="w-full flex items-center justify-between px-4 py-3 min-h-[44px]">
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
  const relationIsRevert = user.relationToIslam?.toLowerCase().includes('revert') ||
    user.relationToIslam?.toLowerCase().includes('convert');

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
  const currentAssignment = assignmentHistory.find((a) => a.active);
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

      {/* Current Assignment Status */}
      {currentAssignment && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Current Status</span>
            <AssignmentStatusBadge status={currentAssignment.status} />
          </div>
          {currentAssignment.priority > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
              <Star className="h-3.5 w-3.5" />
              Priority: {currentAssignment.priority}
            </div>
          )}
          {currentAssignment.notes && (
            <p className="text-sm text-muted-foreground bg-muted/50 rounded-md p-2">
              {currentAssignment.notes}
            </p>
          )}
        </div>
      )}

      {/* Note: Supervision Needs replaced by the Tags section below */}

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

      {/* Empty state */}
      {!hasShahada && !currentAssignment && activeSupervisors.length === 0 && (
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

function TagsSection({ userId }: { userId: string }) {
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
  const [newCategory, setNewCategory] = useState('');
  const [newNote, setNewNote] = useState('');

  // Remove state
  const [showHistory, setShowHistory] = useState(false);
  const [removeId, setRemoveId] = useState<number | null>(null);
  const [removalNote, setRemovalNote] = useState('');

  const activeTags = tagsData?.activeTags || [];
  const history = tagsData?.history || [];
  const resolvedHistory = history.filter(h => h.removedAt);

  const activeTagIds = new Set(activeTags.map(t => t.tagId));
  const availableTags = (allTagsData || []).filter(t => !activeTagIds.has(t.id));
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

  // Derive existing categories for suggestions
  const existingCategories = Array.from(
    new Set((allTagsData || []).map(t => t.category).filter(Boolean) as string[])
  ).sort();

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
            style={{
              backgroundColor: `${tag.color}22`,
              color: tag.color,
              border: `1px solid ${tag.color}44`,
            }}
          >
            {tag.emoji && <span>{tag.emoji}</span>}
            {tag.name}
            <button
              onClick={() => { setRemoveId(tag.assignmentId); setRemovalNote(''); }}
              className="ml-0.5 p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              title="Remove tag"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        {/* Add tag button */}
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted hover:bg-muted/80 text-muted-foreground border border-dashed border-border transition-colors"
        >
          <Plus className="h-3 w-3" />
          Add Tag
        </button>
      </div>

      {/* Empty state */}
      {activeTags.length === 0 && !showPicker && (
        <p className="text-xs text-muted-foreground">No tags assigned</p>
      )}

      {/* Picker panel */}
      {showPicker && (
        <div className="border border-border rounded-lg bg-background shadow-md overflow-hidden">

          {/* Search / name input */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            {creating ? (
              <>
                <span className="text-muted-foreground" title="Color">
                  <span
                    className="inline-block h-3 w-3 rounded-full flex-shrink-0"
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
                      className="h-6 w-6 rounded-full transition-transform hover:scale-110 flex-shrink-0"
                      style={{
                        backgroundColor: c,
                        outline: newColor === c ? `2px solid ${c}` : 'none',
                        outlineOffset: '2px',
                      }}
                      title={c}
                    />
                  ))}
                  {/* Custom hex */}
                  <label className="h-6 w-6 rounded-full border-2 border-dashed border-border flex items-center justify-center cursor-pointer text-muted-foreground hover:border-foreground transition-colors flex-shrink-0" title="Custom color">
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
                  <input
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    placeholder="e.g. Learning"
                    className="w-full text-sm bg-muted rounded px-2 py-1.5 outline-none placeholder:text-muted-foreground"
                  />
                </div>
              </div>
              {existingCategories.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {existingCategories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setNewCategory(cat)}
                      className={cn(
                        'text-[11px] px-2 py-0.5 rounded-full border transition-colors',
                        newCategory === cat
                          ? 'border-primary/50 bg-primary/10 text-primary'
                          : 'border-border bg-muted text-muted-foreground hover:bg-muted/70'
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}

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
                    {cat}
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
                      <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                      {tag.emoji && <span>{tag.emoji}</span>}
                      <span className="flex-1 text-left">{tag.name}</span>
                      {tag.category && <span className="text-[10px] text-muted-foreground">{tag.category}</span>}
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
                  className="flex-1 text-xs py-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {assignTag.isPending ? 'Assigning…' : 'Assign Tag'}
                </button>
                <button onClick={closePicker} className="text-xs px-3 py-1.5 bg-muted rounded hover:bg-muted/80 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Empty / cancel footer */}
          {!creating && selectedTagId === null && (
            <div className="px-3 py-2 border-t border-border flex justify-end">
              <button onClick={closePicker} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Close
              </button>
            </div>
          )}
        </div>
      )}

      {/* Remove confirmation */}
      {removeId !== null && (
        <div className="border border-border rounded-lg p-3 bg-muted/40 space-y-2">
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

function CheckInsSection({ userId }: { userId: string }) {
  const { data: checkIns, isLoading } = useCheckIns(userId);
  const addCheckIn = useAddCheckIn();

  const [showForm, setShowForm] = useState(false);
  const [method, setMethod] = useState('Ticket');
  const [summary, setSummary] = useState('');

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

  if (isLoading) {
    return <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-12 w-full rounded" />)}</div>;
  }

  const items = checkIns || [];

  return (
    <div className="space-y-3">
      {/* Log button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
        >
          <Plus className="h-3.5 w-3.5" />
          Log Check-in
        </button>
      )}

      {/* Inline form */}
      {showForm && (
        <div className="border border-border rounded-lg p-3 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {CHECK_IN_METHODS.map(m => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={cn(
                  'flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border',
                  method === m
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted border-border text-muted-foreground hover:bg-muted/80'
                )}
              >
                {CHECK_IN_METHOD_ICONS[m]}
                {m}
              </button>
            ))}
          </div>
          <textarea
            placeholder="Optional summary…"
            value={summary}
            onChange={e => setSummary(e.target.value)}
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
      )}

      {/* Check-in list */}
      {items.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground">No check-ins recorded</p>
      )}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map(ci => (
            <div key={ci.id} className="text-sm border-l-2 border-primary/25 pl-3 py-1 space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-primary">
                  {CHECK_IN_METHOD_ICONS[ci.method] || <MessageSquare className="h-3.5 w-3.5" />}
                </span>
                <span className="font-medium text-xs">{ci.method}</span>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground">{formatRelativeTime(ci.checkedInAt)}</span>
              </div>
              {ci.staffName && (
                <div className="flex items-center gap-1.5">
                  <Avatar className="h-4 w-4">
                    <AvatarImage src={ci.staffAvatar || undefined} />
                    <AvatarFallback className="text-[8px] bg-muted">{getInitials(ci.staffName)}</AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-muted-foreground">{ci.staffName}</span>
                </div>
              )}
              {ci.summary && (
                <p className="text-xs text-muted-foreground mt-0.5 break-words overflow-hidden">{ci.summary}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Supervisor Notes Section
// ============================================================================

function SupervisorNotesSection({ entries }: { entries: UserDetails['supervisorEntries'] }) {
  const [showAll, setShowAll] = useState(false);
  
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No supervisor notes</p>;
  }

  const displayedEntries = showAll ? entries : entries.slice(0, 3);

  return (
    <div className="space-y-3">
      {displayedEntries.map((entry) => (
        <div key={entry.id} className="text-sm border-l-2 border-muted pl-3 py-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MiniAvatar
              src={null}
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

  // Count by type
  const typeCounts = infractions.reduce((acc, inf) => {
    acc[inf.type] = (acc[inf.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      {/* Summary counts */}
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

      {/* Type breakdown */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(typeCounts).map(([type, count]) => (
          <span
            key={type}
            className="inline-flex items-center gap-1.5 px-2 py-1 bg-muted rounded-md text-xs"
          >
            <InfractionTypeIcon type={type} />
            <span className="capitalize">{type.toLowerCase().replace(/_/g, ' ')}</span>
            <span className="font-medium">{count}</span>
          </span>
        ))}
      </div>

      {/* Recent infractions list */}
      <div className="space-y-2">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">Recent</span>
        {infractions.slice(0, 3).map((inf) => (
          <div
            key={inf.id}
            className={cn(
              'p-2 rounded-md text-sm',
              inf.status === 'ACTIVE' ? 'bg-red-50 dark:bg-red-950/30' : 'bg-muted/50'
            )}
          >
            <div className="flex items-center gap-2">
              <InfractionTypeIcon type={inf.type} />
              <span className="capitalize font-medium">{inf.type.toLowerCase().replace(/_/g, ' ')}</span>
              <span className="text-xs text-muted-foreground">{formatRelativeTime(inf.createdAt)}</span>
            </div>
            {inf.reason && (
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{inf.reason}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Tickets Section
// ============================================================================

function TicketsSection({ 
  ticketStats, 
  recentTickets,
  userId,
}: { 
  ticketStats: UserDetails['ticketStats'];
  recentTickets: UserDetails['recentTickets'];
  userId: string;
}) {
  const totalTickets = ticketStats.open + ticketStats.closed + ticketStats.deleted;
  
  return (
    <div className="space-y-4">
      {/* Stat row */}
      <div className="flex gap-4">
        <div className="flex-1">
          <div className="text-2xl font-bold text-primary">
            {ticketStats.open}
          </div>
          <div className="text-xs text-muted-foreground">Open</div>
        </div>
        <div className="flex-1">
          <div className="text-2xl font-bold text-muted-foreground">
            {ticketStats.closed}
          </div>
          <div className="text-xs text-muted-foreground">Closed</div>
        </div>
        <div className="flex-1">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {ticketStats.deleted}
          </div>
          <div className="text-xs text-muted-foreground">Deleted</div>
        </div>
      </div>
      
      {/* Scrollable ticket list */}
      {recentTickets.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">All Tickets</div>
          <div className="max-h-[200px] overflow-y-auto space-y-1 pr-1">
            {recentTickets.map((ticket) => (
              <a
                key={ticket.id}
                href={`/tickets/${ticket.id}`}
                className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-primary group-hover:underline">
                    #{ticket.sequence !== null ? ticket.sequence : ticket.id}
                  </span>
                  <span className={cn(
                    'inline-flex items-center'
                  )}>
                    <Badge
                      tone={getTicketStatusDescriptor(ticket.status).tone}
                      kind={getTicketStatusDescriptor(ticket.status).kind}
                      emphasis={getTicketStatusDescriptor(ticket.status).emphasis}
                      className="px-1.5 py-0 text-[10px]"
                    >
                      {getTicketStatusDescriptor(ticket.status).label}
                    </Badge>
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(ticket.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
      
      {/* View All link */}
      {totalTickets > 0 && (
        <a
          href={`/tickets?author=${userId}`}
          className="flex items-center justify-center gap-1 px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
        >
          View All Tickets
          <ChevronRight className="h-4 w-4" />
        </a>
      )}
      
      {/* Empty state */}
      {totalTickets === 0 && (
        <p className="text-sm text-muted-foreground">No tickets found</p>
      )}
    </div>
  );
}

// ============================================================================
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

function OperationalSummary({ data, compact = false }: { data: UserDetails; compact?: boolean }) {
  const { data: checkIns } = useCheckIns(data.user.id);

  const activeNeeds = data.supervisionNeeds.filter((item) => !item.resolvedAt);
  const activeInfractions = data.infractions.filter((item) => item.status === 'ACTIVE');
  const activeSupervisors = data.supervisors.filter((item) => item.active);
  const latestCheckIn = checkIns?.[0]?.checkedInAt ?? null;
  const overdueCheckIn = isOverdueCheckIn(latestCheckIn);
  const openTickets = data.ticketStats.open;

  let nextActionTitle = 'Start with the current support state';
  let nextActionDescription = 'Use the signals below to decide where to dig in first.';

  if (activeInfractions.length > 0) {
    nextActionTitle = 'Start with active moderation risk';
    nextActionDescription = 'Review the active infractions first so you can act on the highest-risk issues before anything else.';
  } else if (overdueCheckIn) {
    nextActionTitle = latestCheckIn ? 'Follow up on overdue contact' : 'Log the first check-in';
    nextActionDescription = latestCheckIn
      ? `The last check-in was ${getCheckInAgeDays(latestCheckIn)} days ago, so confirm the next follow-up before you review older context.`
      : 'There is no recorded check-in yet, so confirm first contact before you spend time on older context.';
  } else if (activeNeeds.length > 0) {
    nextActionTitle = 'Review active support needs';
    nextActionDescription = 'Check the active support needs now so you stay aligned with the current workflow instead of older history.';
  } else if (!data.user.inGuild) {
    nextActionTitle = 'Confirm the off-server state';
    nextActionDescription = 'Verify whether follow-up is still possible before you spend time on lower-priority profile details.';
  } else if (openTickets > 0) {
    nextActionTitle = 'Check the open ticket context';
    nextActionDescription = 'Open tickets may already contain the latest conversation or the next action you need.';
  }

  return (
    <div className={cn('border-b border-border bg-muted/20', compact ? 'px-3 py-3' : 'px-4 py-4')}>
      <div className={cn('space-y-3', compact && 'space-y-2.5')}>
        <div className={cn('space-y-2 rounded-xl border border-primary/15 bg-primary/5 shadow-xs', compact ? 'px-3 py-2.5' : 'px-4 py-3')}>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            <ChevronRight className="h-3.5 w-3.5" />
            Next action
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">{nextActionTitle}</p>
            <p className="text-sm text-muted-foreground">{nextActionDescription}</p>
          </div>
        </div>

        <div className={cn('grid gap-2 sm:grid-cols-2', compact && 'grid-cols-2 gap-1.5')}>
          <div className={cn('rounded-lg border border-border bg-background', compact ? 'px-2.5 py-2' : 'px-3 py-2')}>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Contact
            </div>
            <p className="mt-1 text-sm font-medium text-foreground">
              {latestCheckIn ? formatRelativeTime(latestCheckIn) : 'No check-ins yet'}
            </p>
          </div>
          <div className={cn('rounded-lg border border-border bg-background', compact ? 'px-2.5 py-2' : 'px-3 py-2')}>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              Support context
            </div>
            <p className="mt-1 text-sm font-medium text-foreground">
              {activeSupervisors.length > 0
                ? `${activeSupervisors.length} active supervisor${activeSupervisors.length === 1 ? '' : 's'}`
                : 'No active supervisor'}
            </p>
          </div>
          <div className={cn('rounded-lg border border-border bg-background', compact ? 'px-2.5 py-2' : 'px-3 py-2')}>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
              <Ticket className="h-3.5 w-3.5" />
              Ticket context
            </div>
            <p className="mt-1 text-sm font-medium text-foreground">
              {openTickets} open ticket{openTickets === 1 ? '' : 's'}
            </p>
          </div>
          <div className={cn('rounded-lg border border-border bg-background', compact ? 'px-2.5 py-2' : 'px-3 py-2')}>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
              <ShieldAlert className="h-3.5 w-3.5" />
              Active moderation
            </div>
            <p className="mt-1 text-sm font-medium text-foreground">
              {activeInfractions.length > 0
                ? `${activeInfractions.length} active infraction${activeInfractions.length === 1 ? '' : 's'}`
                : 'No active infractions'}
            </p>
          </div>
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
        <CheckInsSection userId={data.user.id} />
      </CollapsibleSection>

      <CollapsibleSection
        title="Tags"
        icon={<Tag className="h-4 w-4" />}
        defaultOpen={false}
      >
        <TagsSection userId={data.user.id} />
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
          data.supervisorEntries.length > 0 && (
            <span className="text-xs text-muted-foreground ml-1">
              ({data.supervisorEntries.length})
            </span>
          )
        }
        defaultOpen={false}
      >
        <SupervisorNotesSection entries={data.supervisorEntries} />
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
                <OperationalSummary data={data} compact />
                <UserPanelSections data={data} isMobile={isMobile} />
                <TimelineFooter user={data.user} />
              </div>
            </div>
          ) : (
            <>
              <UserHeader user={data.user} />
              <OperationalSummary data={data} />

              <div className="flex-1 overflow-y-auto overscroll-contain">
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


