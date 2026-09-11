import { describe, expect, it } from "vitest";
import { flattenMenu, MENU } from "@/lib/navigation/menu";
import {
  isWidgetVisible,
  selectWidgets,
  WIDGETS,
  type WidgetDefinition,
  type WidgetId,
  type WidgetViewer,
} from "./widgets";

/**
 * Widget visibility matrix (Fase 3 · 3.2).
 *
 * Viewers are built from the grants in `initial_load/seed.example.ts` — the
 * permissions and routes each role actually holds — so this matrix fails if
 * the seed or the registry drift apart. Multi-role unions and the ROOT
 * bypass ride along because that is the whole point of the home.
 */

function viewer(
  permissions: string[],
  prefixes: string[],
  exact: string[] = [],
  isSuperuser = false,
): WidgetViewer {
  return {
    permissions,
    routeGrants: { prefixes, exact },
    isSuperuser,
  };
}

// Grants mirror the seed (permissions relevant to widgets + route paths).
const SEED = {
  ADMIN_OPERACION: viewer(
    [
      "incidents:read",
      "incidents:create",
      "assignments:read",
      "vehicle-trips:read",
      "schedules:read",
      "reports:view",
      "dashboard:view",
      "tracking:read",
      "tracking:update",
      "vacations:read",
      "vacations:create",
      "vacations:delete",
      "notifications:read",
    ],
    [
      "/admin/tracking",
      "/admin/incidents",
      "/admin/programacion",
      "/admin/schedules",
      "/admin/assignments",
      "/admin/assignment-activities",
      "/admin/reports",
      "/admin/clients",
      "/admin/lines",
      "/admin/equipments",
      "/admin/states",
      "/admin/vehicles",
      "/admin/notifications",
      "/inicio",
      "/notifications",
      "/profile",
      "/vacations",
    ],
    ["/admin"],
  ),
  ADMIN_VACACIONES: viewer(
    [
      "vacations:read",
      "vacations:create",
      "vacations:delete",
      "vacations:approve",
      "vacations:manage",
      "dashboard:view",
      "notifications:read",
    ],
    [
      "/admin/vacations",
      "/admin/holidays",
      "/admin/settings/vacation-accrual",
      "/inicio",
      "/notifications",
      "/profile",
      "/vacations",
    ],
    ["/admin"],
  ),
  FSR: viewer(
    [
      "incidents:read",
      "assignments:read",
      "schedules:read",
      "reports:view",
      "dashboard:view",
      "vehicle-trips:read",
      "vehicle-trips:create",
      "vacations:read",
      "vacations:create",
      "vacations:delete",
      "notifications:read",
    ],
    ["/fsr", "/inicio", "/notifications", "/profile", "/vacations"],
  ),
  EMPLEADO: viewer(
    [
      "vacations:read",
      "vacations:create",
      "vacations:delete",
      "notifications:read",
    ],
    ["/inicio", "/notifications", "/profile", "/vacations"],
  ),
  REPORTER: viewer(
    [
      "incidents:read",
      "incidents:create",
      "assignments:read",
      "schedules:read",
      "dashboard:view",
      "notifications:read",
    ],
    ["/reporter", "/inicio", "/notifications", "/profile"],
  ),
  GUEST: viewer(
    [
      "incidents:read",
      "assignments:read",
      "schedules:read",
      "dashboard:view",
      "notifications:read",
    ],
    ["/guest", "/inicio", "/notifications", "/profile"],
  ),
  ROOT: viewer([], [], [], true),
};

const ids = (defs: WidgetDefinition[]): WidgetId[] => defs.map((d) => d.id);

