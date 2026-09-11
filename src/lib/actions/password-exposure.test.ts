import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * H-01: the password hash must never reach the browser inside a Server
 * Action response. The global `omit` on the Prisma client is the net; the
 * explicit `select` shapes below are the second layer: nested User data is
 * limited to what the screens render (id, name, email, status, roles).
 *
 * These tests assert on the query arguments (what the action asks Prisma
 * for) because a mocked client cannot reproduce the real client's omission.
 * Against the real client, anything not selected/omitted never leaves the
 * database driver.
 */

const mocks = vi.hoisted(() => ({
  userFindMany: vi.fn(),
  userFindUnique: vi.fn(),
  userCount: vi.fn(),
  clientFindUnique: vi.fn(),
  activityFindUnique: vi.fn(),
  assignmentFindUnique: vi.fn(),
  incidentCreate: vi.fn(),
  incidentUpdate: vi.fn(),
  incidentFindUnique: vi.fn(),
  incidentStatusFindUnique: vi.fn(),
  incidentTypeFindUnique: vi.fn(),
  incidentEventCreate: vi.fn(),
  incidentAssigneeFindMany: vi.fn(),
  requirePermission: vi.fn(async (_name: string) => ({ id: "actor-1" })),
  requireAuth: vi.fn(async () => ({ id: "actor-1" })),
  notifyIncidentCreated: vi.fn(),
  notifyIncidentUpdated: vi.fn(),
}));

vi.mock("@/lib/database/prisma.singleton", () => ({
  prisma: {
    user: {
      findMany: mocks.userFindMany,
      findUnique: mocks.userFindUnique,
      count: mocks.userCount,
    },
    client: { findUnique: mocks.clientFindUnique },
    assignmentActivity: { findUnique: mocks.activityFindUnique },
    assignment: { findUnique: mocks.assignmentFindUnique },
    incident: {
      create: mocks.incidentCreate,
      update: mocks.incidentUpdate,
      findUnique: mocks.incidentFindUnique,
    },
    incidentStatus: { findUnique: mocks.incidentStatusFindUnique },
    incidentType: { findUnique: mocks.incidentTypeFindUnique },
    incidentEvent: { create: mocks.incidentEventCreate },
    incidentAssignee: { findMany: mocks.incidentAssigneeFindMany },
  },
}));
vi.mock("@/lib/auth/auth", () => ({
  requirePermission: (name: string) => mocks.requirePermission(name),
  requireAuth: () => mocks.requireAuth(),
}));
vi.mock("@/lib/auth/filters", () => ({
  assertClientAccessAsync: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/notifications", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  notifyIncidentCreated: mocks.notifyIncidentCreated,
  notifyIncidentUpdated: mocks.notifyIncidentUpdated,
}));

import { getAssignmentActivityById } from "./assignment-activities";
import { getAssignmentById } from "./assignments";
import { getClientById } from "./clients";
import { createIncident, updateIncident } from "./incidents";
import { getMyProfile, getUserById, getUsers } from "./users";

const SAFE_USER_SELECT = { id: true, name: true, email: true };

function queryJson(call: unknown): string {
  return JSON.stringify(call ?? null);
}

function expectNoPasswordLeak(call: unknown) {
  const json = queryJson(call);
  expect(json).not.toContain("password");
  // A bare `user: true` / `reportedBy: true` drags every scalar along.
  expect(json).not.toContain('"user":true');
  expect(json).not.toContain('"reportedBy":true');
}

/** Every nested user selection must stay within the safe allowlist. */
function nestedUserSelects(
  call: unknown,
  path: string,
): Array<Record<string, unknown>> {
  const selects: Array<Record<string, unknown>> = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    for (const [key, value] of Object.entries(
      node as Record<string, unknown>,
    )) {
      if (
        (key === "user" || key === "reportedBy") &&
        value &&
        typeof value === "object" &&
        "select" in (value as Record<string, unknown>)
      ) {
        selects.push(
          (value as Record<string, { select?: Record<string, unknown> }>)
            .select as Record<string, unknown>,
        );
      }
      visit(value);
    }
  };
  visit(call);
  expect(
    selects.length,
    `expected a nested user select at ${path}`,
  ).toBeGreaterThan(0);
  const allowed = new Set([
    "id",
    "name",
    "email",
    "active",
    "userStatus",
    "userRoles",
  ]);
  for (const select of selects) {
    for (const key of Object.keys(select)) {
      expect(
        allowed.has(key),
        `unsafe nested user key "${key}" at ${path}`,
      ).toBe(true);
    }
  }
  return selects;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.incidentStatusFindUnique.mockResolvedValue({ id: 7 });
  mocks.incidentTypeFindUnique.mockResolvedValue({ id: 3 });
  mocks.incidentEventCreate.mockResolvedValue({} as never);
  mocks.incidentAssigneeFindMany.mockResolvedValue([]);
});

