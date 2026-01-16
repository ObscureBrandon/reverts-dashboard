import { NextRequest, NextResponse } from 'next/server';
import { searchMessages, getMessageCount, getStaffRoles, getMentionsForMessages } from '@/lib/db/queries';
import { requireAuth } from '@/lib/auth-helpers.server';

// In-memory cache for staff role IDs (refresh every 5 minutes)
let staffRoleCache: { ids: bigint[]; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getStaffRoleIds(): Promise<bigint[]> {
  const now = Date.now();
  
  // Return cached value if still valid
  if (staffRoleCache && (now - staffRoleCache.timestamp) < CACHE_TTL) {
    return staffRoleCache.ids;
  }
  
  // Fetch fresh data
  const staffRolesData = await getStaffRoles();
  const ids = staffRolesData.map(r => r.roleId);
  
  // Update cache
  staffRoleCache = { ids, timestamp: now };
  
  return ids;
}

export async function GET(request: NextRequest) {
  // Require authentication
  const { session, error } = await requireAuth();
  if (error) return error;
  
  const searchParams = request.nextUrl.searchParams;
  
  const query = searchParams.get('q') || undefined;
  const staffOnly = searchParams.get('staffOnly') === 'true';
  const ticketId = searchParams.get('ticketId');
  const channelId = searchParams.get('channelId');
  const mode = searchParams.get('mode'); // 'search' | 'transcript'
  const page = parseInt(searchParams.get('page') || '1');
  
  // In transcript mode, use larger page size and don't require search query
  const isTranscriptMode = mode === 'transcript';
  const limit = parseInt(searchParams.get('limit') || (isTranscriptMode ? '200' : '50'));
  
  try {
    const offset = (page - 1) * limit;
    
    // Get staff role IDs for both filtering and marking staff members
    const staffRoleIds = await getStaffRoleIds();
    
    const results = await searchMessages({
      query: isTranscriptMode ? undefined : query, // Ignore query in transcript mode
      staffOnly,
      ticketId: ticketId ? parseInt(ticketId) : undefined,
      channelId: channelId ? BigInt(channelId) : undefined,
      limit,
      offset,
      staffRoleIds,
      sortOrder: isTranscriptMode ? 'asc' : 'desc', // Sort oldest to newest for transcript mode
    });
    
    // Fetch mention data for all messages
    const mentions = await getMentionsForMessages(results);
    
    const total = await getMessageCount({
      query: isTranscriptMode ? undefined : query,
      staffOnly,
      ticketId: ticketId ? parseInt(ticketId) : undefined,
      channelId: channelId ? BigInt(channelId) : undefined,
      staffRoleIds,
    });
    
    return NextResponse.json({
      messages: results.map(r => ({
        id: r.message.messageId.toString(),
        content: r.message.content,
        createdAt: r.message.createdAt?.toISOString(),
        isDeleted: r.message.isDeleted,
        isStaff: r.isStaff,
        embeds: r.message.embeds || [],
        attachments: r.message.attachments || [],
        author: r.author ? {
          id: r.author.discordId.toString(),
          name: r.author.name || r.author.displayName || r.author.nick || 'Unknown User',
          displayName: r.author.displayName,
          nick: r.author.nick,
          displayAvatar: r.author.displayAvatar,
        } : null,
        channel: r.channel ? {
          id: r.channel.channelId.toString(),
          name: r.channel.name,
        } : null,
        ticket: r.ticket ? {
          id: r.ticket.id,
          sequence: r.ticket.sequence,
          status: r.ticket.status,
          createdAt: r.ticket.createdAt?.toISOString(),
        } : null,
      })),
      mentions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      guildId: process.env.DISCORD_GUILD_ID || null,
    });
  } catch (error) {
    console.error('Message search error:', error);
    return NextResponse.json(
      { error: 'Failed to search messages', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
