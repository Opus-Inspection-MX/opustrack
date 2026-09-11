import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * H-02 · the tenant scope of the incident-program report is not overridable.
 *
 * `incidentWindowWhere` used to spread the scope and then spread the
 * caller-supplied `clientIds` over it, so the second spread REPLACED the
 * scope's `clientId` key (the comment claimed the opposite). Any user with
 * `reports:view` could pull another Client's rows by passing its id. The
 * scope must survive as its own AND branch, and requested ids must narrow
 * to the intersection — never widen past the caller's Clients.
 */

const { prismaMock, getUserClientIds, userBox } = vi.hoisted(() => ({
  prismaMock: {
    incident: { findMany: vi.fn() },
  },
  getUserClientIds: vi.fn(async (_userId: string) => [] as string[]),
  userBox: {
    user: {
      id: "fsr1",
      isSuperuser: false,
      permissions: new Set<string>(),
    },
  },
}));

vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/auth", () => ({
  requirePermission: async (_name: string) => userBox.user,
}));
vi.mock("@/lib/utils/client-assignments", () => ({ getUserClientIds }));

import { getScheduleOptions } from "./incident-program";

const FILTERS = { startDate: "2026-06-15", endDate: "2026-06-21" };

beforeEach(() => {
  vi.clearAllMocks();
  userBox.user = {
    id: "fsr1",
    isSuperuser: false,
    permissions: new Set<string>(),
  };
  getUserClientIds.mockResolvedValue(["cA"]);
  prismaMock.incident.findMany.mockResolvedValue([]);
});

const lastWhere = () =>
  prismaMock.incident.findMany.mock.calls.at(-1)?.[0]?.where;

describe("getScheduleOptions · tenant scope (H-02)", () => {
  it("a requested client outside the scope cannot widen the query", async () => {
    await getScheduleOptions({ ...FILTERS, clientIds: ["cB"] });

    const raw = JSON.stringify(lastWhere());
    expect(raw).toContain("cA");
    expect(raw).not.toContain("cB");
  });

  it("applies the scope even when no client is requested", async () => {
    await getScheduleOptions({ ...FILTERS });

    expect(JSON.stringify(lastWhere())).toContain("cA");
  });
});