describe("top-level user reads", () => {
  it("getUsers asks for relations without the password and returns no password key", async () => {
    // Shape the real client returns once the global omit applies.
    mocks.userFindMany.mockResolvedValue([
      {
        id: "u1",
        name: "Ana",
        email: "ana@example.com",
        clientAssignments: [],
      },
    ]);
    mocks.userCount.mockResolvedValue(1);

    const result = await getUsers();

    expectNoPasswordLeak(mocks.userFindMany.mock.calls[0]?.[0]);
    for (const row of result.data) {
      expect(row).not.toHaveProperty("password");
    }
  });

  it("getUserById asks for relations without the password and returns no password key", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: "u1",
      name: "Ana",
      email: "ana@example.com",
      clientAssignments: [],
    });

    const result = await getUserById("u1");

    expectNoPasswordLeak(mocks.userFindUnique.mock.calls[0]?.[0]);
    expect(result).not.toHaveProperty("password");
  });

  it("getMyProfile returns no password key", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: "actor-1",
      name: "Yo",
      email: "yo@example.com",
      clientAssignments: [],
    });

    const result = await getMyProfile();

    expectNoPasswordLeak(mocks.userFindUnique.mock.calls[0]?.[0]);
    expect(result).not.toHaveProperty("password");
  });
});

describe("nested user reads", () => {
  it("getClientById selects assigned users with the safe card", async () => {
    mocks.clientFindUnique.mockResolvedValue({
      id: "c1",
      userAssignments: [],
      _count: { userAssignments: 0 },
    });

    await getClientById("c1");

    const call = mocks.clientFindUnique.mock.calls[0]?.[0];
    expectNoPasswordLeak(call);
    const selects = nestedUserSelects(call, "getClientById");
    for (const select of selects) {
      expect(select).toMatchObject(SAFE_USER_SELECT);
    }
  });

  it("getAssignmentActivityById selects assignees with the safe card", async () => {
    mocks.activityFindUnique.mockResolvedValue({ id: "a1" });

    await getAssignmentActivityById("a1");

    const call = mocks.activityFindUnique.mock.calls[0]?.[0];
    expectNoPasswordLeak(call);
    const selects = nestedUserSelects(call, "getAssignmentActivityById");
    for (const select of selects) {
      expect(select).toMatchObject(SAFE_USER_SELECT);
    }
  });

  it("getAssignmentById selects the reporter with the safe card", async () => {
    mocks.assignmentFindUnique.mockResolvedValue({
      id: "a1",
      incident: { clientId: null },
    });

    await getAssignmentById("a1");

    const call = mocks.assignmentFindUnique.mock.calls[0]?.[0];
    expectNoPasswordLeak(call);
    const selects = nestedUserSelects(call, "getAssignmentById");
    for (const select of selects) {
      expect(select).toMatchObject(SAFE_USER_SELECT);
    }
  });

  it("createIncident selects the reporter with the safe card", async () => {
    mocks.incidentCreate.mockResolvedValue({
      id: 1,
      title: "Pump failure",
      clientId: null,
    });

    const result = await createIncident({
      title: "Pump failure",
      description: "The pump does not start",
    });

    expect(result.success).toBe(true);
    const call = mocks.incidentCreate.mock.calls[0]?.[0];
    expectNoPasswordLeak(call);
    const selects = nestedUserSelects(call, "createIncident");
    for (const select of selects) {
      expect(select).toMatchObject(SAFE_USER_SELECT);
    }
  });

  it("updateIncident selects the reporter with the safe card", async () => {
    mocks.incidentFindUnique.mockResolvedValue({ clientId: "c1" });
    mocks.incidentUpdate.mockResolvedValue({ id: 1, title: "New title" });

    const result = await updateIncident(1, {
      title: "New title",
      description: "New description",
    });

    expect(result.success).toBe(true);
    const call = mocks.incidentUpdate.mock.calls[0]?.[0];
    expectNoPasswordLeak(call);
    const selects = nestedUserSelects(call, "updateIncident");
    for (const select of selects) {
      expect(select).toMatchObject(SAFE_USER_SELECT);
    }
  });
});