describe("selectWidgets · matriz de roles del seed", () => {
  it("FSR ve su trabajo, su viaje, sus vacaciones y agenda; no ve admin", () => {
    const seen = ids(selectWidgets(SEED.FSR));
    expect(seen).toEqual([
      "quick-actions",
      "notifications",
      "my-work",
      "my-active-trip",
      "my-vacation",
      "upcoming-schedules",
    ]);
    expect(seen).not.toContain("sla-risk");
    expect(seen).not.toContain("ops-kpis");
    expect(seen).not.toContain("tracking-queue");
  });

  it("REPORTER ve sus reportes y la agenda", () => {
    expect(ids(selectWidgets(SEED.REPORTER))).toEqual([
      "quick-actions",
      "notifications",
      "my-reports",
      "upcoming-schedules",
    ]);
  });

  it("GUEST no ve widgets de staff", () => {
    expect(ids(selectWidgets(SEED.GUEST))).toEqual([
      "quick-actions",
      "notifications",
      "upcoming-schedules",
    ]);
  });

  it("EMPLEADO solo ve notificaciones y sus vacaciones", () => {
    expect(ids(selectWidgets(SEED.EMPLEADO))).toEqual([
      "quick-actions",
      "notifications",
      "my-vacation",
    ]);
  });

  it("ADMIN_VACACIONES ve aprobaciones y ausencias, sin operación", () => {
    const seen = ids(selectWidgets(SEED.ADMIN_VACACIONES));
    expect(seen).toEqual([
      "quick-actions",
      "notifications",
      "my-vacation",
      "vacation-approvals",
      "upcoming-absences",
    ]);
    // Its exact /admin grant opens the landing only — it must NOT satisfy
    // the /admin/incidents prefix the ops widgets demand.
    expect(seen).not.toContain("ops-kpis");
    expect(seen).not.toContain("incidents-by-status");
    expect(seen).not.toContain("tracking-queue");
  });

  it("ADMIN_OPERACION ve la cola, los KPI y sus vacaciones", () => {
    expect(ids(selectWidgets(SEED.ADMIN_OPERACION))).toEqual([
      "quick-actions",
      "notifications",
      "my-vacation",
      "tracking-queue",
      "ops-kpis",
      "incidents-by-status",
      "sla-risk",
      "upcoming-schedules",
    ]);
  });

  it("ADMIN_VACACIONES + FSR ve la unión", () => {
    const both: WidgetViewer = {
      permissions: [
        ...(SEED.ADMIN_VACACIONES.permissions as string[]),
        ...(SEED.FSR.permissions as string[]),
      ],
      routeGrants: {
        prefixes: [
          ...(SEED.ADMIN_VACACIONES.routeGrants.prefixes as string[]),
          ...(SEED.FSR.routeGrants.prefixes as string[]),
        ],
        exact: ["/admin"],
      },
      isSuperuser: false,
    };
    expect(ids(selectWidgets(both))).toEqual([
      "quick-actions",
      "notifications",
      "my-work",
      "my-active-trip",
      "my-vacation",
      "vacation-approvals",
      "upcoming-absences",
      "upcoming-schedules",
    ]);
  });

  it("ROOT ve todo", () => {
    expect(selectWidgets(SEED.ROOT)).toHaveLength(WIDGETS.length);
  });
});

describe("registro · invariantes", () => {
  it("ids únicos y orden estable por prioridad", () => {
    const ids = WIDGETS.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
    const priorities = WIDGETS.map((w) => w.priority);
    expect([...priorities].sort((a, b) => a - b)).toEqual(priorities);
    // selectWidgets without filtering keeps registry order.
    expect(selectWidgets(SEED.ROOT).map((w) => w.id)).toEqual(ids);
  });

  it("toda requires.route está cubierta por algún URL del MENU", () => {
    const menuUrls = flattenMenu(MENU).map((item) =>
      item.url.replace(/\/$/, ""),
    );
    const uncovered = WIDGETS.filter(
      (w) =>
        w.requires.route &&
        !menuUrls.some(
          (url) =>
            w.requires.route === url ||
            (w.requires.route as string).startsWith(`${url}/`),
        ),
    ).map((w) => `${w.id} → ${w.requires.route}`);
    expect(uncovered).toEqual([]);
  });

  it("el doble chequeo frena al que tiene permiso sin ruta", () => {
    // FSR holds reports:view and dashboard:view — permission alone would
    // show it sla-risk and ops-kpis. The route half must stop that.
    const sla = WIDGETS.find((w) => w.id === "sla-risk") as WidgetDefinition;
    const ops = WIDGETS.find((w) => w.id === "ops-kpis") as WidgetDefinition;
    expect(isWidgetVisible(SEED.FSR, sla)).toBe(false);
    expect(isWidgetVisible(SEED.FSR, ops)).toBe(false);
  });
});
