import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { userSupervisors } from "@/lib/db/auth-schema";
import { publishEvent } from "@/lib/events/publish";
import { STREAMS } from "@/lib/events/streams";
import { eq, and } from "drizzle-orm";
import { getUserSupervisorRelations } from "@/lib/db/queries";

/* ------------------ */
/* Serialization      */
/* ------------------ */

function serializeSupervisorRelation(r: any) {
  return {
    ...r,
    relationId: r.relationId.toString(),
    startedAt: r.startedAt.toISOString(),
    supervisor: {
      ...r.supervisor,
      discordId: r.supervisor.discordId.toString(),
    },
  };
}

/* ========================= */
/* GET - Fetch supervisors   */
/* ========================= */

export async function GET(
  _req: Request,
  context: { params: Promise<{ userId: string }> }
) {
  const { userId } = await context.params;
  const userIdBigInt = BigInt(userId);

  const relations = await getUserSupervisorRelations(userIdBigInt);

  const active = relations.filter((r) => r.active);

  if (active.length > 1) {
    throw new Error(
      `Invariant violation: user ${userId} has multiple active supervisors`
    );
  }

  const presentSupervisor = active[0] ?? null;

  const pastSupervisors = relations
    .filter((r) => !r.active)
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

  return Response.json({
    presentSupervisor: presentSupervisor
      ? serializeSupervisorRelation(presentSupervisor)
      : null,
    pastSupervisors: pastSupervisors.map(serializeSupervisorRelation),
  });
}

/* ========================= */
/* POST - Assign Supervisor  */
/* ========================= */

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const { userId } = await context.params;
  const userIdBigInt = BigInt(userId);

  const { supervisorId } = await req.json();

  if (!supervisorId) {
    return Response.json(
      { error: "supervisorId is required" },
      { status: 400 }
    );
  }

  const supervisorIdBigInt = BigInt(supervisorId);

  await db.transaction(async (tx) => {
    // 1️⃣ deactivate any current active supervisor
    await tx
      .update(userSupervisors)
      .set({ active: false })
      .where(
        and(
          eq(userSupervisors.userId, userIdBigInt),
          eq(userSupervisors.active, true)
        )
      );

    // 2️⃣ insert new active supervisor
    await tx.insert(userSupervisors).values({
      userId: userIdBigInt,
      supervisorId: supervisorIdBigInt,
      active: true,
    });
  });

  // 3️⃣ publish Redis event
  await publishEvent(STREAMS.DASHBOARD_ACTIONS, {
    type: "assignment.assigned",
    userId,
    supervisorId,
    timestamp: Date.now(),
  });

  return Response.json({ ok: true });
}

/* ========================= */
/* DELETE - Unassign         */
/* ========================= */

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const { userId } = await context.params;
  const userIdBigInt = BigInt(userId);

  await db
    .update(userSupervisors)
    .set({ active: false })
    .where(
      and(
        eq(userSupervisors.userId, userIdBigInt),
        eq(userSupervisors.active, true)
      )
    );

  await publishEvent(STREAMS.DASHBOARD_ACTIONS, {
    type: "assignment.unassigned",
    userId,
    timestamp: Date.now(),
  });

  return Response.json({ ok: true });
}
