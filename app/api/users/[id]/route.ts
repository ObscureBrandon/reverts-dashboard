import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getUserRoles } from '@/lib/db/queries';
import { requireAuth } from '@/lib/auth-helpers';

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
    
    // Fetch user roles
    const userRolesResult = await getUserRoles(userId);
    
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
    });
  } catch (error) {
    console.error('User fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
