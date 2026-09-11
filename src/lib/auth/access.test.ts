import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, getUserClientIds } = vi.hoisted(() => ({
  prismaMock: {
    incident: { findFirst: vi.fn() },
    assignment: { findFirst: vi.fn() },
    line: { findFirst: vi.fn() },
    equipment: { findFirst: vi.fn() },
    schedule: { findFirst: vi.fn() },
    user: { count: vi.fn() },
  },
  getUserClientIds: vi.fn(async (_userId: string): Promise<string[]> => []),
}));

vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: prismaMock }));
vi.mock("@/lib/utils/client-assignments", () => ({
  getUserClientIds: (...args: unknown[]) =>
    (getUserClientIds as (...a: unknown[]) => unknown)(...args),
}));

import {
  mergeRoles,
  type Role,
  SCOPE_ALL_CLIENTS,
  type UserWithPermissions,
} from "@/lib/authz/authz";
import { getReportScope } from "@/lib/auth/report-scope";
import {
  assertBelongsToClient,
  clientInScope,
  ensureCallerIsAssigneeOrAdmin,
  loadAssignmentFor,
  loadEquipmentFor,
  loadIncidentFor,
  loadLineFor,
  requireClientAccess,
} from "./access";

function role(overrides: Partial<Role> = {}): Role {
  return {
    id: 2,
    name: "FSR",
    description: null,
    defaultPath: "/fsr",
    isSuperuser: false,
    priority: 50,
    permissions: [],
    ...overrides,
  };
}

function user(overrides: Partial<UserWithPermissions> = {}) {
  return {
    id: "u1",
    email: "fsr@opusinspection.com",
    name: "FSR",
    ...mergeRoles([role()]),
    ...overrides,
  } as UserWithPermissions;
}

function scopedUser() {
  getUserClientIds.mockResolvedValue(["c1"]);
  return user();
}

const admin = () =>
  user({
    ...mergeRoles([
      role({
        id: 1,
        name: "ADMIN_OPERACION",
        defaultPath: "/admin",
        priority: 80,
        permissions: [
          {
            id: 99,
            name: SCOPE_ALL_CLIENTS,
            description: null,
            resource: "scope",
            action: "all-clients",
            routePath: null,
            exact: false,
          },
        ],
      }),
    ]),
  });

beforeEach(() => {
  vi.clearAllMocks();
  getUserClientIds.mockResolvedValue(["c1"]);
});

describe("clientInScope (H-05, fail closed)", () => {
  it("lets an unrestricted scope reach every client, including null", () => {
    expect(clientInScope({ clientIds: null }, "c1")).toBe(true);
    expect(clientInScope({ clientIds: null }, null)).toBe(true);
  });

  it("checks membership for scoped users", () => {
    expect(clientInScope({ clientIds: ["c1"] }, "c1")).toBe(true);
    expect(clientInScope({ clientIds: ["c1"] }, "c9")).toBe(false);
  });

  it("denies null-client records to every restricted scope", () => {
    // The old backdoor let a client-less user read client-less records while
    // the listings hid them. Both doors now agree: null needs no restriction.
    expect(clientInScope({ clientIds: ["c1"] }, null)).toBe(false);
    expect(clientInScope({ clientIds: [] }, null)).toBe(false);
    expect(clientInScope({ clientIds: [] }, "c1")).toBe(false);
  });
});

describe("requireClientAccess agrees with getReportScope", () => {
  it("allows exactly what the resolved scope includes", async () => {
    const u = scopedUser();
    const scope = await getReportScope(u);
    expect(scope).toEqual({ clientIds: ["c1"] });
    await expect(requireClientAccess(u, "c1")).resolves.toBeUndefined();
    await expect(requireClientAccess(u, "c9")).rejects.toThrow(
      "Sin acceso a los datos de este Cliente.",
    );
    await expect(requireClientAccess(u, null)).rejects.toThrow(
      "Sin acceso a los datos de este Cliente.",
    );
  });

  it("lets an unrestricted caller reach any client", async () => {
    const a = admin();
    await expect(requireClientAccess(a, "c9")).resolves.toBeUndefined();
    await expect(requireClientAccess(a, null)).resolves.toBeUndefined();
  });
});

