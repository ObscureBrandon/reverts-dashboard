import { NextRequest } from "next/server";
import { publishEvent } from "@/lib/events/publish";
import { STREAMS } from "@/lib/events/streams";
// import { db } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const revertUserId = params.id;

  // DB mutation (stub)
  /*
  await db.assignment.delete({
    where: { revertUserId },
  });
  */

  // Emit event
  await publishEvent(STREAMS.DASHBOARD_ACTIONS, {
    type: "assignment.unassigned",
    revertUserId,
    timestamp: Date.now(),
  });

  return Response.json({ ok: true });
}
