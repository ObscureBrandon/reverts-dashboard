import { NextResponse } from 'next/server';
import { getAllPanels } from '@/lib/db/queries';
import { requireAuth } from '@/lib/auth-helpers';

export async function GET() {
  // Require authentication
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    const panels = await getAllPanels();
    
    // Panels rarely change, cache for 5 minutes
    return NextResponse.json(
      { panels },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching panels:', error);
    return NextResponse.json(
      { error: 'Failed to fetch panels' },
      { status: 500 }
    );
  }
}
