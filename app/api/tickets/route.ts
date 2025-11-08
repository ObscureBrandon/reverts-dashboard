import { NextRequest, NextResponse } from 'next/server';
import { getTickets, getTicketCount, getTicketById } from '@/lib/db/queries';
import { requireAuth } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  // Require authentication
  const { session, error } = await requireAuth();
  if (error) return error;
  
  const searchParams = request.nextUrl.searchParams;
  
  const ticketId = searchParams.get('id');
  
  // If requesting a specific ticket by ID
  if (ticketId) {
    try {
      const ticket = await getTicketById(parseInt(ticketId));
      
      if (!ticket) {
        return NextResponse.json(
          { error: 'Ticket not found' },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        ticket: {
          id: ticket.ticket.id,
          sequence: ticket.ticket.sequence,
          status: ticket.ticket.status,
          createdAt: ticket.ticket.createdAt?.toISOString(),
          closedAt: ticket.ticket.closedAt?.toISOString(),
          author: ticket.author ? {
            id: ticket.author.discordId.toString(),
            name: ticket.author.name || ticket.author.displayName || 'Unknown User',
            displayName: ticket.author.displayName,
            displayAvatar: ticket.author.displayAvatar,
          } : null,
          channel: ticket.channel ? {
            id: ticket.channel.channelId.toString(),
            name: ticket.channel.name,
          } : null,
          panel: ticket.panel ? {
            id: ticket.panel.id,
            title: ticket.panel.title,
          } : null,
          messageCount: ticket.messageCount || 0,
          summary: ticket.ticket.summary,
          summaryGeneratedAt: ticket.ticket.summaryGeneratedAt?.toISOString(),
          summaryModel: ticket.ticket.summaryModel,
          summaryTokensUsed: ticket.ticket.summaryTokensUsed,
        }
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      });
    } catch (error) {
      console.error('Ticket fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch ticket', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  }
  
  // Otherwise, return list of tickets
  const status = searchParams.get('status') as 'OPEN' | 'CLOSED' | 'DELETED' | null;
  const authorIdParam = searchParams.get('author');
  const panelParam = searchParams.get('panel');
  const search = searchParams.get('search') || undefined;
  const sortBy = searchParams.get('sortBy') as 'newest' | 'oldest' | 'messages' | null;
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  
  try {
    const offset = (page - 1) * limit;
    
    // Parse authorId and panelId if provided
    const authorId = authorIdParam ? BigInt(authorIdParam) : undefined;
    const panelId = panelParam ? parseInt(panelParam) : undefined;
    
    const results = await getTickets({
      status: status || undefined,
      authorId,
      panelId,
      search,
      sortBy: sortBy || 'newest',
      limit,
      offset,
    });
    
    const total = await getTicketCount({
      status: status || undefined,
      authorId,
      panelId,
      search,
    });
    
    return NextResponse.json({
      tickets: results.map(r => ({
        id: r.ticket.id,
        sequence: r.ticket.sequence,
        status: r.ticket.status,
        createdAt: r.ticket.createdAt?.toISOString(),
        closedAt: r.ticket.closedAt?.toISOString(),
        author: r.author ? {
          id: r.author.discordId.toString(),
          name: r.author.name || r.author.displayName || 'Unknown User',
          displayName: r.author.displayName,
          displayAvatar: r.author.displayAvatar,
        } : null,
        channel: r.channel ? {
          id: r.channel.channelId.toString(),
          name: r.channel.name,
        } : null,
        panel: r.panel ? {
          id: r.panel.id,
          title: r.panel.title,
        } : null,
        messageCount: r.messageCount || 0,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    console.error('Tickets list error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tickets', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
