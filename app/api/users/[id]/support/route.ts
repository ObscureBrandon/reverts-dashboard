import { NextResponse } from "next/server";
import { getUserSupportStatus } from "@/lib/db/queries";
import { requireAuth } from '@/lib/auth-helpers.server';

type SupportState = 'none' | 'pending' | 'active' | 'resolved' | 'archived';

function mapSupportPresentation(state: SupportState) {
  switch (state) {
    case "pending":
      return { label: "Pending", tone: "yellow" };
    case "active":
      return { label: "Active", tone: "blue" };
    case "resolved":
      return { label: "Resolved", tone: "green" };
    case "archived":
      return { label: "Archived", tone: "gray" };
    case "none":
      return { label: "Never requested support", tone: "gray" };
  }
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await context.params;

  try {
    const userId = BigInt(id);
    const row = await getUserSupportStatus(userId);

    let state: SupportState;

    if (!row) {
      state = "none";
    } else if (!row.active && !row.assignedAt) {
      state = "archived";
    } else if (!row.active && row.assignedAt) {
      state = "resolved";
    } else if (row.assignedAt) {
      state = "active";
    } else {
      state = "pending";
    }

    const presentation = mapSupportPresentation(state);

    return NextResponse.json({
      state,
      ...presentation,
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
