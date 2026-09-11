import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * SLA breach state on tracking rows (RF-218 surface).
 *
 * `getSlaState` itself is pinned in `sla-policy.test.ts`; these tests pin the
 * WIRING: the query carries `seenAt`, the first acuse across assignments
 * feeds the response clock, and the RF-219 audit trail wins over the live
 * `resolvedAt` column (in both directions). `now` is real, so every case
 * uses margins no weekend or holiday can flip.
 */

const { prismaMock, requirePermission, getUserClientIds } = vi.hoisted(() => {
  const queryable = () => ({
    findMany: vi.fn(async (..._args: unknown[]): Promise<unknown> => []),
    findFirst: vi.fn(async (..._args: unknown[]): Promise<unknown> => null),
    count: vi.fn(async (..._args: unknown[]): Promise<unknown> => 0),
  });
  return {
    prismaMock: {
      incident: { ...queryable() },
      incidentEvent: { ...queryable(), create: vi.fn() },
      holiday: { ...queryable() },
    },
    requirePermission: vi.fn(async (_name: string) => ({
      id: "admin",
      isSuperuser: true,
    })),
    getUserClientIds: vi.fn(async (_userId: string) => [] as string[]),
  };
});

vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/auth", () => ({
  requirePermission: (name: string) => requirePermission(name),
}));
vi.mock("@/lib/utils/client-assignments", () => ({ getUserClientIds }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { getIncidentsForTracking } from "./tracking";

const DAY = 86_400_000;
const now = () => new Date();
const daysAgo = (n: number) => new Date(now().getTime() - n * DAY);

type Row = {
  id: number;
  reportedAt: Date;
  resolvedAt: Date | null;
  type: { id: number; name: string; priority: number } | null;
  status: { id: number; name: string; color: string } | null;
  assignments: Array<{ seenAt: Date | null }>;
};

function row(overrides: Partial<Row> & { id: number }): Row {
  return {
    reportedAt: daysAgo(60),
    resolvedAt: null,
    type: { id: 1, name: "Eléctrica", priority: 9 },
    status: { id: 1, name: "ABIERTO", color: "#94A3B8" },
    assignments: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.incident.count.mockResolvedValue(0);
  prismaMock.incident.findMany.mockResolvedValue([]);
  prismaMock.incidentEvent.findMany.mockResolvedValue([]);
  prismaMock.holiday.findMany.mockResolvedValue([]);
});

describe("getIncidentsForTracking · sla (RF-218)", () => {
  it("selects seenAt on assignments for the response clock", async () => {
    await getIncidentsForTracking();

    // Empty page short-circuits before the SLA lookups (asserted below), so
    // feed one row to inspect the query shape.
    prismaMock.incident.findMany.mockResolvedValue([row({ id: 1 })]);
    await getIncidentsForTracking();

    const args = prismaMock.incident.findMany.mock.calls.at(-1)?.[0] as {
      select: { assignments: { select: { seenAt: boolean } } };
    };
    expect(args.select.assignments.select.seenAt).toBe(true);
  });

  it("marks an overdue unseen critical incident BREACHED and a fresh low one ON_TRACK", async () => {
    prismaMock.incident.findMany.mockResolvedValue([
      row({ id: 1 }),
      row({
        id: 2,
        reportedAt: now(),
        type: { id: 2, name: "Preventivo", priority: 2 },
      }),
    ]);

    const { data } = await getIncidentsForTracking();

    expect(data.map((i) => [i.id, i.sla])).toEqual([
      [1, "BREACHED"],
      [2, "ON_TRACK"],
    ]);
  });

  it("runs the resolution clock once any assignment was seen", async () => {
    prismaMock.incident.findMany.mockResolvedValue([
      row({
        id: 1,
        assignments: [{ seenAt: null }, { seenAt: daysAgo(59) }],
      }),
    ]);

    const { data } = await getIncidentsForTracking();

    // Seen 59 days ago, still open, critical resolution target is 3 days.
    expect(data[0]?.sla).toBe("BREACHED");
  });

  it("prefers the audit-trail closure over the live resolvedAt column (late event breaches)", async () => {
    prismaMock.incident.findMany.mockResolvedValue([
      row({
        id: 1,
        // Live column claims an on-time closure…
        resolvedAt: daysAgo(60),
        status: { id: 6, name: "CERRADO", color: "#10B981" },
      }),
    ]);
    // …but the audit log says it actually closed ~60 business days later.
    prismaMock.incidentEvent.findMany.mockResolvedValue([
      { incidentId: 1, createdAt: now() },
    ]);

    const { data } = await getIncidentsForTracking();

    expect(data[0]?.sla).toBe("BREACHED");
  });

  it("prefers the audit-trail closure over the live resolvedAt column (early event clears)", async () => {
    prismaMock.incident.findMany.mockResolvedValue([
      row({
        id: 1,
        // Live column claims a closure 60 days after creation…
        resolvedAt: now(),
        status: { id: 6, name: "CERRADO", color: "#10B981" },
      }),
    ]);
    // …but the audit log says it closed the next day.
    const closedAt = new Date(row({ id: 1 }).reportedAt.getTime() + 2 * DAY);
    prismaMock.incidentEvent.findMany.mockResolvedValue([
      { incidentId: 1, createdAt: closedAt },
    ]);

    const { data } = await getIncidentsForTracking();

    expect(data[0]?.sla).toBe("ON_TRACK");
  });

  it("maps CANCELADA to NOT_APPLICABLE, however old", async () => {
    prismaMock.incident.findMany.mockResolvedValue([
      row({ id: 1, status: { id: 7, name: "CANCELADA", color: "#EF4444" } }),
    ]);

    const { data } = await getIncidentsForTracking();

    expect(data[0]?.sla).toBe("NOT_APPLICABLE");
  });

  it("skips the closure and holiday lookups on an empty page", async () => {
    const result = await getIncidentsForTracking();

    expect(result).toEqual({
      data: [],
      totalCount: 0,
      page: 1,
      pageSize: 50,
      totalPages: 1,
    });
    expect(prismaMock.incidentEvent.findMany).not.toHaveBeenCalled();
    expect(prismaMock.holiday.findMany).not.toHaveBeenCalled();
  });
});
