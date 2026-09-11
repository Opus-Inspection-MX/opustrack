import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression for Fase 3 · 3.0.2: `getDashboardStats().scheduledTasks`
 * counted every future schedule in the system, ignoring the caller's Client
 * scope — while every sibling stat beside it was already scoped. A scoped
 * role must never see another center's agenda in the KPI.
 */

const { prismaMock, getReportScope } = vi.hoisted(() => ({
  prismaMock: {
    user: { count: vi.fn(async () => 0) },
    incident: {
      count: vi.fn(async () => 0),
      findMany: vi.fn(async () => []),
    },
    assignment: {
      count: vi.fn(async () => 0),
      findMany: vi.fn(async () => []),
    },
    schedule: { count: vi.fn(async () => 0) },
  },
  getReportScope: vi.fn(async (_user: unknown) => ({ clientIds: ["c1"] })),
}));

vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/auth", () => ({
  requirePermission: async (_name: string) => ({ id: "u1" }),
}));
// Real scope fragments, controllable scope resolution.
vi.mock("@/lib/auth/report-scope", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/auth/report-scope")>();
  return {
    ...actual,
    getReportScope: (user: unknown) => getReportScope(user),
  };
});

import { getDashboardStats } from "./dashboard";
import { scheduleScopeWhere } from "@/lib/auth/report-scope";

const lastScheduleWhere = () =>
  prismaMock.schedule.count.mock.calls.at(-1)?.[0]?.where;

beforeEach(() => {
  vi.clearAllMocks();
  getReportScope.mockResolvedValue({ clientIds: ["c1"] });
});

describe("getDashboardStats · scheduledTasks con alcance (Fase 3 · 3.0.2)", () => {
  it("aplica scheduleScopeWhere al conteo", async () => {
    await getDashboardStats();

    expect(lastScheduleWhere()).toMatchObject(
      scheduleScopeWhere({ clientIds: ["c1"] }),
    );
  });

  it("un scope vacío no cuenta nada — ni siquiera globales", async () => {
    getReportScope.mockResolvedValue({ clientIds: [] });

    await getDashboardStats();

    expect(lastScheduleWhere()).toMatchObject(
      scheduleScopeWhere({ clientIds: [] }),
    );
    expect(JSON.stringify(lastScheduleWhere())).toContain('"in":[]');
  });

  it("un scope admin no restringe", async () => {
    getReportScope.mockResolvedValue({ clientIds: null });

    await getDashboardStats();

    expect(lastScheduleWhere()).toMatchObject({ active: true });
    expect(JSON.stringify(lastScheduleWhere())).not.toContain("clients");
  });
});
