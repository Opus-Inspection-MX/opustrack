import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, requirePermission } = vi.hoisted(() => ({
  prismaMock: {
    vacation: { findMany: vi.fn(), count: vi.fn() },
    vacationStatus: { findFirst: vi.fn() },
  },
  requirePermission: vi.fn(),
}));

vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/auth", () => ({ requirePermission }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { getVacations } from "./vacations";

/**
 * Fase 5e (H-19): pending-first ordering belongs in the query.
 *
 * Sorting in memory after pagination buries page-2 pendings under history.
 * With 25 decided requests and one old pending, the pending request must
 * surface on page 1 — via a pending slice plus a rest slice, not via
 * post-sort luck.
 *
 * No integration infra exists on main yet (Fase 2): the mocked delegate
 * below behaves like Postgres (filter → sort → paginate per query).
 * TODO(int): promote to an int test with 25 rows + old pending once Fase 2
 * infra lands.
 */

const PENDIENTE = 1;
const APROBADA = 2;

interface Row {
  id: string;
  statusId: number;
  startDate: Date;
  status: { name: string };
}

function seed(): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < 25; i++) {
    rows.push({
      id: `decided-${i}`,
      statusId: APROBADA,
      startDate: new Date(Date.UTC(2026, 7, 1 + i)),
      status: { name: "APROBADA" },
    });
  }
  rows.push({
    id: "old-pending",
    statusId: PENDIENTE,
    startDate: new Date(Date.UTC(2026, 0, 5)),
    status: { name: "PENDIENTE" },
  });
  return rows;
}

/** Postgres-like findMany over the seed: filter, order, then paginate. */
type StatusFilter = number | { not: number } | undefined;

function installSeed(rows: Row[]) {
  const applyWhere = (where: { statusId?: StatusFilter }): Row[] => {
    const filter = where.statusId;
    if (typeof filter === "number") {
      return rows.filter((r) => r.statusId === filter);
    }
    if (filter && typeof filter === "object") {
      return rows.filter((r) => r.statusId !== filter.not);
    }
    return [...rows];
  };
  prismaMock.vacation.findMany.mockImplementation(
    async (args: {
      where: { statusId?: number | { not: number } };
      orderBy: Array<{ startDate: string }>;
      skip: number;
      take: number;
    }) => {
      const filtered = applyWhere(args.where).sort(
        (a, b) => b.startDate.getTime() - a.startDate.getTime(),
      );
      return filtered.slice(args.skip, args.skip + args.take);
    },
  );
  prismaMock.vacation.count.mockImplementation(
    async (args: { where: { statusId?: number | { not: number } } }) =>
      applyWhere(args.where).length,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  requirePermission.mockResolvedValue({
    id: "admin-1",
    permissions: new Set(["vacations:manage"]),
  });
  prismaMock.vacationStatus.findFirst.mockResolvedValue({ id: PENDIENTE });
  installSeed(seed());
});

describe("getVacations pending-first pagination", () => {
  it("pone una pendiente antigua en la página 1 aunque haya 25 decididas", async () => {
    const page = await getVacations({ page: 1, limit: 20 });

    expect(page.pagination.total).toBe(26);
    expect(page.data).toHaveLength(20);
    expect(page.data[0].id).toBe("old-pending");
    expect(page.data.filter((r) => r.status.name === "PENDIENTE")).toHaveLength(
      1,
    );
  });

  it("particiona pendientes y resto en la consulta, sin duplicar entre páginas", async () => {
    const first = await getVacations({ page: 1, limit: 20 });
    const second = await getVacations({ page: 2, limit: 20 });

    // One query per partition (plus counts) — never a full page re-sorted
    // in memory.
    const partitions = (
      prismaMock.vacation.findMany.mock.calls as unknown as [
        { where: { statusId?: StatusFilter } },
      ][]
    ).filter(([args]) => args.where.statusId !== undefined);
    expect(partitions.length).toBeGreaterThanOrEqual(2);

    const ids = [...first.data, ...second.data].map((r) => r.id);
    expect(new Set(ids).size).toBe(26);
    expect(second.data.map((r) => r.id)).not.toContain("old-pending");
  });
});
