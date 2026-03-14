'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    type StaffDetails,
    type StaffSupervisee
} from '@/lib/hooks/queries/useStaffDetails';
import { usePrefetchUserDetails } from '@/lib/hooks/queries/useUserDetails';
import { getAssignmentStatusDescriptor, getStatusDotClassName, getUserAttributeStatusDescriptor } from '@/lib/status-system';
import { cn, roleColorToHex } from '@/lib/utils';
import {
    AlertTriangle,
    ArrowLeft,
    Check,
    ChevronDown,
    ChevronRight,
    Copy,
    Mic,
    Shield,
    ShieldCheck,
    Users
} from 'lucide-react';
import * as React from 'react';
import { useCallback, useState } from 'react';

// ============================================================================
// Utility Functions
// ============================================================================

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
// Status Dot Component
// ============================================================================

function StatusDot({ status }: { status: string | null }) {
  if (!status) return null;

  const descriptor = getAssignmentStatusDescriptor(status);

  return <span className={cn('h-2 w-2 rounded-full flex-shrink-0', getStatusDotClassName(descriptor.tone))} />;
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function StaffDetailsSkeleton() {
  return (
    <>
      {/* Header skeleton */}
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
      
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {['Supervisees', 'Roles'].map((section, i) => (
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

      {/* Stats skeleton */}
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
// Staff Header Component
// ============================================================================

interface StaffHeaderProps {
  staff: StaffDetails['staff'];
  breadcrumb?: React.ReactNode;
}

function StaffHeader({ staff, breadcrumb }: StaffHeaderProps) {
  const [copied, setCopied] = useState(false);
  
  const copyId = useCallback(() => {
    navigator.clipboard.writeText(staff.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [staff.id]);

  const displayName = staff.displayName || staff.name || 'Unknown';

  return (
    <div className="p-4 border-b border-border sticky top-0 bg-background z-10">
      {breadcrumb && <div className="mb-3">{breadcrumb}</div>}
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <Avatar className="h-16 w-16 border border-border">
          <AvatarImage src={staff.displayAvatar || undefined} />
          <AvatarFallback className="text-lg font-medium bg-muted">
            {getInitials(displayName)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          {/* Name */}
          <h2 className="text-lg font-semibold text-foreground truncate">{displayName}</h2>
          
          {/* Username and ID */}
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {staff.name && staff.displayName !== staff.name && (
              <span className="text-sm text-muted-foreground">@{staff.name}</span>
            )}
            <button
              onClick={copyId}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              title="Copy Discord ID"
            >
              {copied ? <Check className="h-3 w-3 text-status-success-text" /> : <Copy className="h-3 w-3" />}
              <span className="font-mono">{staff.id}</span>
            </button>
          </div>

          {/* Status badges */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {staff.isVerified && (
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
            {staff.isVoiceVerified && (
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
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Supervisees Section
// ============================================================================

interface SuperviseesSectionProps {
  supervisees: StaffSupervisee[];
  onSuperviseeClick: (userId: string) => void;
  onSuperviseeHover: (userId: string) => void;
}

function SuperviseesSection({ supervisees, onSuperviseeClick, onSuperviseeHover }: SuperviseesSectionProps) {
  if (supervisees.length === 0) {
    return <p className="text-sm text-muted-foreground">No active supervisees</p>;
  }

  return (
    <div className="space-y-1">
      {supervisees.map((user) => {
        const displayName = user.displayName || user.name || 'Unknown';
        return (
          <button
            key={user.id}
            onClick={() => onSuperviseeClick(user.id)}
            onMouseEnter={() => onSuperviseeHover(user.id)}
            className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors group text-left"
          >
            <Avatar className="h-8 w-8 border border-border">
              <AvatarImage src={user.displayAvatar || undefined} />
              <AvatarFallback className="text-xs bg-muted">{getInitials(displayName)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                  {displayName}
                </span>
                <StatusDot status={user.assignmentStatus} />
              </div>
              {user.displayName && user.name && user.displayName !== user.name && (
                <span className="text-xs text-muted-foreground">@{user.name}</span>
              )}
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// Roles Section
// ============================================================================

function RolesSection({ roles }: { roles: StaffDetails['roles'] }) {
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
// Stats Footer
// ============================================================================

function StatsFooter({ stats }: { stats: StaffDetails['stats'] }) {
  return (
    <div className="p-4 border-t border-border bg-muted/30">
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Users className="h-4 w-4" />
          <span><strong className="text-foreground">{stats.totalSupervisees}</strong> supervisee{stats.totalSupervisees !== 1 ? 's' : ''}</span>
        </div>
        {stats.needsSupport > 0 && (
          <Badge tone="danger" kind="status" emphasis="soft">
            {stats.needsSupport} need{stats.needsSupport !== 1 ? '' : 's'} support
          </Badge>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Panel Breadcrumb (for stacked navigation)
// ============================================================================

interface PanelBreadcrumbProps {
  staffName: string;
  userName?: string;
  onBack: () => void;
}

export function PanelBreadcrumb({ staffName, userName, onBack }: PanelBreadcrumbProps) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back</span>
      </button>
      <span className="text-muted-foreground/50">·</span>
      <span className="text-muted-foreground truncate">
        {staffName}
        {userName && (
          <>
            <span className="mx-1">→</span>
            <span className="text-foreground font-medium">{userName}</span>
          </>
        )}
      </span>
    </div>
  );
}

// ============================================================================
// Panel Content Component
// ============================================================================

interface StaffPanelContentProps {
  data: StaffDetails | undefined;
  isLoading: boolean;
  error: Error | null;
  onSuperviseeClick: (userId: string) => void;
  breadcrumb?: React.ReactNode;
}

function StaffPanelContent({ 
  data, 
  isLoading, 
  error, 
  onSuperviseeClick,
  breadcrumb,
}: StaffPanelContentProps) {
  const { prefetch: prefetchUserDetails } = usePrefetchUserDetails();

  const handleSuperviseeHover = useCallback((userId: string) => {
    prefetchUserDetails(userId);
  }, [prefetchUserDetails]);

  return (
    <>
      {isLoading && <StaffDetailsSkeleton />}
      
      {error && (
        <div className="p-4 text-center">
          <p className="text-sm text-destructive">Failed to load staff details</p>
        </div>
      )}

      {data && (
        <>
          <StaffHeader staff={data.staff} breadcrumb={breadcrumb} />
          
          {/* Operational summary — supervisee load and urgency */}
          {(data.stats.totalSupervisees > 0 || data.stats.needsSupport > 0) && (
            <div className="px-4 py-3 border-b border-border space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Supervisees</span>
                <span className="font-medium text-foreground">{data.stats.totalSupervisees}</span>
              </div>
              {data.stats.needsSupport > 0 && (
                <div className="flex items-center gap-2 rounded-md bg-status-danger-soft px-3 py-2 text-sm text-status-danger-text border border-status-danger-border">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>{data.stats.needsSupport} need{data.stats.needsSupport !== 1 ? '' : 's'} support</span>
                </div>
              )}
            </div>
          )}
          
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <CollapsibleSection
              title="Supervisees"
              icon={<Users className="h-4 w-4" />}
              badge={
                <span className="text-xs text-muted-foreground ml-1">
                  ({data.supervisees.length})
                </span>
              }
              defaultOpen={true}
            >
              <SuperviseesSection 
                supervisees={data.supervisees} 
                onSuperviseeClick={onSuperviseeClick}
                onSuperviseeHover={handleSuperviseeHover}
              />
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
          </div>

          <StatsFooter stats={data.stats} />
        </>
      )}
    </>
  );
}

// ============================================================================
// Main Export — Content only, no shell wrapper
// ============================================================================

export { StaffPanelContent, type StaffPanelContentProps };

