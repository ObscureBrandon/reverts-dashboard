import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, tickets } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getUserRoles, getUserTicketStats, getTickets } from '@/lib/db/queries';
import { requireAuth } from '@/lib/auth-helpers.server';

/**
 * Combined endpoint for user popover data
 * Fetches all required data in a single request:
 * - User details
 * - User roles
 * - Ticket statistics
 * - Recent tickets
 */
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
    
    // Fetch all data in parallel for maximum performance
    const [userResult, userRolesResult, ticketStats, recentTicketsResult] = await Promise.all([
      // 1. User details
      db
        .select()
        .from(users)
        .where(eq(users.discordId, userId))
        .limit(1),
      
      // 2. User roles
      getUserRoles(userId),
      
      // 3. Ticket statistics (open/closed counts)
      getUserTicketStats(userId),
      
      // 4. Recent tickets (5 most recent)
      getTickets({
        authorId: userId,
        limit: 5,
        sortBy: 'newest',
      }),
    ]);
    
    if (!userResult[0]) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    const user = userResult[0];
    
    // Format response
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
      ticketStats: {
        open: ticketStats.open,
        closed: ticketStats.closed,
      },
      recentTickets: recentTicketsResult.map(t => ({
        id: t.ticket.id,
        sequence: t.ticket.sequence,
        status: t.ticket.status,
        createdAt: t.ticket.createdAt.toISOString(),
      })),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    console.error('User popover data fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user popover data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
