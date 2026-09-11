import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { canAccessRoute } from "@/lib/authz/route-access";
import {
  isCatalogPermission,
  KNOWN_ROUTE_GAPS,
  PERMISSIONS,
  type PermissionName,
  resolveSeedGrants,
  ROOT_ONLY,
  ROUTE_REQUIRES,
  SEED_ROLES,
  type SeedRoleCode,
  validateGrants,
} from "./permission-catalog";
import { flattenMenu } from "@/lib/navigation/menu";

/**
 * The catalog is the single source of truth — enforced instead of remembered.
 *
 * H-06 happened because nothing connected "the code requires X" with "some
 * non-superuser role holds X": `tsc`, biome, mocked unit tests and a
 * superuser e2e all stayed green while operators hit generic errors. These
 * tests close that hole statically:
 *
 * - reachability: every permission the code requires is held by at least one
 *   non-superuser seed role, or is listed in ROOT_ONLY on purpose;
 * - route–action coherence: every role that opens a route also holds what the
 *   screens behind it require (known H-06 gaps listed explicitly, and each
 *   must still be genuinely missing so fixing one forces its entry out);
 * - menu coverage: every navigation route has its `route:*` in the catalog.
 *
 * H-20 (the seed silently skipping misspelled grants) is covered by
 * `validateGrants` throwing on unknown names.
 */

const NON_SUPERUSER_ROLES = (Object.keys(SEED_ROLES) as SeedRoleCode[]).filter(
  (role) => !SEED_ROLES[role].isSuperuser,
);

function grantsOf(role: SeedRoleCode): ReadonlySet<string> {
  return new Set(resolveSeedGrants(role));
}

