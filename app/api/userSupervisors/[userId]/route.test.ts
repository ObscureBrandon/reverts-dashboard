import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/* -------------------------------------------------------------------------- */
/* HOISTED MOCKS                               */
/* -------------------------------------------------------------------------- */
/**
 * We manually define the mockDrizzle logic here. 
 * This prevents the "ReferenceError: Cannot access before initialization" 
 * by avoiding an external import of the utility during the hoisting phase.
 */
const { tx, calls, mockUpdate } = vi.hoisted(() => {
  const calls = {
    update: [] as any[],
    insert: [] as any[],
  };

  const tx: any = {
    update: vi.fn((table) => {
      calls.update.push(table);
      return tx;
    }),
    set: vi.fn(() => tx),
    where: vi.fn(() => tx),
    insert: vi.fn((table) => {
      calls.insert.push(table);
      return tx;
    }),
    values: vi.fn(() => tx),
  };

  const mockWhere = vi.fn().mockResolvedValue(undefined);
  const mockSet = vi.fn(() => ({ where: mockWhere }));
  const mockUpdate = vi.fn(() => ({ set: mockSet }));

  return { tx, calls, mockUpdate };
});

/* -------------------------------------------------------------------------- */
/* MODULE MOCKS                                */
/* -------------------------------------------------------------------------- */

vi.mock("@/lib/db", () => ({
  db: {
    transaction: vi.fn(async (cb: any) => cb(tx)),
    update: mockUpdate,
  },
}));

vi.mock("@/lib/events/publish", () => ({
  publishEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/events/streams", () => ({
  STREAMS: {
    DASHBOARD_ACTIONS: "DASHBOARD_ACTIONS",
  },
}));

/* -------------------------------------------------------------------------- */
/* IMPORT AFTER MOCKS                             */
/* -------------------------------------------------------------------------- */
// These must be imported after vi.mock to ensure they use the mocked versions.
import { POST, DELETE } from "./route";
import { publishEvent } from "@/lib/events/publish";
import { STREAMS } from "@/lib/events/streams";

/* -------------------------------------------------------------------------- */
/* TESTS                                   */
/* -------------------------------------------------------------------------- */

describe("UserSupervisor API", () => {
  const USER_ID = "123";
  const SUPERVISOR_ID = "999";

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the call tracking arrays
    calls.update.length = 0;
    calls.insert.length = 0;
  });

  /* -------------------------------------------------------------------------- */
  /* POST - Assign Supervisor                                                   */
  /* -------------------------------------------------------------------------- */

  it("POST assigns supervisor correctly", async () => {
    const req = new NextRequest("http://localhost", {
      method: "POST",
      body: JSON.stringify({ supervisorId: SUPERVISOR_ID }),
    });

    const context = {
      params: Promise.resolve({ userId: USER_ID }),
    };

    const response = await POST(req, context as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });

    // Assertions using the call tracking from our hoisted mock
    expect(calls.update.length).toBe(1);
    expect(calls.insert.length).toBe(1);

    // Event assertion
    expect(publishEvent).toHaveBeenCalledWith(
      STREAMS.DASHBOARD_ACTIONS,
      expect.objectContaining({
        type: "assignment.assigned",
        userId: USER_ID,
        supervisorId: SUPERVISOR_ID,
      })
    );
  });

  it("POST returns 400 if supervisorId missing", async () => {
    const req = new NextRequest("http://localhost", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const context = {
      params: Promise.resolve({ userId: USER_ID }),
    };

    const response = await POST(req, context as any);

    expect(response.status).toBe(400);
  });

  /* -------------------------------------------------------------------------- */
  /* DELETE - Unassign Supervisor                                               */
  /* -------------------------------------------------------------------------- */

  it("DELETE unassigns supervisor", async () => {
    const req = new NextRequest("http://localhost", {
      method: "DELETE",
    });

    const context = {
      params: Promise.resolve({ userId: USER_ID }),
    };

    const response = await DELETE(req, context as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });

    // DELETE uses db.update (mockUpdate) directly, not within a transaction
    expect(mockUpdate).toHaveBeenCalledTimes(1);

    expect(publishEvent).toHaveBeenCalledWith(
      STREAMS.DASHBOARD_ACTIONS,
      expect.objectContaining({
        type: "assignment.unassigned",
        userId: USER_ID,
      })
    );
  });
});