import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * H-18 · search and tenant scope compose with AND on GET /api/schedules.
 *
 * The handler used to set `where.OR` from the search text and then
 * `Object.assign` the scope over it, so the scope's own OR REPLACED the
 * search (search silently lost). Reversing the order would leak rows instead.
 * Both filters must survive as sibling AND branches.
 */

const { prismaMock, getUserClientIds, userBox } = vi.hoisted(() => ({
  prismaMock: {
    schedule: { count: vi.fn(), findMany: vi.fn() },
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
  withPermission:
    (_permission: string, handler: (req: Request, user: unknown) => unknown) =>
    (req: Request) =>
      handler(req, userBox.user),
}));
vi.mock("@/lib/utils/client-assignments", () => ({ getUserClientIds }));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  userBox.user = {
    id: "fsr1",
    isSuperuser: false,
    permissions: new Set<string>(),
  };
  getUserClientIds.mockResolvedValue(["c1"]);
  prismaMock.schedule.count.mockResolvedValue(0);
  prismaMock.schedule.findMany.mockResolvedValue([]);
});

const lastWhere = () =>
  prismaMock.schedule.findMany.mock.calls.at(-1)?.[0]?.where;

describe("GET /api/schedules · search + scope (H-18)", () => {
  it("keeps the search OR when the caller is scoped", async () => {
    await GET(new Request("http://localhost/api/schedules?search=manto"));

    const raw = JSON.stringify(lastWhere());
    expect(raw).toContain("manto");
    expect(raw).toContain("c1");
  });

  it("applies the scope when there is no search", async () => {
    await GET(new Request("http://localhost/api/schedules"));

    expect(JSON.stringify(lastWhere())).toContain("c1");
  });
});
