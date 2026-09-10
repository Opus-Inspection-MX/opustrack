import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * SLA breach report aggregator (RF-518).
 *
 * Kept out of the shared `reports.test.ts` aggregator matrix on purpose:
 * that matrix asserts EVERY query an aggregator issues carries the Client
 * scope, and the global holiday catalog query (`{ active: true }`) has no
 * Client concept. The scope assertions below cover the tenant boundary
 * that matters — the incident query — plus the RF-518 rules: CANCELADA
 * exclusion, per-type breach grouping, RF-502 percentages, and RF-219
 * closure precedence.
 */

const DAY = 86_400_000;

const { prismaMock, requirePermission, getUserClientIds, userBox } = vi.hoisted(
  () => {
    const queryable = () => ({
      findMany: vi.fn(async (..._args: unknown[]): Promise<unknown> => []),
      findFirst: vi.fn(async (..._args: unknown[]): Promise<unknown> => null),
      count: vi.fn(async (..._args: unknown[]): Promise<unknown> => 0),
    });
    return {
      prismaMock: {
        incident: { ...queryable() },
        incidentEvent: { ...queryable() },
        holiday: { ...queryable() },
      },
      requirePermission: vi.fn(async (_name: string) => userBox.user),
      getUserClientIds: vi.fn(async (_userId: string) => [] as string[]),
      userBox: { user: { id: "admin", isSuperuser: true } as never },
    };
  },
);

vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/auth", () => ({
  requirePermission: (name: string) => requirePermission(name),
}));
vi.mock("@/lib/utils/client-assignments", () => ({ getUserClientIds }));

import { getSlaBreachData } from "./reports";

const SCOPED_CLIENT = "c100000001";

function asScopedUser() {
  userBox.user = {
    id: "u-scoped",
    isSuperuser: false,
    permissions: new Set<string>(),
  } as never;
  getUserClientIds.mockResolvedValue([SCOPED_CLIENT]);
}

const now = () => new Date();
const daysAgo = (n: number) => new Date(now().getTime() - n * DAY);

function row(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    reportedAt: daysAgo(60),
    resolvedAt: null,
    status: { name: "ABIERTO" },
    type: { name: "Eléctrica", priority: 9 },
    assignments: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  userBox.user = { id: "admin", isSuperuser: true } as never;
  getUserClientIds.mockResolvedValue([]);
  prismaMock.incident.findMany.mockResolvedValue([]);
  prismaMock.incidentEvent.findMany.mockResolvedValue([]);
  prismaMock.holiday.findMany.mockResolvedValue([]);
});

describe("getSlaBreachData (RF-518)", () => {
  it("requires reports:view before querying", async () => {
    await getSlaBreachData().catch(() => {});

    expect(requirePermission).toHaveBeenCalledWith("reports:view");
  });

  it("scopes the incident query to the caller's Clientes", async () => {
    asScopedUser();
    await getSlaBreachData().catch(() => {});

    const where = (
      prismaMock.incident.findMany.mock.calls[0]?.[0] as
        | { where?: { clientId?: unknown } }
        | undefined
    )?.where;
    expect(where?.clientId).toEqual({ in: [SCOPED_CLIENT] });
  });

  it("excludes CANCELADA incidents from every count", async () => {
    prismaMock.incident.findMany.mockResolvedValue([
      row(1, { status: { name: "CANCELADA" } }),
    ]);

    await expect(getSlaBreachData()).resolves.toEqual([]);
    expect(prismaMock.incidentEvent.findMany).not.toHaveBeenCalled();
  });

  it("groups by type with breach counts, RF-502 percentages, and worst-first order", async () => {
    prismaMock.incident.findMany.mockResolvedValue([
      // Critical, unseen, 60 days old → BREACHED.
      row(1),
      row(2),
      // Low band, created now → ON_TRACK.
      row(3, {
        reportedAt: now(),
        type: { name: "Preventivo", priority: 2 },
      }),
      // Typeless rows group under "Sin Tipo" with default priority 5.
      row(4, { reportedAt: now(), type: null }),
    ]);

    const rows = await getSlaBreachData();

    expect(rows).toEqual([
      {
        type: "Eléctrica",
        priority: 9,
        total: 2,
        breached: 2,
        atRisk: 0,
        onTrack: 0,
        breachedPct: 100,
        atRiskPct: 0,
        onTrackPct: 0,
      },
      {
        type: "Preventivo",
        priority: 2,
        total: 1,
        breached: 0,
        atRisk: 0,
        onTrack: 1,
        breachedPct: 0,
        atRiskPct: 0,
        onTrackPct: 100,
      },
      {
        type: "Sin Tipo",
        priority: 5,
        total: 1,
        breached: 0,
        atRisk: 0,
        onTrack: 1,
        breachedPct: 0,
        atRiskPct: 0,
        onTrackPct: 100,
      },
    ]);
  });

  it("counts at-risk separately from breached and on-track (frozen Thursday 2026-09-10)", async () => {
    // Freeze "now" so business-day margins are exact: Thu 2026-09-10 10:00 CDMX.
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-09-10T16:00:00.000Z"));
      const { localWallTimeToUTC } = await import("@/lib/utils/datetime");
      const at = (date: string) => localWallTimeToUTC(date, "10:00");
      prismaMock.incident.findMany.mockResolvedValue([
        // Critical, unseen since Fri 09-04: Mon..Thu = 4 business days > 1 → BREACHED.
        row(1, {
          reportedAt: at("2026-09-04"),
          type: { name: "Eléctrica", priority: 9 },
        }),
        // Low band, unseen since Fri 09-04: 4 of 5 response days → AT_RISK.
        row(2, {
          reportedAt: at("2026-09-04"),
          type: { name: "Preventivo", priority: 2 },
        }),
        // Low band, unseen since Tue 09-08: Wed + Thu = 2 of 5 → ON_TRACK.
        row(3, {
          reportedAt: at("2026-09-08"),
          type: { name: "Preventivo", priority: 2 },
        }),
      ]);

      const rows = await getSlaBreachData();

      expect(rows).toEqual([
        {
          type: "Eléctrica",
          priority: 9,
          total: 1,
          breached: 1,
          atRisk: 0,
          onTrack: 0,
          breachedPct: 100,
          atRiskPct: 0,
          onTrackPct: 0,
        },
        {
          type: "Preventivo",
          priority: 2,
          total: 2,
          breached: 0,
          atRisk: 1,
          onTrack: 1,
          breachedPct: 0,
          atRiskPct: 50,
          onTrackPct: 50,
        },
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("applies RF-219 closure precedence: a late audit closure breaches despite an on-time column", async () => {
    prismaMock.incident.findMany.mockResolvedValue([
      row(1, {
        resolvedAt: daysAgo(60),
        status: { name: "CERRADO" },
      }),
    ]);
    prismaMock.incidentEvent.findMany.mockResolvedValue([
      { incidentId: 1, createdAt: now() },
    ]);

    const [only] = await getSlaBreachData();

    expect(only?.breached).toBe(1);
  });

  it("passes typeIds through to the query", async () => {
    await getSlaBreachData(undefined, [3, 7]).catch(() => {});

    const where = (
      prismaMock.incident.findMany.mock.calls[0]?.[0] as
        | { where?: { typeId?: unknown } }
        | undefined
    )?.where;
    expect(where?.typeId).toEqual({ in: [3, 7] });
  });
});
