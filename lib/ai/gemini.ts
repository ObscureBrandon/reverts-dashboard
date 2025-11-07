import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '@/lib/db';
import { messages, users, tickets, panels, infractions, infractionAppeals } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

export type TicketContext = {
  ticketId: number;
  panelId: number;
  panelTitle: string;
  authorName: string;
  status: string;
  createdAt: Date;
  closedAt: Date | null;
  messages: Array<{
    content: string | null;
    authorName: string;
    isStaff: boolean;
    createdAt: Date;
  }>;
  userProfile?: {
    relationToIslam?: string | null;
    gender?: string | null;
    age?: string | null;
    region?: string | null;
    religiousAffiliation?: string | null;
    isVerified: boolean;
    isVoiceVerified: boolean;
  };
  jailInfo?: {
    reason: string | null;
    appeal: string | null;
  };
};

/**
 * Fetches ticket context including messages and user profile
 */
export async function getTicketContext(ticketId: number): Promise<TicketContext | null> {
  // Get ticket details
  const ticketResult = await db
    .select({
      ticket: tickets,
      author: users,
      panel: panels,
    })
    .from(tickets)
    .leftJoin(users, eq(tickets.authorId, users.discordId))
    .leftJoin(panels, eq(tickets.panelId, panels.id))
    .where(eq(tickets.id, ticketId))
    .limit(1);

  if (!ticketResult[0]) {
    return null;
  }

  const { ticket, author, panel } = ticketResult[0];

  // Get active JAIL infraction for the ticket author (if any)
  let jailInfo: { reason: string | null; appeal: string | null } | undefined;
  if (author) {
    const jailResult = await db
      .select({
        reason: infractions.reason,
        appealText: infractionAppeals.appealText,
      })
      .from(infractions)
      .leftJoin(infractionAppeals, eq(infractions.id, infractionAppeals.infractionId))
      .where(
        and(
          eq(infractions.userId, author.discordId),
          eq(infractions.type, 'JAIL'),
          eq(infractions.status, 'ACTIVE')
        )
      )
      .limit(1);

    if (jailResult[0]) {
      jailInfo = {
        reason: jailResult[0].reason,
        appeal: jailResult[0].appealText,
      };
    }
  }

  // Get all non-deleted messages for this ticket
  const ticketMessages = await db
    .select({
      content: messages.content,
      authorId: messages.authorId,
      authorName: users.name,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .leftJoin(users, eq(messages.authorId, users.discordId))
    .where(
      and(
        eq(messages.channelId, ticket.channelId!),
        eq(messages.isDeleted, false)
      )
    )
    .orderBy(messages.createdAt);

  // Get staff role IDs to determine if message author is staff
  // For now, we'll use a simple heuristic: the ticket author is not staff, others likely are
  const formattedMessages = ticketMessages.map((msg) => ({
    content: msg.content,
    authorName: msg.authorName || 'Unknown User',
    isStaff: msg.authorId !== ticket.authorId,
    createdAt: msg.createdAt,
  }));

  return {
    ticketId: ticket.id,
    panelId: ticket.panelId,
    panelTitle: panel?.title || 'Unknown Panel',
    authorName: author?.name || author?.displayName || 'Unknown User',
    status: ticket.status || 'UNKNOWN',
    createdAt: ticket.createdAt,
    closedAt: ticket.closedAt,
    messages: formattedMessages,
    userProfile: author
      ? {
        relationToIslam: author.relationToIslam,
        gender: author.gender,
        age: author.age,
        region: author.region,
        religiousAffiliation: author.religiousAffiliation,
        isVerified: author.isVerified,
        isVoiceVerified: author.isVoiceVerified,
      }
      : undefined,
    jailInfo,
  };
}

/**
 * Generates a context-aware prompt based on ticket type (panel_id)
 */
function generatePrompt(context: TicketContext): string {
  const { panelTitle, authorName, userProfile, messages } = context;

  // Build user profile context
  let userContext = `User: ${authorName}`;
  if (userProfile) {
    const profileDetails = [];
    if (userProfile.gender) profileDetails.push(`Gender: ${userProfile.gender}`);
    if (userProfile.age) profileDetails.push(`Age: ${userProfile.age}`);
    if (userProfile.relationToIslam) profileDetails.push(`Relation to Islam: ${userProfile.relationToIslam}`);
    if (userProfile.religiousAffiliation) profileDetails.push(`Religious Affiliation: ${userProfile.religiousAffiliation}`);
    if (userProfile.region) profileDetails.push(`Region: ${userProfile.region}`);
    if (userProfile.isVerified) profileDetails.push('✓ Verified');
    if (userProfile.isVoiceVerified) profileDetails.push('✓ Voice Verified');

    if (profileDetails.length > 0) {
      userContext += `\n${profileDetails.join(', ')}`;
    }
  }

  // Format conversation
  const conversation = messages
    .map((msg) => {
      const role = msg.isStaff ? 'Staff' : authorName;
      return `${role}: ${msg.content || '[No content]'}`;
    })
    .join('\n\n');

  // Base instruction for all ticket types
  let baseInstruction = `You are summarizing a support ticket from a gender-segregated Islamic Discord server. Provide a clear, concise summary (2-4 sentences) focusing on the key issue, actions taken, and outcome.`;

  // Customize prompt based on ticket type
  let specificGuidance = '';
  const panelLower = panelTitle.toLowerCase();

  if (panelLower.includes('verification') || panelLower.includes('verify')) {
    specificGuidance = `
This is a VERIFICATION ticket. Focus on:
- What type of verification was requested (age, gender, religious affiliation)
- User's demographics and stated information
- Whether verification was completed successfully, if it was verification only or verification and voice verification
- Any concerns or special notes from the verification process`;
  } else if (panelLower.includes('jail')) {
    let jailContext = '';
    if (context.jailInfo) {
      if (context.jailInfo.reason) {
        jailContext += `\nJail Reason: ${context.jailInfo.reason}`;
      }
      if (context.jailInfo.appeal) {
        jailContext += `\nUser's Appeal: ${context.jailInfo.appeal}`;
      }
    }
    specificGuidance = `
This is a JAIL ticket (for moderation issues). Focus on:
- Reason the user was jailed${context.jailInfo?.reason ? ' (provided below)' : ''}
- User's response and explanation${context.jailInfo?.appeal ? ' (appeal provided below)' : ''}
- Staff decision and resolution
- Whether the issue was resolved and how${jailContext}`;
  } else if (panelLower.includes('urgent')) {
    specificGuidance = `
This is an URGENT QUESTION ticket. Focus on:
- Nature of the urgent issue
- Why it was considered urgent
- Guidance or support provided
- Outcome and next steps`;
  } else if (panelLower.includes('islamic') || panelLower.includes('question')) {
    specificGuidance = `
This is an ISLAMIC QUESTION ticket. Focus on:
- The specific Islamic question or topic discussed
- Key guidance or resources provided
- Whether the question was fully answered
- Any follow-up needed`;
  } else if (panelLower.includes('call')) {
    specificGuidance = `
This is a REQUEST A CALL ticket. Focus on:
- Purpose of the call request
- Whether the call was scheduled
- Any preparation or follow-up discussed`;
  } else {
    specificGuidance = `
This is a GENERAL SUPPORT ticket. Focus on:
- The main issue or question raised
- Support provided by staff
- Resolution or outcome
- Any follow-up actions`;
  }

  return `${baseInstruction}

${specificGuidance}

${userContext}

Ticket Type: ${panelTitle}

Conversation:
${conversation}

Provide a professional summary in 2-4 sentences. Be respectful and maintain privacy. Do not include personal identifiers beyond what's necessary.`;
}

/**
 * Generates an AI summary for a ticket
 */
export async function generateTicketSummary(ticketId: number): Promise<{
  summary: string;
  tokensUsed: number;
  model: string;
}> {
  // Get ticket context
  const context = await getTicketContext(ticketId);

  if (!context) {
    throw new Error('Ticket not found');
  }

  if (context.messages.length === 0) {
    throw new Error('No messages in ticket to summarize');
  }

  // Generate prompt
  const prompt = generatePrompt(context);

  // Call Gemini API
  const result = await model.generateContent(prompt);
  const response = result.response;
  const summary = response.text();

  // Estimate tokens (rough approximation: 4 chars per token)
  const tokensUsed = Math.ceil((prompt.length + summary.length) / 4);

  return {
    summary,
    tokensUsed,
    model: 'gemini-2.0-flash-exp',
  };
}
