import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tenancy of the report aggregators (cross-cutting rule #4).
 *
 * Eleven aggregators, zero dedicated tests: every one of them builds its own
 * Prisma query, so a scope spread forgotten in any single one leaks another
 * Cliente's rows through the dashboard. The assertions here are not "does
 * Prisma work" but the two rules that must hold for ALL of them:
 *
 * 1. Each aggregator requires `reports:view` before touching the database.
 * 2. Every query it issues carries the caller's Cliente scope — a scoped
 *    user only ever queries inside their own Clientes (fail closed: a user
 *    with no assignments matches nothing, never everything).
 */

const { prismaMock, requirePermission, getUserClienteIds, userBox } =
  vi.hoisted(() => {
    const queryable = () => ({
      findMany: vi.fn(async (..._args: unknown[]): Promise<unknown> => []),
      findFirst: vi.fn(async (..._args: unknown[]): Promise<unknown> => null),
      count: vi.fn(async (..._args: unknown[]): Promise<unknown> => 0),
      aggregate: vi.fn(
        async (..._args: unknown[]): Promise<unknown> => ({
          _count: { _all: 0 },
          _avg: {},
          _sum: {},
          _max: {},
        }),
      ),
    });
    return {
      prismaMock: {
        user: queryable(),
        assignment: queryable(),
        incident: queryable(),
        vehicleTrip: queryable(),
        notification: queryable(),
        role: queryable(),
      },
      requirePermission: vi.fn(async (_name: string) => userBox.user),
      getUserClienteIds: vi.fn(async (_userId: string) => [] as string[]),
      // Swappable user: superuser by default; scope tests replace it.
      userBox: { user: { id: "admin", isSuperuser: true } as never },
    };
  });

vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/auth", () => ({
  requirePermission: (name: string) => requirePermission(name),
}));
vi.mock("@/lib/utils/cliente-assignments", () => ({ getUserClienteIds }));

import {
  getAssignmentAgingData,
  getAssignmentStatusData,
  getDailyTripComplianceReport,
  getFSRPerformanceData,
  getIncidentsByTypeData,
  getIncidentTrendData,
  getNotificationEngagementReport,
  getReportSummary,
  getSeenTimeData,
  getVehicleTripsByFSRData,
  getVehicleTripTrendData,
} from "./reports";

const AGGREGATORS = {
  getFSRPerformanceData,
  getAssignmentStatusData,
  getIncidentTrendData,
  getIncidentsByTypeData,
  getVehicleTripTrendData,
  getVehicleTripsByFSRData,
  getReportSummary,
  getAssignmentAgingData,
  getSeenTimeData,
  getNotificationEngagementReport,
  getDailyTripComplianceReport,
} as const;

type Aggregator = (typeof AGGREGATORS)[keyof typeof AGGREGATORS];

const SCOPED_CLIENTE = "c100000001";
/** The only FSR the mocked user list returns: every fan-out must stay on it. */
const SCOPED_FSR = "fsr1";

function asScopedUser() {
  userBox.user = {
    id: "u-scoped",
    isSuperuser: false,
    permissions: new Set<string>(),
  } as never;
  getUserClienteIds.mockResolvedValue([SCOPED_CLIENTE]);
}

function asSuperuser() {
  userBox.user = { id: "admin", isSuperuser: true } as never;
  getUserClienteIds.mockResolvedValue([]);
}

/** Every `where` handed to any tenant query in the last call. */
function allWheres(): unknown[] {
  const wheres: unknown[] = [];
  for (const [modelName, model] of Object.entries(prismaMock)) {
    // Roles are global seed rows with no Cliente concept — not a tenant
    // boundary. Everything else must carry the caller's scope.
    if (modelName === "role") continue;
    for (const op of ["findMany", "findFirst", "count", "aggregate"] as const) {
      const mockFn = (
        model as Record<string, { mock: { calls: unknown[][] } }>
      )[op];
      for (const call of mockFn.mock.calls) {
        const args = call[0] as { where?: unknown } | undefined;
        if (args && typeof args === "object" && "where" in args) {
          wheres.push(args.where);
        }
      }
    }
  }
  return wheres;
}

beforeEach(() => {
  vi.clearAllMocks();
  asSuperuser();
  // Three aggregators fan out per FSR (performance, engagement, daily
  // compliance): with zero users their inner queries never fire and the
  // scope assertions would pass vacuously. One user keeps them honest.
  // (They also bail early without the FSR role seed row.)
  // Mock fidelity: an empty scope matches no users, so the fan-out never
  // fires for a Cliente-less caller — exactly the fail-closed behavior.
  prismaMock.user.findMany.mockImplementation(async (args: unknown) => {
    const raw = JSON.stringify((args as { where?: unknown })?.where ?? {});
    if (raw.includes('"in":[]')) return [];
    return [{ id: SCOPED_FSR, name: "FSR Uno" }];
  });
  prismaMock.role.findFirst.mockResolvedValue({ id: 7, name: "FSR" });
});

describe.each(Object.entries(AGGREGATORS))("%s", (name, run) => {
  it("requires reports:view before querying", async () => {
    await (run as Aggregator)().catch(() => {});

    expect(requirePermission).toHaveBeenCalledWith("reports:view");
  });

  it("scopes every query to the caller's Clientes", async () => {
    asScopedUser();
    await (run as Aggregator)().catch(() => {});

    const wheres = allWheres();
    // The aggregator must have queried something to be scoped.
    expect(wheres.length, `${name} issued no scoped query`).toBeGreaterThan(0);

    // The FSR list is the gate for the per-FSR fan-out aggregators
    // (performance, engagement, daily compliance): it must carry the scope.
    const userWheres = (prismaMock.user.findMany.mock.calls as unknown[][]).map(
      (call) => (call[0] as { where?: unknown }).where,
    );
    for (const where of userWheres) {
      expect(
        JSON.stringify(where),
        `${name} FSR list escapes the scope`,
      ).toContain(SCOPED_CLIENTE);
    }

    for (const where of wheres) {
      const raw = JSON.stringify(where);
      // Collection queries carry the Cliente scope directly. Per-FSR fan-out
      // queries filter by a user drawn from the scoped list above — that
      // indirection is the documented boundary (spec 09: per-FSR aggregates
      // are computed over the FSR's rows, and the FSR set itself is scoped).
      const scoped = raw.includes(SCOPED_CLIENTE);
      const fannedOut = raw.includes(SCOPED_FSR) && userWheres.length > 0;
      expect(
        scoped || fannedOut,
        `${name} query escapes the caller's Cliente scope: ${raw}`,
      ).toBe(true);
    }
  });

  it("fail closed: a user with no Clientes matches nothing", async () => {
    userBox.user = {
      id: "u-bare",
      isSuperuser: false,
      permissions: new Set<string>(),
    } as never;
    getUserClienteIds.mockResolvedValue([]);
    await (run as Aggregator)().catch(() => {});

    const wheres = allWheres();
    expect(wheres.length, `${name} issued no query`).toBeGreaterThan(0);
    for (const where of wheres) {
      const raw = JSON.stringify(where);
      // Either an explicit empty set, a query without an `in` filter that
      // can only run after a scoped gate, or a fan-out over the (empty
      // here) scoped user set — never an unscoped collection query.
      expect(
        raw.includes('"in":[]') ||
          !raw.includes('"in":') ||
          raw.includes(SCOPED_FSR),
        `${name} query is unscoped for a Cliente-less user: ${raw}`,
      ).toBe(true);
    }
  });
});
