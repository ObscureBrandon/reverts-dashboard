'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerTitle,
} from '@/components/ui/drawer';
import { Skeleton } from '@/components/ui/skeleton';
import {
    useUserDetails,
    type UserDetails
} from '@/lib/hooks/queries/useUserDetails';
import { cn, formatRelativeTime, roleColorToHex } from '@/lib/utils';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import {
    AlertTriangle,
    Ban,
    BookOpen,
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
    Shield,
    ShieldAlert,
    ShieldCheck,
    Star,
    Ticket,
    Timer,
    User,
    UserMinus,
    UserX,
    Users,
    Venus,
    VolumeX,
    X
} from 'lucide-react';
import * as React from 'react';
import { useCallback, useState } from 'react';

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
  const config: Record<string, { bg: string; text: string; label: string }> = {
    NEEDS_SUPPORT: { bg: 'bg-red-100 dark:bg-red-950', text: 'text-red-700 dark:text-red-400', label: 'Needs Support' },
    INACTIVE: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-400', label: 'Inactive' },
    SELF_SUFFICIENT: { bg: 'bg-emerald-100 dark:bg-emerald-950', text: 'text-emerald-700 dark:text-emerald-400', label: 'Self-Sufficient' },
    PAUSED: { bg: 'bg-amber-100 dark:bg-amber-950', text: 'text-amber-700 dark:text-amber-400', label: 'Paused' },
    NOT_READY: { bg: 'bg-amber-100 dark:bg-amber-950', text: 'text-amber-700 dark:text-amber-400', label: 'Not Ready' },
  };

  const { bg, text, label } = config[status] || { bg: 'bg-gray-100', text: 'text-gray-700', label: status };

  return (
    <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium', bg, text)}>
      {label}
    </span>
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
// Supervision Need Type Labels
// ============================================================================

const needTypeLabels: Record<string, { label: string; icon: React.ReactNode }> = {
  PRAYER_HELP: { label: 'Prayer Help', icon: <Star className="h-3.5 w-3.5" /> },
  QURAN_LEARNING: { label: 'Quran Learning', icon: <BookOpen className="h-3.5 w-3.5" /> },
  FAMILY_ISSUES: { label: 'Family Issues', icon: <Users className="h-3.5 w-3.5" /> },
  NEW_CONVERT_QUESTIONS: { label: 'New Convert Questions', icon: <Heart className="h-3.5 w-3.5" /> },
  ARABIC_LEARNING: { label: 'Arabic Learning', icon: <Globe className="h-3.5 w-3.5" /> },
  ISLAMIC_HISTORY: { label: 'Islamic History', icon: <BookOpen className="h-3.5 w-3.5" /> },
  COMMUNITY_INTEGRATION: { label: 'Community Integration', icon: <Users className="h-3.5 w-3.5" /> },
  SPIRITUAL_GUIDANCE: { label: 'Spiritual Guidance', icon: <Heart className="h-3.5 w-3.5" /> },
};

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

function UserDetailsSkeleton() {
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
      
      {/* Scrollable content area - matches collapsed sections on mobile */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {/* Section headers skeleton - 6 collapsed sections */}
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

      {/* Footer skeleton - matches TimelineFooter */}
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
        {/* Avatar with status ring */}
        <Avatar className={cn(
          'h-16 w-16 ring-2',
          !user.inGuild ? 'ring-gray-400' : 
            user.isVerified ? 'ring-emerald-500' : 'ring-border'
        )}>
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
              <Badge variant="secondary" className="gap-1 text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950">
                <UserX className="h-3 w-3" />
                Left Server
              </Badge>
            )}
            {user.isVerified && (
              <Badge variant="secondary" className="gap-1 text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950">
                <ShieldCheck className="h-3 w-3" />
                Verified
              </Badge>
            )}
            {user.isVoiceVerified && (
              <Badge variant="secondary" className="gap-1 text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-950">
                <Mic className="h-3 w-3" />
                Voice
              </Badge>
            )}
            {relationIsRevert && (
              <Badge variant="secondary" className="gap-1 text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950">
                <Heart className="h-3 w-3" />
                Revert
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
  // Gender-specific styling
  const getGenderConfig = (gender: string | null) => {
    if (!gender) return null;
    const lowerGender = gender.toLowerCase();
    if (lowerGender === 'male' || lowerGender === 'm') {
      return {
        label: 'Male',
        icon: <Mars className="h-3 w-3" />,
        className: 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400',
      };
    }
    if (lowerGender === 'female' || lowerGender === 'f') {
      return {
        label: 'Female',
        icon: <Venus className="h-3 w-3" />,
        className: 'bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-400',
      };
    }
    // Default for other values
    return {
      label: gender,
      icon: <User className="h-3 w-3" />,
      className: 'bg-muted',
    };
  };

  const genderConfig = getGenderConfig(user.gender);
  
  const pills = [
    user.age && { label: user.age, icon: <Calendar className="h-3 w-3" />, className: 'bg-muted' },
    user.region && { label: user.region, icon: <Globe className="h-3 w-3" />, className: 'bg-muted' },
  ].filter(Boolean) as { label: string; icon: React.ReactNode; className: string }[];

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
          {/* Gender pill with special styling */}
          {genderConfig && (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                genderConfig.className
              )}
            >
              {genderConfig.icon}
              {genderConfig.label}
            </span>
          )}
          {/* Other pills */}
          {pills.map((pill, i) => (
            <span
              key={i}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                pill.className
              )}
            >
              <span className="text-muted-foreground">{pill.icon}</span>
              {pill.label}
            </span>
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
  supervisionNeeds,
  supervisors,
}: {
  shahadas: UserDetails['shahadas'];
  assignmentHistory: UserDetails['assignmentHistory'];
  supervisionNeeds: UserDetails['supervisionNeeds'];
  supervisors: UserDetails['supervisors'];
}) {
  const currentAssignment = assignmentHistory.find((a) => a.active);
  const activeNeeds = supervisionNeeds.filter((n) => !n.resolvedAt);
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

      {/* Active Supervision Needs */}
      {activeNeeds.length > 0 && (
        <div className="space-y-2">
          <span className="text-sm font-medium">Supervision Needs</span>
          <div className="flex flex-wrap gap-1.5">
            {activeNeeds.map((need) => {
              const needInfo = needTypeLabels[need.needType] || { label: need.needType, icon: null };
              const severityColors = ['', 'bg-gray-100 dark:bg-gray-800', 'bg-blue-100 dark:bg-blue-950', 
                'bg-amber-100 dark:bg-amber-950', 'bg-orange-100 dark:bg-orange-950', 'bg-red-100 dark:bg-red-950'];
              
              return (
                <span
                  key={need.id}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
                    severityColors[need.severity] || 'bg-muted'
                  )}
                  title={need.notes || undefined}
                >
                  {needInfo.icon}
                  {needInfo.label}
                </span>
              );
            })}
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

      {/* Empty state */}
      {!hasShahada && !currentAssignment && activeNeeds.length === 0 && activeSupervisors.length === 0 && (
        <p className="text-sm text-muted-foreground">No revert journey information</p>
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
          className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
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
      {/* Stat cards row */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950">
            <Ticket className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <div className="text-lg font-semibold">{ticketStats.open}</div>
            <div className="text-xs text-muted-foreground">Open</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-muted">
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <div className="text-lg font-semibold">{ticketStats.closed}</div>
            <div className="text-xs text-muted-foreground">Closed</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-red-100 dark:bg-red-950">
            <Ticket className="h-4 w-4 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <div className="text-lg font-semibold">{ticketStats.deleted}</div>
            <div className="text-xs text-muted-foreground">Deleted</div>
          </div>
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
                    'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium',
                    ticket.status === 'OPEN' 
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                      : ticket.status === 'DELETED'
                        ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
                        : 'bg-muted text-muted-foreground'
                  )}>
                    {ticket.status}
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

// ============================================================================
// Shared Panel Content Component
// ============================================================================

function PanelContent({ 
  data, 
  isLoading, 
  error, 
  isMobile,
  breadcrumb,
}: { 
  data: UserDetails | undefined; 
  isLoading: boolean; 
  error: Error | null;
  isMobile: boolean;
  breadcrumb?: React.ReactNode;
}) {
  return (
    <>
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
          <UserHeader user={data.user} />
          
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <CollapsibleSection
              title="Profile"
              icon={<User className="h-4 w-4" />}
              defaultOpen={!isMobile}
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
              defaultOpen={!isMobile}
            >
              <RolesSection roles={data.roles} />
            </CollapsibleSection>

            <CollapsibleSection
              title="Revert Journey"
              icon={<Heart className="h-4 w-4" />}
              defaultOpen={!isMobile}
            >
              <RevertJourneySection
                shahadas={data.shahadas}
                assignmentHistory={data.assignmentHistory}
                supervisionNeeds={data.supervisionNeeds}
                supervisors={data.supervisors}
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
              defaultOpen={!isMobile}
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
              defaultOpen={false}
            >
              <ModerationSection infractions={data.infractions} />
            </CollapsibleSection>

            <CollapsibleSection
              title="Tickets"
              icon={<Ticket className="h-4 w-4" />}
              defaultOpen={!isMobile}
            >
              <TicketsSection 
                ticketStats={data.ticketStats} 
                recentTickets={data.recentTickets}
                userId={data.user.id}
              />
            </CollapsibleSection>
          </div>

          <TimelineFooter user={data.user} />
        </>
      )}
    </>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface UserDetailsPanelProps {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  breadcrumb?: React.ReactNode;
}

export function UserDetailsPanel({ userId, open, onOpenChange, breadcrumb }: UserDetailsPanelProps) {
  const { data, isLoading, error } = useUserDetails(userId);
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);
  
  // Detect mobile
  const [isMobile, setIsMobile] = useState(false);
  
  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Escape key to close panel
  React.useEffect(() => {
    if (!open || isMobile) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, isMobile, onOpenChange]);

  // Focus close button when panel opens
  React.useEffect(() => {
    if (open && !isMobile && closeButtonRef.current) {
      // Small delay to ensure the panel is visible before focusing
      const timer = setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open, isMobile]);

  // Mobile: Use Drawer with swipe gestures
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85vh] flex flex-col p-0">
          {/* Visually hidden title for accessibility */}
          <VisuallyHidden.Root>
            <DrawerTitle>User Details</DrawerTitle>
            <DrawerDescription>Detailed information about the selected user</DrawerDescription>
          </VisuallyHidden.Root>

          <PanelContent data={data} isLoading={isLoading} error={error} isMobile={isMobile} breadcrumb={breadcrumb} />
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop/Tablet: Use fixed positioned panel with slide animation
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="User details"
      className={cn(
        'fixed top-0 right-0 h-full w-[420px] bg-background border-l border-border shadow-lg',
        'flex flex-col overflow-hidden z-50',
        'transform transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
        open ? 'translate-x-0' : 'translate-x-full'
      )}
      style={{ willChange: 'transform' }}
    >
      {/* Close button */}
      <button
        ref={closeButtonRef}
        onClick={() => onOpenChange(false)}
        className="absolute top-4 right-4 z-20 p-1.5 rounded-md bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        aria-label="Close panel"
      >
        <X className="h-4 w-4" />
      </button>

      <PanelContent data={data} isLoading={isLoading} error={error} isMobile={isMobile} breadcrumb={breadcrumb} />
    </div>
  );
}
