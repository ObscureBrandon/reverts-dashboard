import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { getUserCount, searchUsers } from '@/lib/db/queries';
import { authAccount } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Require authentication
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Parse query parameters
    const query = searchParams.get('q') || undefined;
    const assignmentStatus = searchParams.get('assignmentStatus') as 
      'NEEDS_SUPPORT' | 'INACTIVE' | 'SELF_SUFFICIENT' | 'PAUSED' | 'NOT_READY' | undefined;
    const relationToIslam = searchParams.get('relationToIslam') || undefined;
    const inGuildParam = searchParams.get('inGuild');
    const verifiedParam = searchParams.get('verified');
    const voiceVerifiedParam = searchParams.get('voiceVerified');
    const roleIdParam = searchParams.get('roleId');
    const assignedToMeParam = searchParams.get('assignedToMe');
    const sortBy = (searchParams.get('sortBy') || 'createdAt') as 'name' | 'createdAt';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = (page - 1) * limit;

    // Convert string params to proper types
    const inGuild = inGuildParam === 'true' ? true : inGuildParam === 'false' ? false : undefined;
    const verified = verifiedParam === 'true' ? true : verifiedParam === 'false' ? false : undefined;
    const voiceVerified = voiceVerifiedParam === 'true' ? true : voiceVerifiedParam === 'false' ? false : undefined;
    const roleId = roleIdParam ? BigInt(roleIdParam) : undefined;
    
    // Get the current user's Discord ID if assignedToMe filter is active
    let supervisorId: bigint | undefined;
    if (assignedToMeParam === 'true' && session?.user?.id) {
      const account = await db
        .select({ accountId: authAccount.accountId })
        .from(authAccount)
        .where(eq(authAccount.userId, session.user.id))
        .limit(1);
      
      if (account.length > 0) {
        supervisorId = BigInt(account[0].accountId);
      }
    }

    const params = {
      query,
      assignmentStatus,
      relationToIslam,
      inGuild,
      verified,
      voiceVerified,
      roleId,
      supervisorId,
      sortBy,
      sortOrder,
      limit,
      offset,
    };

    // Fetch users and count in parallel
    const [usersResult, total] = await Promise.all([
      searchUsers(params),
      getUserCount(params),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      users: usersResult.map(result => ({
        id: result.user.discordId.toString(),
        name: result.user.name,
        displayName: result.user.displayName,
        displayAvatar: result.user.displayAvatar,
        inGuild: result.user.inGuild,
        isVerified: result.user.isVerified,
        isVoiceVerified: result.user.isVoiceVerified,
        relationToIslam: result.user.relationToIslam,
        gender: result.user.gender,
        age: result.user.age,
        region: result.user.region,
        currentAssignmentStatus: result.currentAssignmentStatus,
        topRoles: result.topRoles,
        createdAt: result.user.createdAt.toISOString(),
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    });
  } catch (err) {
    console.error('Error fetching users:', err);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
