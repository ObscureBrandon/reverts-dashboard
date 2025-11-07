import { NextResponse } from 'next/server';
import { getAllPanels } from '@/lib/db/queries';

export async function GET() {
  try {
    const panels = await getAllPanels();
    return NextResponse.json({ panels });
  } catch (error) {
    console.error('Error fetching panels:', error);
    return NextResponse.json(
      { error: 'Failed to fetch panels' },
      { status: 500 }
    );
  }
}
