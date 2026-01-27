import { requireAuth } from '@/lib/auth-helpers';
import { getDistinctRelationsToIslam } from '@/lib/db/queries';
import { NextResponse } from 'next/server';

export async function GET() {
  // Require authentication
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    const relations = await getDistinctRelationsToIslam();

    return NextResponse.json({
      relations,
    });
  } catch (err) {
    console.error('Error fetching relations to Islam:', err);
    return NextResponse.json(
      { error: 'Failed to fetch relations' },
      { status: 500 }
    );
  }
}
