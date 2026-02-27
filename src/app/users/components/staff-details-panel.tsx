'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerTitle,
} from '@/components/ui/drawer';
import { Skeleton } from '@/components/ui/skeleton';
import {
    useStaffDetails,
    type StaffDetails,
    type StaffSupervisee
} from '@/lib/hooks/queries/useStaffDetails';
import { usePrefetchUserDetails } from '@/lib/hooks/queries/useUserDetails';
import { cn, roleColorToHex } from '@/lib/utils';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import {
    ArrowLeft,
    Check,
    ChevronDown,
    ChevronRight,
    Copy,
    Mic,
    Shield,
    ShieldCheck,
    Users,
    X
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
  const config: Record<string, { color: string; label: string }> = {
    'NEEDS_SUPPORT': { color: 'bg-red-500', label: 'Needs Support' },
    'INACTIVE': { color: 'bg-gray-400', label: 'Inactive' },
    'SELF_SUFFICIENT': { color: 'bg-emerald-500', label: 'Self-Sufficient' },
    'PAUSED': { color: 'bg-amber-500', label: 'Paused' },
    'NOT_READY': { color: 'bg-amber-400', label: 'Not Ready' },
  };
  
  if (!status) return null;
  
  const { color } = config[status] || { color: 'bg-gray-400' };
  
  return <span className={`w-2 h-2 rounded-full ${color} flex-shrink-0`} />;
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
        <Avatar className={cn(
          'h-16 w-16 ring-2',
          staff.isVerified ? 'ring-emerald-500' : 'ring-border'
        )}>
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
              {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
              <span className="font-mono">{staff.id}</span>
            </button>
          </div>

          {/* Status badges */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {staff.isVerified && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                <ShieldCheck className="h-3 w-3" />
                Verified
              </span>
            )}
            {staff.isVoiceVerified && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400">
                <Mic className="h-3 w-3" />
                Voice
              </span>
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
                <span className="text-sm font-medium truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
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
          <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span>{stats.needsSupport} need{stats.needsSupport !== 1 ? '' : 's'} support</span>
          </div>
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
  isMobile: boolean;
  onSuperviseeClick: (userId: string) => void;
  breadcrumb?: React.ReactNode;
}

function StaffPanelContent({ 
  data, 
  isLoading, 
  error, 
  isMobile,
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
          
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <CollapsibleSection
              title="Roles"
              icon={<Shield className="h-4 w-4" />}
              badge={
                <span className="text-xs text-muted-foreground ml-1">
                  ({data.roles.length})
                </span>
              }
              defaultOpen={true}
            >
              <RolesSection roles={data.roles} />
            </CollapsibleSection>

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
          </div>

          <StatsFooter stats={data.stats} />
        </>
      )}
    </>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface StaffDetailsPanelProps {
  staffId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuperviseeClick: (userId: string) => void;
  breadcrumb?: React.ReactNode;
}

export function StaffDetailsPanel({ 
  staffId, 
  open, 
  onOpenChange, 
  onSuperviseeClick,
  breadcrumb,
}: StaffDetailsPanelProps) {
  const { data, isLoading, error } = useStaffDetails(staffId);
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);
  
  // Detect mobile
  const [isMobile, setIsMobile] = useState(false);
  
  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Focus close button when panel opens
  React.useEffect(() => {
    if (open && !isMobile && closeButtonRef.current) {
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
          <VisuallyHidden.Root>
            <DrawerTitle>Staff Details</DrawerTitle>
            <DrawerDescription>Detailed information about the staff member</DrawerDescription>
          </VisuallyHidden.Root>

          <StaffPanelContent 
            data={data} 
            isLoading={isLoading} 
            error={error} 
            isMobile={isMobile}
            onSuperviseeClick={onSuperviseeClick}
            breadcrumb={breadcrumb}
          />
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop/Tablet: Use fixed positioned panel with slide animation
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Staff details"
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

      <StaffPanelContent 
        data={data} 
        isLoading={isLoading} 
        error={error} 
        isMobile={isMobile}
        onSuperviseeClick={onSuperviseeClick}
        breadcrumb={breadcrumb}
      />
    </div>
  );
}