describe("loadIncidentFor", () => {
  it("returns the active, in-scope incident", async () => {
    prismaMock.incident.findFirst.mockResolvedValue({ id: 7, clientId: "c1" });
    await expect(loadIncidentFor(scopedUser(), 7)).resolves.toEqual({
      id: 7,
      clientId: "c1",
    });
    expect(prismaMock.incident.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 7, active: true } }),
    );
  });

  it("reports a missing or soft-deleted incident as not found", async () => {
    // findFirst with active:true returns null for both cases — the loader
    // cannot tell them apart, and must not (H-17).
    prismaMock.incident.findFirst.mockResolvedValue(null);
    await expect(loadIncidentFor(scopedUser(), 7)).rejects.toThrow(
      "No encontrado.",
    );
  });

  it("denies an out-of-scope incident without confirming it exists", async () => {
    prismaMock.incident.findFirst.mockResolvedValue({ id: 7, clientId: "c9" });
    await expect(loadIncidentFor(scopedUser(), 7)).rejects.toThrow(
      "Sin acceso a los datos de este Cliente.",
    );
  });

  it("denies a null-client incident to scoped users, allows it to admins", async () => {
    prismaMock.incident.findFirst.mockResolvedValue({ id: 7, clientId: null });
    await expect(loadIncidentFor(scopedUser(), 7)).rejects.toThrow(
      "Sin acceso a los datos de este Cliente.",
    );
    await expect(loadIncidentFor(admin(), 7)).resolves.toEqual({
      id: 7,
      clientId: null,
    });
  });
});

describe("loadAssignmentFor", () => {
  const row = (overrides = {}) => ({
    id: "a1",
    incidentId: 7,
    status: { name: "ASIGNADO" },
    incident: { clientId: "c1" },
    assignees: [{ userId: "u1" }],
    ...overrides,
  });

  it("reader: returns the active, in-scope assignment", async () => {
    prismaMock.assignment.findFirst.mockResolvedValue(row());
    await expect(loadAssignmentFor(scopedUser(), "a1", "reader")).resolves.toEqual(
      row(),
    );
    expect(prismaMock.assignment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "a1", active: true } }),
    );
  });

  it("reports a missing or soft-deleted assignment as not found (H-17)", async () => {
    prismaMock.assignment.findFirst.mockResolvedValue(null);
    await expect(loadAssignmentFor(scopedUser(), "a1", "worker")).rejects.toThrow(
      "No encontrado.",
    );
  });

  it("denies an assignment whose incident is out of scope", async () => {
    prismaMock.assignment.findFirst.mockResolvedValue(
      row({ incident: { clientId: "c9" } }),
    );
    await expect(loadAssignmentFor(scopedUser(), "a1", "reader")).rejects.toThrow(
      "Sin acceso a los datos de este Cliente.",
    );
  });

  it("worker: lets the assigned FSR through without a permission query", async () => {
    prismaMock.assignment.findFirst.mockResolvedValue(row());
    await expect(loadAssignmentFor(scopedUser(), "a1", "worker")).resolves.toEqual(
      row(),
    );
    expect(prismaMock.user.count).not.toHaveBeenCalled();
  });

  it("worker: denies a non-assignee without manage-all", async () => {
    prismaMock.assignment.findFirst.mockResolvedValue(
      row({ assignees: [{ userId: "other" }] }),
    );
    prismaMock.user.count.mockResolvedValue(0);
    await expect(loadAssignmentFor(scopedUser(), "a1", "worker")).rejects.toThrow(
      "Solo un FSR asignado o un administrador puede ejecutar esta acción",
    );
  });

  it("worker: lets a manage-all holder through on someone else's work", async () => {
    prismaMock.assignment.findFirst.mockResolvedValue(
      row({ assignees: [{ userId: "other" }] }),
    );
    prismaMock.user.count.mockResolvedValue(1);
    await expect(loadAssignmentFor(scopedUser(), "a1", "worker")).resolves.toEqual(
      row({ assignees: [{ userId: "other" }] }),
    );
  });

  it("manager: requires manage-all even for the assignee", async () => {
    prismaMock.assignment.findFirst.mockResolvedValue(row());
    prismaMock.user.count.mockResolvedValue(0);
    await expect(loadAssignmentFor(scopedUser(), "a1", "manager")).rejects.toThrow(
      "Solo un administrador puede editar esta asignación.",
    );
    prismaMock.user.count.mockResolvedValue(1);
    await expect(loadAssignmentFor(scopedUser(), "a1", "manager")).resolves.toEqual(
      row(),
    );
  });
});

