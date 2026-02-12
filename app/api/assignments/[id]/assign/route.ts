import { NextRequest } from "next/server";
import { publishEvent } from "@/lib/events/publish";
import { STREAMS } from "@/lib/events/streams";
import { db } from "@/lib/db";
import { assignments } from "@/lib/db/schema";


export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const revertUserId = params.id;
  const { supervisorUserId } = await req.json();

  if (!supervisorUserId) {
    return Response.json(
      { error: "supervisorUserId is required" },
      { status: 400 }
    );
  }

  // DB mutation (stub for now)
  
await db
  .insert(assignments)
  .values({
    revertUserId,
    supervisorUserId,
  })
  .onConflictDoUpdate({
    target: assignments.revertUserId,
    set: {
      supervisorUserId,
    },
  });
  

  // Emit event
  await publishEvent(STREAMS.DASHBOARD_ACTIONS, {
    type: "assignment.assigned",
    revertUserId,
    supervisorUserId,
    timestamp: Date.now(),
  });

  return Response.json({ ok: true });
}
