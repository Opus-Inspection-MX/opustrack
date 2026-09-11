import { describe, expect, it } from "vitest";
import {
  PERMISSION_LIST,
  resolveSeedGrants,
  SEED_ROLES,
  type SeedRoleCode,
} from "@/lib/authz/permission-catalog";
import { prisma } from "@/lib/database/prisma.singleton";
import { assertLocalDatabase } from "../../../scripts/lib/db-guard";

/**
 * Catalog ↔ database convergence (integration).
 *
 * After `migrate deploy` + seed, every catalog permission must exist and be
 * active, and every seed role must hold exactly its catalog grants. The
 * comparison is asymmetric ON PURPOSE: re-seeding only ADDS rows, never
 * removes, so extra UI-created grants stay legitimate (the diff script
 * reports them as INFO) while a missing catalog grant fails (an H-06 hole).
 *
 * Runs in `test:int` (Fase 2): the ephemeral Postgres stack migrates and
 * seeds before this file, so the catalog is checked against a fresh seed.
 */
describe("catálogo ↔ base de datos", () => {
  it("los permisos del catálogo existen y están activos", async () => {
    assertLocalDatabase(process.env.DATABASE_URL);
    const rows = await prisma.permission.findMany({
      select: { name: true, active: true },
    });
    const byName = new Map(rows.map((row) => [row.name, row.active]));

    const offenders: string[] = [];
    for (const def of PERMISSION_LIST) {
      const active = byName.get(def.name);
      if (active !== true) {
        offenders.push(
          `${def.name} (${active === undefined ? "missing" : "inactive"})`,
        );
      }
    }
    expect(offenders).toEqual([]);
  });

  it("cada rol del seed conserva sus grants del catálogo", async () => {
    assertLocalDatabase(process.env.DATABASE_URL);
    const offenders: string[] = [];

    for (const code of Object.keys(SEED_ROLES) as SeedRoleCode[]) {
      const role = await prisma.role.findUnique({
        where: { name: code },
        include: {
          rolePermission: {
            where: { active: true },
            include: { permission: { select: { name: true, active: true } } },
          },
        },
      });
      if (!role || !role.active) {
        offenders.push(`role ${code} (missing or inactive)`);
        continue;
      }
      const held = new Set(
        role.rolePermission
          .filter((rp) => rp.permission.active)
          .map((rp) => rp.permission.name),
      );
      for (const grant of resolveSeedGrants(code)) {
        if (!held.has(grant)) offenders.push(`role ${code} lacks ${grant}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
