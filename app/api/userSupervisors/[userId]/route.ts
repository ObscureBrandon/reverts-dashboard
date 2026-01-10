import { getUserSupervisorRelations } from '@/lib/db/queries';

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

export async function GET(
  _req: Request,
  context: { params: Promise<{ userId: string }> }
) {
  const { userId } = await context.params;
  const userIdBigInt = BigInt(userId);

  const relations = await getUserSupervisorRelations(userIdBigInt);

  // active supervisors (should be max 1)
  const active = relations.filter(r => r.active);

  if (active.length > 1) {
    throw new Error(
      `Invariant violation: user ${userId} has multiple active supervisors`
    );
  }

  const presentSupervisor = active[0] ?? null;

  const pastSupervisors = relations
    .filter(r => !r.active)
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

  return Response.json({
    presentSupervisor: presentSupervisor
      ? serializeSupervisorRelation(presentSupervisor)
      : null,
    pastSupervisors: pastSupervisors.map(serializeSupervisorRelation),
  });

}
