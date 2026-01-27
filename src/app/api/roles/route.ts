import { requireAuth } from '@/lib/auth-helpers';
import { getAllRoles } from '@/lib/db/queries';
import { NextResponse } from 'next/server';

export async function GET() {
  // Require authentication
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    const roles = await getAllRoles();

    return NextResponse.json({
      roles: roles.map(role => ({
        id: role.id.toString(),
        name: role.name,
        color: role.color,
        position: role.position,
      })),
    });
  } catch (err) {
    console.error('Error fetching roles:', err);
    return NextResponse.json(
      { error: 'Failed to fetch roles' },
      { status: 500 }
    );
  }
}