describe("ensureCallerIsAssigneeOrAdmin", () => {
  it("returns true for an assignee without touching the database", async () => {
    await expect(
      ensureCallerIsAssigneeOrAdmin("u1", [{ userId: "u1" }]),
    ).resolves.toBe(true);
    expect(prismaMock.user.count).not.toHaveBeenCalled();
  });
});

describe("loadLineFor / loadEquipmentFor", () => {
  it("returns the active, in-scope line", async () => {
    prismaMock.line.findFirst.mockResolvedValue({ id: 3, clientId: "c1" });
    await expect(loadLineFor(scopedUser(), 3)).resolves.toEqual({
      id: 3,
      clientId: "c1",
    });
  });

  it("reports a missing or soft-deleted line as not found", async () => {
    prismaMock.line.findFirst.mockResolvedValue(null);
    await expect(loadLineFor(scopedUser(), 3)).rejects.toThrow("No encontrado.");
  });

  it("denies a line of another client", async () => {
    prismaMock.line.findFirst.mockResolvedValue({ id: 3, clientId: "c9" });
    await expect(loadLineFor(scopedUser(), 3)).rejects.toThrow(
      "Sin acceso a los datos de este Cliente.",
    );
  });

  it("reaches equipment through its line's client", async () => {
    prismaMock.equipment.findFirst.mockResolvedValue({
      id: 5,
      lineId: 3,
      line: { clientId: "c1" },
    });
    await expect(loadEquipmentFor(scopedUser(), 5)).resolves.toEqual({
      id: 5,
      lineId: 3,
      line: { clientId: "c1" },
    });
  });

  it("reports missing equipment as not found, foreign equipment as denied", async () => {
    prismaMock.equipment.findFirst.mockResolvedValue(null);
    await expect(loadEquipmentFor(scopedUser(), 5)).rejects.toThrow(
      "No encontrado.",
    );
    prismaMock.equipment.findFirst.mockResolvedValue({
      id: 5,
      lineId: 3,
      line: { clientId: "c9" },
    });
    await expect(loadEquipmentFor(scopedUser(), 5)).rejects.toThrow(
      "Sin acceso a los datos de este Cliente.",
    );
  });
});

describe("assertBelongsToClient", () => {
  it("passes when every reference belongs to the client", async () => {
    prismaMock.line.findFirst.mockResolvedValue({ clientId: "c1" });
    prismaMock.equipment.findFirst.mockResolvedValue({
      line: { clientId: "c1" },
    });
    prismaMock.schedule.findFirst.mockResolvedValue({
      clients: [{ clientId: "c1" }],
    });
    await expect(
      assertBelongsToClient({ lineId: 3, equipmentId: 5, scheduleId: "s1" }, "c1"),
    ).resolves.toBeUndefined();
  });

  it("passes with no references and no queries", async () => {
    await expect(assertBelongsToClient({}, "c1")).resolves.toBeUndefined();
    expect(prismaMock.line.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.equipment.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.schedule.findFirst).not.toHaveBeenCalled();
  });

  it("rejects a line of another client as not found", async () => {
    prismaMock.line.findFirst.mockResolvedValue({ clientId: "c9" });
    await expect(assertBelongsToClient({ lineId: 3 }, "c1")).rejects.toThrow(
      "No encontrado.",
    );
  });

  it("rejects missing references as not found", async () => {
    prismaMock.line.findFirst.mockResolvedValue(null);
    await expect(assertBelongsToClient({ lineId: 3 }, "c1")).rejects.toThrow(
      "No encontrado.",
    );
    prismaMock.equipment.findFirst.mockResolvedValue(null);
    await expect(assertBelongsToClient({ equipmentId: 5 }, "c1")).rejects.toThrow(
      "No encontrado.",
    );
    prismaMock.schedule.findFirst.mockResolvedValue(null);
    await expect(assertBelongsToClient({ scheduleId: "s1" }, "c1")).rejects.toThrow(
      "No encontrado.",
    );
  });

  it("accepts a global schedule, rejects a schedule linked elsewhere", async () => {
    prismaMock.schedule.findFirst.mockResolvedValue({ clients: [] });
    await expect(
      assertBelongsToClient({ scheduleId: "s1" }, "c1"),
    ).resolves.toBeUndefined();
    prismaMock.schedule.findFirst.mockResolvedValue({
      clients: [{ clientId: "c9" }],
    });
    await expect(assertBelongsToClient({ scheduleId: "s1" }, "c1")).rejects.toThrow(
      "No encontrado.",
    );
  });
});
