import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, getUserIdsWithPermission } = vi.hoisted(() => ({
  prismaMock: {
    user: { findMany: vi.fn() },
    incidentAssignee: { findMany: vi.fn() },
  },
  getUserIdsWithPermission: vi.fn(),
}));

vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: prismaMock }));
vi.mock("@/lib/authz/user-queries", async (importOriginal) => {
  // The audiences under test are real Prisma `where` fragments built with the
  // real helpers — only the DB round-trips are faked, so the assertions below
  // pin the actual fragment, not a mock of it.
  const actual =
    await importOriginal<typeof import("@/lib/authz/user-queries")>();
  return { ...actual, getUserIdsWithPermission };
});

import {
  broadcastAudience,
  getVacationApprovers,
  incidentStakeholders,
  operationsAudience,
  vacationApprovers,
} from "./audiences";

/**
 * Who gets told.
 *
 * Both rules broke silently once already: a single shared "admins" list sent
 * vacation requests to the operations administrators — who cannot approve them
 * — while the approvers heard nothing; and `incidents:update` mailed every new
 * incident to every FSR in every Client. These tests pin the audiences to the
 * CAPABILITY plus the Client scope, not to a role name.
 */

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.user.findMany.mockResolvedValue([{ id: "u1" }]);
  prismaMock.incidentAssignee.findMany.mockResolvedValue([]);
  getUserIdsWithPermission.mockResolvedValue(["u1"]);
});

function lastUserWhere(): string {
  const call = prismaMock.user.findMany.mock.calls.at(-1);
  return JSON.stringify(call?.[0]?.where ?? {});
}

describe("operationsAudience", () => {
  it("exige incidents:assign, nunca incidents:update", async () => {
    await operationsAudience("c1");

    const where = lastUserWhere();
    expect(where).toContain("incidents:assign");
    expect(where).not.toContain("incidents:update");
  });

  it("alcanza al Cliente por alcance global o por asignación", async () => {
    await operationsAudience("c1");

    const where = lastUserWhere();
    expect(where).toContain("scope:all-clients");
    expect(where).toContain("c1");
  });

  it("sin Cliente solo llega al alcance global (fail closed)", async () => {
    await operationsAudience(null);

    const where = lastUserWhere();
    expect(where).toContain("scope:all-clients");
    expect(where).not.toContain("clientAssignments");
  });

  it("un fallo resuelve a nadie, no propaga", async () => {
    prismaMock.user.findMany.mockRejectedValue(new Error("db caída"));

    await expect(operationsAudience("c1")).resolves.toEqual([]);
  });
});

describe("vacation approvers", () => {
  it("se resuelve por vacations:approve", async () => {
    await getVacationApprovers();
    expect(getUserIdsWithPermission).toHaveBeenCalledWith("vacations:approve");
  });

  it("vacationApprovers nunca propaga un fallo", async () => {
    getUserIdsWithPermission.mockRejectedValue(new Error("db caída"));

    await expect(vacationApprovers()).resolves.toEqual([]);
  });
});

describe("incidentStakeholders", () => {
  it("junta reportante, FSRs habilitados y audiencia de operación", async () => {
    prismaMock.incidentAssignee.findMany.mockResolvedValue([
      { userId: "fsr-1" },
      { userId: "fsr-2" },
    ]);
    prismaMock.user.findMany.mockResolvedValue([{ id: "ops-1" }]);

    const ids = await incidentStakeholders({
      incidentId: 7,
      clientId: "c1",
      reporterId: "rep-1",
    });

    expect(ids).toEqual(
      expect.arrayContaining(["rep-1", "fsr-1", "fsr-2", "ops-1"]),
    );
    expect(prismaMock.incidentAssignee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { incidentId: 7, active: true },
      }),
    );
  });

  it("un fallo resuelve a nadie", async () => {
    prismaMock.incidentAssignee.findMany.mockRejectedValue(
      new Error("db caída"),
    );

    await expect(
      incidentStakeholders({ incidentId: 7, clientId: "c1", reporterId: "r" }),
    ).resolves.toEqual([]);
  });
});

describe("broadcastAudience", () => {
  it("all llega a todos los usuarios activos", async () => {
    await broadcastAudience({ roleIds: [], all: true });

    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { active: true } }),
    );
  });

  it("por roles filtra con whereHasRoleId por cada rol", async () => {
    await broadcastAudience({ roleIds: [3, 5], all: false });

    const where = lastUserWhere();
    expect(where).toContain('"roleId":3');
    expect(where).toContain('"roleId":5');
  });

  it("sin roles y sin all no llega a nadie (fail closed)", async () => {
    await expect(
      broadcastAudience({ roleIds: [], all: false }),
    ).resolves.toEqual([]);
    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
  });

  it("une audiencia por rol y userIds directos", async () => {
    prismaMock.user.findMany
      .mockResolvedValueOnce([{ id: "r1" }, { id: "dup" }])
      .mockResolvedValueOnce([{ id: "dup" }, { id: "d1" }]);

    const ids = await broadcastAudience({
      roleIds: [3],
      all: false,
      userIds: ["dup", "d1"],
    });

    expect(ids).toEqual(expect.arrayContaining(["r1", "dup", "d1"]));
    expect(ids).toHaveLength(3);
  });

  it("los userIds directos filtran user.active siempre", async () => {
    prismaMock.user.findMany.mockResolvedValue([{ id: "d1" }]);

    await broadcastAudience({ roleIds: [], all: false, userIds: ["d1"] });

    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ["d1"] },
          active: true,
        }),
      }),
    );
  });
});
