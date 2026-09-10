import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/database/prisma.singleton", () => ({
  prisma: {
    incident: { findUnique: vi.fn(), update: vi.fn() },
    incidentStatus: { findUnique: vi.fn() },
    incidentEvent: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/auth/auth", () => ({
  requirePermission: vi.fn(async (_name: string) => ({ id: "admin-1" })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { requirePermission } from "@/lib/auth/auth";
import { prisma } from "@/lib/database/prisma.singleton";
import { cancelIncident } from "./incidents";

describe("cancelIncident audit event (RF-219)", () => {
  const findUnique = vi.mocked(prisma.incident.findUnique);
  const statusFindUnique = vi.mocked(prisma.incidentStatus.findUnique);
  const eventCreate = vi.mocked(prisma.incidentEvent.create);
  const transaction = vi.mocked(prisma.$transaction);

  beforeEach(() => {
    vi.clearAllMocks();
    eventCreate.mockResolvedValue({} as never);
    transaction.mockImplementation(((fn: (tx: typeof prisma) => unknown) =>
      fn(prisma)) as never);
  });

  it("emits CANCELLED in-transaction with the actor and reason", async () => {
    findUnique.mockResolvedValue({
      id: 1,
      status: { name: "ABIERTO" },
      resolvedAt: null,
    } as never);
    statusFindUnique.mockResolvedValue({ id: 7 } as never);

    const result = await cancelIncident(1, "  Reporte duplicado  ");

    expect(result.success).toBe(true);
    expect(eventCreate).toHaveBeenCalledTimes(1);
    const event = eventCreate.mock.calls[0]?.[0]?.data as unknown as {
      eventType: string;
      actorId: string;
      fromStatus: string;
      toStatus: string;
      payload: { reason: string };
    };
    expect(event.eventType).toBe("CANCELLED");
    expect(event.actorId).toBe("admin-1");
    expect(event.fromStatus).toBe("ABIERTO");
    expect(event.toStatus).toBe("CANCELADA");
    expect(event.payload.reason).toBe("Reporte duplicado");
    expect(requirePermission).toHaveBeenCalledWith("incidents:cancel");
  });

  it("still refuses to cancel an already-closed incident", async () => {
    findUnique.mockResolvedValue({
      id: 1,
      status: { name: "CERRADO" },
      resolvedAt: new Date(),
    } as never);

    const result = await cancelIncident(1, "tarde");

    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/cerrada/),
    });
    expect(eventCreate).not.toHaveBeenCalled();
  });
});
