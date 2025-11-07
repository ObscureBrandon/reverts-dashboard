import { NextRequest, NextResponse } from 'next/server';
import { getUserTicketStats } from '@/lib/db/queries';
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
    
    // Fetch optimized ticket stats in a single query
    const stats = await getUserTicketStats(userId);
    
    return NextResponse.json({
      open: stats.open,
      closed: stats.closed,
    });
  } catch (error) {
    console.error('User ticket stats fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ticket stats', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
