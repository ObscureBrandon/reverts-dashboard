import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import {
    getUserAssignmentHistory,
    getUserInfractions,
    getUserRoles,
    getUserShahadas,
    getUserSupervisionNeeds,
    getUserSupervisorEntries,
    getUserSupervisors,
    getUserTicketStats
} from '@/lib/db/queries';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Require authentication
  const { session, error } = await requireAuth();
  if (error) return error;
  
  try {
    const { id } = await params;
    const userId = BigInt(id);
    
    // Check if full profile is requested
    const searchParams = request.nextUrl.searchParams;
    const fullProfile = searchParams.get('full') === 'true';
    
    // Fetch user details
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.discordId, userId))
      .limit(1);
    
    if (!userResult[0]) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    const user = userResult[0];
    
    // Fetch user roles (always included)
    const userRolesResult = await getUserRoles(userId);
    
    // For full profile, fetch all related data in parallel
    if (fullProfile) {
      const [
        shahadas,
        supervisors,
        assignmentHistory,
        supervisionNeeds,
        infractions,
        supervisorEntries,
        ticketStats,
      ] = await Promise.all([
        getUserShahadas(userId),
        getUserSupervisors(userId),
        getUserAssignmentHistory(userId),
        getUserSupervisionNeeds(userId),
        getUserInfractions(userId),
        getUserSupervisorEntries(userId),
        getUserTicketStats(userId),
      ]);

      return NextResponse.json({
        user: {
          id: user.discordId.toString(),
          name: user.name,
          displayName: user.displayName,
          displayAvatar: user.displayAvatar,
          nick: user.nick,
          inGuild: user.inGuild,
          isVerified: user.isVerified,
          isVoiceVerified: user.isVoiceVerified,
          relationToIslam: user.relationToIslam,
          gender: user.gender,
          age: user.age,
          region: user.region,
          religiousAffiliation: user.religiousAffiliation,
          wantsDiscussion: user.wantsDiscussion,
          createdAt: user.createdAt.toISOString(),
        },
        roles: userRolesResult.map(r => ({
          id: r.role.roleId.toString(),
          name: r.role.name,
          color: r.role.color,
          position: r.role.position,
        })),
        shahadas: shahadas.map(s => ({
          id: s.id,
          createdAt: s.createdAt.toISOString(),
          supervisor: s.supervisorId ? {
            id: s.supervisorId.toString(),
            name: s.supervisorName,
            displayName: s.supervisorDisplayName,
            avatar: s.supervisorAvatar,
          } : null,
        })),
        supervisors: supervisors.map(s => ({
          id: s.id,
          active: s.active,
          createdAt: s.createdAt.toISOString(),
          supervisor: s.supervisorId ? {
            id: s.supervisorId.toString(),
            name: s.supervisorName,
            displayName: s.supervisorDisplayName,
            avatar: s.supervisorAvatar,
          } : null,
        })),
        assignmentHistory: assignmentHistory.map(a => ({
          id: a.id,
          status: a.status,
          priority: a.priority,
          notes: a.notes,
          active: a.active,
          createdAt: a.createdAt.toISOString(),
          resolvedAt: a.resolvedAt?.toISOString() || null,
          addedBy: a.addedById ? {
            id: a.addedById.toString(),
            name: a.addedByName,
          } : null,
          resolvedBy: a.resolvedById ? {
            id: a.resolvedById.toString(),
            name: a.resolvedByName,
          } : null,
        })),
        supervisionNeeds: supervisionNeeds.map(n => ({
          id: n.id,
          needType: n.needType,
          severity: n.severity,
          notes: n.notes,
          createdAt: n.createdAt.toISOString(),
          resolvedAt: n.resolvedAt?.toISOString() || null,
          addedBy: n.addedById ? {
            id: n.addedById.toString(),
            name: n.addedByName,
          } : null,
        })),
        infractions: infractions.map(i => ({
          id: i.id,
          type: i.type,
          status: i.status,
          reason: i.reason,
          hidden: i.hidden,
          jumpUrl: i.jumpUrl,
          expiresAt: i.expiresAt?.toISOString() || null,
          createdAt: i.createdAt.toISOString(),
          moderator: i.moderatorId ? {
            id: i.moderatorId.toString(),
            name: i.moderatorName,
          } : null,
          pardonedBy: i.pardonedById ? {
            id: i.pardonedById.toString(),
            at: i.pardonedAt?.toISOString() || null,
            reason: i.pardonReason,
          } : null,
        })),
        supervisorEntries: supervisorEntries.map(e => ({
          id: e.id,
          note: e.note,
          createdAt: e.createdAt.toISOString(),
          supervisor: e.supervisorId ? {
            id: e.supervisorId.toString(),
            name: e.supervisorName,
            displayName: e.supervisorDisplayName,
          } : null,
        })),
        ticketStats,
      });
    }
    
    // Basic response (backwards compatible)
    return NextResponse.json({
      user: {
        id: user.discordId.toString(),
        name: user.name,
        displayName: user.displayName,
        displayAvatar: user.displayAvatar,
        nick: user.nick,
        inGuild: user.inGuild,
        isVerified: user.isVerified,
        isVoiceVerified: user.isVoiceVerified,
      },
      roles: userRolesResult.map(r => ({
        id: r.role.roleId.toString(),
        name: r.role.name,
        color: r.role.color,
        position: r.role.position,
      })),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('User fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
