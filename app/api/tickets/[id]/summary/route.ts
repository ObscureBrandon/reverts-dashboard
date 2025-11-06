import { NextRequest, NextResponse } from 'next/server';
import { generateTicketSummary } from '@/lib/ai/gemini';
import { db } from '@/lib/db';
import { tickets } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth-helpers';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Require authentication
  const { session, error } = await requireAuth();
  if (error) return error;
  
  try {
    const { id } = await params;
    const ticketId = parseInt(id);

    if (isNaN(ticketId)) {
      return NextResponse.json(
        { error: 'Invalid ticket ID' },
        { status: 400 }
      );
    }

    // Generate the summary
    const { summary, tokensUsed, model } = await generateTicketSummary(ticketId);

    // Update the ticket with the summary
    await db
      .update(tickets)
      .set({
        summary,
        summaryGeneratedAt: new Date(),
        summaryModel: model,
        summaryTokensUsed: tokensUsed,
      })
      .where(eq(tickets.id, ticketId));

    return NextResponse.json({
      success: true,
      summary,
      tokensUsed,
      model,
    });
  } catch (error) {
    console.error('Error generating ticket summary:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate summary';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
