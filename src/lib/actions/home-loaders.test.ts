import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Home loader contract (Fase 3 · 3.2):
 *
 * - Every loader gates on the SAME permission its registry entry declares.
 * - Every scoped where carries the scope; an empty scope (`clientIds: []`)
 *   generates `in: []` — matching nothing, never everything.
 * - The reporter summary resolves nobody's Client but the primary one, and
 *   returns empty when there is none.
 */

const { prismaMock, requirePermission, getReportScope, getPrimaryClientId } =
  vi.hoisted(() => ({
    prismaMock: {
      user: { count: vi.fn(async () => 0) },
      assignment: {
        count: vi.fn(async () => 0),
        findMany: vi.fn(async () => []),
      },
      vehicleTrip: {
        findFirst: vi.fn(async () => null),
        findMany: vi.fn(async () => []),
      },
      incident: {
        count: vi.fn(async () => 0),
        groupBy: vi.fn(async () => []),
        findMany: vi.fn(async () => []),
      },
      incidentStatus: { findMany: vi.fn(async () => []) },
      vacationPeriod: { findMany: vi.fn(async () => []) },
      vacation: {
        count: vi.fn(async () => 0),
        findMany: vi.fn(async () => []),
      },
      schedule: {
        count: vi.fn(async () => 0),
        findMany: vi.fn(async () => []),
      },
    },
    requirePermission: vi.fn(async (_name: string) => ({ id: "u1" })),
    getReportScope: vi.fn(
      async (_user: unknown): Promise<{ clientIds: string[] | null }> => ({
        clientIds: ["c1"],
      }),
    ),
    getPrimaryClientId: vi.fn(
      async (_userId: string): Promise<string | null> => "c1",
    ),
  }));

vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/auth", () => ({
  requirePermission: (name: string) => requirePermission(name),
}));
vi.mock("@/lib/auth/report-scope", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/auth/report-scope")>();
  return {
    ...actual,
    getReportScope: (user: unknown) => getReportScope(user),
  };
});
vi.mock("@/lib/utils/client-assignments", () => ({
  getPrimaryClientId: (userId: string) => getPrimaryClientId(userId),
}));

import { WIDGETS, type WidgetId } from "@/lib/home/widgets";
import {
  getIncidentsByStatus,
  getOperationalKpis,
  getTrackingQueue,
  getUpcomingSchedules,
} from "./home-operations";
import {
  getMyActiveTrip,
  getMyReportsSummary,
  getMyVacationSummary,
  getMyWorkSummary,
  getPendingVacationApprovals,
  getUpcomingAbsences,
} from "./home-personal";

const permissionFor = (id: WidgetId): string => {
  const def = WIDGETS.find((w) => w.id === id);
  const perms = def?.requires.permissions ?? [];
  if (perms.length !== 1) {
    throw new Error(`Widget ${id} must declare exactly one permission`);
  }
  return perms[0];
};

beforeEach(() => {
  vi.clearAllMocks();
  getReportScope.mockResolvedValue({ clientIds: ["c1"] });
  getPrimaryClientId.mockResolvedValue("c1");
});

describe("cada loader exige el permiso de su registro", () => {
  const cases: Array<[WidgetId, () => Promise<unknown>]> = [
    ["my-work", getMyWorkSummary],
    ["my-active-trip", getMyActiveTrip],
    ["my-reports", getMyReportsSummary],
    ["my-vacation", getMyVacationSummary],
    ["vacation-approvals", getPendingVacationApprovals],
    ["upcoming-absences", getUpcomingAbsences],
    ["tracking-queue", getTrackingQueue],
    ["ops-kpis", getOperationalKpis],
    ["incidents-by-status", getIncidentsByStatus],
    ["upcoming-schedules", getUpcomingSchedules],
  ];

  for (const [widgetId, loader] of cases) {
    it(`${widgetId} → requirePermission("${permissionFor(widgetId)}")`, async () => {
      await loader();
      expect(requirePermission).toHaveBeenCalledWith(permissionFor(widgetId));
    });
  }
});

/** First positional arg of the last mock call, as the loaders' input. */
function lastInput(mock: { mock: { calls: Array<Array<unknown>> } }): {
  where?: unknown;
} {
  return (mock.mock.calls.at(-1)?.[0] ?? {}) as { where?: unknown };
}

describe("el scope viaja en cada where", () => {
  it("my-work acota por incidente y dueño", async () => {
    await getMyWorkSummary();
    const where = lastInput(prismaMock.assignment.findMany).where;
    expect(JSON.stringify(where)).toContain('"userId":"u1"');
    expect(JSON.stringify(where)).toContain('"in":["c1"]');
  });

  it("tracking-queue acota por Cliente", async () => {
    await getTrackingQueue();
    const where = lastInput(prismaMock.incident.findMany).where;
    expect(JSON.stringify(where)).toContain('"in":["c1"]');
  });

  it("incidents-by-status agrupa dentro del alcance", async () => {
    await getIncidentsByStatus();
    const where = lastInput(prismaMock.incident.groupBy).where;
    expect(JSON.stringify(where)).toContain('"in":["c1"]');
  });

  it("upcoming-schedules acota por vínculo Cliente", async () => {
    await getUpcomingSchedules();
    const where = lastInput(prismaMock.schedule.findMany).where;
    expect(JSON.stringify(where)).toContain("c1");
  });

  it("con clientIds: [] se genera in: [] — nada, no todo", async () => {
    getReportScope.mockResolvedValue({ clientIds: [] });

    await getMyWorkSummary();
    await getTrackingQueue();
    await getIncidentsByStatus();

    for (const where of [
      lastInput(prismaMock.assignment.findMany).where,
      lastInput(prismaMock.incident.findMany).where,
      lastInput(prismaMock.incident.groupBy).where,
    ]) {
      expect(JSON.stringify(where)).toContain('"in":[]');
    }
  });
});

describe("my-reports sin Cliente primario", () => {
  it("devuelve vacío sin tocar incidentes", async () => {
    getPrimaryClientId.mockResolvedValue(null);

    const result = await getMyReportsSummary();

    expect(result).toEqual({ byStatus: [], recent: [] });
    expect(prismaMock.incident.findMany).not.toHaveBeenCalled();
    expect(prismaMock.incident.groupBy).not.toHaveBeenCalled();
  });
});
