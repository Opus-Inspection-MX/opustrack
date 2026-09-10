import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/database/prisma.singleton", () => ({
  prisma: {
    incidentEvent: { create: vi.fn(), findFirst: vi.fn() },
  },
}));

import { IncidentEventType } from "@prisma/client";
import { prisma } from "@/lib/database/prisma.singleton";
import { getIncidentClosureAt, logIncidentEvent } from "./incident-events";

describe("logIncidentEvent", () => {
  const create = vi.mocked(prisma.incidentEvent.create);

  beforeEach(() => {
    vi.clearAllMocks();
    create.mockResolvedValue({} as never);
  });

  it("defaults the actor to null (system) and keeps allowlisted payload keys", async () => {
    await logIncidentEvent(prisma, {
      incidentId: 1,
      eventType: IncidentEventType.CANCELLED,
      fromStatus: "ABIERTO",
      payload: { reason: "Duplicado", fromStatus: "ABIERTO" },
    });

    const data = create.mock.calls[0]?.[0]?.data as unknown as {
      actorId: string | null;
      payload: Record<string, unknown>;
    };
    expect(data.actorId).toBeNull();
    expect(data.payload).toEqual({
      reason: "Duplicado",
      fromStatus: "ABIERTO",
    });
  });

  it("drops payload keys outside the event allowlist", async () => {
    await logIncidentEvent(prisma, {
      incidentId: 1,
      eventType: IncidentEventType.CANCELLED,
      payload: { reason: "x", injected: "DROP ME" },
    });

    const data = create.mock.calls[0]?.[0]?.data as unknown as {
      payload: Record<string, unknown>;
    };
    expect(data.payload).toEqual({ reason: "x" });
    expect("injected" in data.payload).toBe(false);
  });

  it("truncates long free-text reasons", async () => {
    await logIncidentEvent(prisma, {
      incidentId: 1,
      eventType: IncidentEventType.CANCELLED,
      payload: { reason: "r".repeat(600) },
    });

    const data = create.mock.calls[0]?.[0]?.data as unknown as {
      payload: { reason: string };
    };
    expect(data.payload.reason).toHaveLength(500);
  });
});

describe("getIncidentClosureAt (RF-503/RF-509 precedence)", () => {
  const findFirst = vi.mocked(prisma.incidentEvent.findFirst);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the latest close-arriving event, not the live column", async () => {
    const closedAt = new Date("2026-08-15T12:00:00Z");
    findFirst.mockResolvedValue({ createdAt: closedAt } as never);

    await expect(getIncidentClosureAt(prisma, 1)).resolves.toEqual(closedAt);
    const where = findFirst.mock.calls[0]?.[0]?.where as {
      OR: unknown[];
    };
    expect(where.OR).toHaveLength(2);
  });

  it("returns null when the incident never closed", async () => {
    findFirst.mockResolvedValue(null);

    await expect(getIncidentClosureAt(prisma, 1)).resolves.toBeNull();
  });
});
