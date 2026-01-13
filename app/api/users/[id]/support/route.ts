import { NextResponse } from "next/server";
import { getUserSupportStatus } from "@/lib/db/queries";
import { requireAuth } from '@/lib/auth-helpers';


export async function GET(
  // Require authentication


  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
    const { session, error } = await requireAuth();
  if (error) return error;
    const { id } = await context.params;
  try {
    const userId = BigInt(id);

    const row = await getUserSupportStatus(userId);

    let state: "waiting" | "assigned" | "resolved";

    if (!row) {
      state = "resolved";
    } else if (!row.active) {
      state = "resolved";
    } else if (row.assignedAt) {
      state = "assigned";
    } else {
      state = "waiting";
    }

    return NextResponse.json({
      state,
      data: row
        ? {
            id: row.id,
            active: row.active,
            assignedAt: row.assignedAt,
            createdAt: row.createdAt,
            channelId: row.channelId.toString(),
            assignedById: row.assignedById?.toString() ?? null,
          }
        : null,
    });
  } catch (err) {
    console.error("Failed to fetch support status:", err);
    return NextResponse.json(
      { error: "Failed to fetch support status" },
      { status: 500 }
    );
  }
}