describe("catálogo de permisos: forma", () => {
  it("no tiene nombres duplicados", () => {
    const names = PERMISSIONS.map((permission) => permission.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("cada grant de los roles existe en el catálogo", () => {
    const offenders: string[] = [];
    for (const role of Object.keys(SEED_ROLES) as SeedRoleCode[]) {
      for (const grant of SEED_ROLES[role].grants) {
        if (!isCatalogPermission(grant)) offenders.push(`${role} → ${grant}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("ROOT_ONLY solo lista permisos del catálogo que ningún rol operativo tiene", () => {
    const held = new Set<string>();
    for (const role of NON_SUPERUSER_ROLES) {
      for (const grant of grantsOf(role)) held.add(grant);
    }
    const offenders = ROOT_ONLY.filter((name) => held.has(name));
    expect(ROOT_ONLY.every(isCatalogPermission)).toBe(true);
    expect(offenders).toEqual([]);
  });

  it("ROUTE_REQUIRES y los gaps conocidos referencian permisos reales", () => {
    const offenders: string[] = [];
    for (const [route, required] of Object.entries(ROUTE_REQUIRES)) {
      if (!isCatalogPermission(route)) offenders.push(`ruta desconocida: ${route}`);
      for (const name of required) {
        if (!isCatalogPermission(name)) offenders.push(`${route} → ${name}`);
      }
    }
    for (const gap of KNOWN_ROUTE_GAPS) {
      if (!isCatalogPermission(gap.route)) offenders.push(`gap ruta: ${gap.route}`);
      for (const name of gap.missing) {
        if (!isCatalogPermission(name)) offenders.push(`gap ${gap.route} → ${name}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("H-20: el seed falla en vez de ignorar grants mal escritos", () => {
  it("validateGrants otorga lo conocido", () => {
    expect(validateGrants("ADMIN_OPERACION", ["incidents:read", "route:inicio"])).toEqual([
      "incidents:read",
      "route:inicio",
    ]);
  });

  it("validateGrants lanza nombrando el permiso desconocido", () => {
    expect(() => validateGrants("ADMIN_OPERACION", ["incidents:read", "incidents:cancelled"])).toThrow(
      /Unknown permission "incidents:cancelled" in seed grants for role "ADMIN_OPERACION"/,
    );
  });

  it("los grants resueltos de cada rol pasan la validación", () => {
    for (const role of Object.keys(SEED_ROLES) as SeedRoleCode[]) {
      expect(() => resolveSeedGrants(role)).not.toThrow();
    }
  });
});

/** Every non-test source file under src/. The catalog itself is the reference, not a requirer. */
function scannedSources(): string[] {
  const root = join(process.cwd(), "src");
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        walk(path);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry)) continue;
      if (entry.endsWith(".test.ts") || entry.endsWith(".test.tsx")) continue;
      if (entry === "permission-catalog.ts") continue;
      found.push(path);
    }
  };
  walk(root);
  return found;
}

type RequiredUse = { file: string; line: number; name: string };

/**
 * Every permission name the code requires, and where.
 *
 * Sources: `requirePermission("…")`, `withPermission("…")`, `canPerform("…")`
 * (plus the same-name helpers `assertPermission`, `userHasPermission`,
 * `whereHasPermission`, `getUserIdsWithPermission`, which enforce the same
 * names) and the `permissions` configs of `createCatalogActions` (whose
 * read/create/update/del flow into `requirePermission` at runtime, so a grep
 * for the call alone would miss them — e.g. `states:create`).
 */
function requiredPermissions(): RequiredUse[] {
  const callPattern =
    /(?:requirePermission|withPermission|canPerform|assertPermission|userHasPermission|whereHasPermission|getUserIdsWithPermission)\(\s*["']([^"'`$\n]+)["']/g;
  const catalogConfigPattern = /(?:read|create|update|del):\s*["']([^"'`$\n]+)["']/g;
  const found: RequiredUse[] = [];

  for (const file of scannedSources()) {
    const source = readFileSync(file, "utf8");
    const record = (index: number, name: string) => {
      found.push({
        file: file.replace(`${process.cwd()}/`, ""),
        line: source.slice(0, index).split("\n").length,
        name,
      });
    };
    for (const match of source.matchAll(callPattern)) {
      record(match.index ?? 0, match[1]);
    }
    if (source.includes("createCatalogActions")) {
      for (const match of source.matchAll(catalogConfigPattern)) {
        if (match[1].includes(":") && !match[1].startsWith("/")) {
          record(match.index ?? 0, match[1]);
        }
      }
    }
  }
  return found;
}

describe("alcanzabilidad: lo que el código exige lo tiene algún rol (H-06)", () => {
  it("cada permiso requerido está en el catálogo y lo tiene un rol operativo o está en ROOT_ONLY", () => {
    const held = new Set<string>();
    for (const role of NON_SUPERUSER_ROLES) {
      for (const grant of grantsOf(role)) held.add(grant);
    }
    const rootOnly = new Set<string>(ROOT_ONLY);

    const orphans: string[] = [];
    const outsideCatalog: string[] = [];
    for (const use of requiredPermissions()) {
      if (!isCatalogPermission(use.name)) {
        outsideCatalog.push(`${use.file}:${use.line} → ${use.name}`);
      } else if (!held.has(use.name) && !rootOnly.has(use.name)) {
        orphans.push(`${use.file}:${use.line} → ${use.name}`);
      }
    }
    expect(outsideCatalog).toEqual([]);
    expect(orphans).toEqual([]);
  });

  it("ROOT_ONLY no tiene entradas muertas: todo lo listado se exige de verdad", () => {
    const required = new Set(requiredPermissions().map((use) => use.name));
    const dead = (ROOT_ONLY as readonly string[]).filter((name) => !required.has(name));
    expect(dead).toEqual([]);
  });
});

describe("coherencia ruta–acciones", () => {
  it("cada rol con una ruta tiene los permisos de las pantallas tras ella", () => {
    const gaps = new Set(
      KNOWN_ROUTE_GAPS.flatMap((gap) =>
        gap.missing.map((name) => `${gap.role} ${gap.route} ${name}`),
      ),
    );
    const offenders: string[] = [];

    for (const [route, required] of Object.entries(ROUTE_REQUIRES)) {
      for (const role of NON_SUPERUSER_ROLES) {
        if (!grantsOf(role).has(route)) continue;
        const grants = grantsOf(role);
        for (const name of required) {
          if (grants.has(name)) continue;
          if (gaps.has(`${role} ${route} ${name}`)) continue;
          offenders.push(`${role} abre ${route} pero no tiene ${name}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("los gaps conocidos siguen siendo gaps reales (sin entradas muertas)", () => {
    const offenders: string[] = [];
    for (const gap of KNOWN_ROUTE_GAPS) {
      const listed = ROUTE_REQUIRES[gap.route] ?? [];
      for (const name of gap.missing) {
        if (!listed.includes(name)) {
          offenders.push(`${gap.route} ya no requiere ${name}: actualiza ROUTE_REQUIRES`);
          continue;
        }
        if (grantsOf(gap.role).has(name)) {
          offenders.push(
            `${gap.role} ya tiene ${name}: muévelo fuera de ROOT_ONLY y quita el gap (${gap.ref})`,
          );
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("cobertura del menú: cada ruta tiene su route:*", () => {
  it("toda URL del menú está cubierta por un permiso de ruta del catálogo", () => {
    const prefixes = PERMISSIONS.filter((p) => p.routePath && !p.exact).map(
      (p) => p.routePath as string,
    );
    const exact = PERMISSIONS.filter((p) => p.routePath && p.exact).map(
      (p) => p.routePath as string,
    );
    const uncovered = flattenMenu()
      .map((item) => item.url)
      .filter((url) => !canAccessRoute({ prefixes, exact }, false, url));
    expect(uncovered).toEqual([]);
  });

  it("los permisos de ruta existen como PermissionName tipado", () => {
    const routeNames = PERMISSIONS.filter((p) => p.routePath).map((p) => p.name);
    expect(routeNames.length).toBeGreaterThan(0);
    const check: PermissionName = "route:admin-tracking";
    expect(routeNames).toContain(check);
  });
});
