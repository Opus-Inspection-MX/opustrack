import { describe, expect, it } from "vitest";
import type { RouteGrants } from "@/lib/authz/route-access";
import { breadcrumbsFor, flattenMenu, MENU, visibleMenu } from "./menu";

/**
 * The menu registry is the contract the sidebar, the tab bar, the command
 * palette, and the breadcrumbs all read from. These tests pin the rules that
 * keep the e2e suite green: filtering is by reachable route, hidden report
 * pages stay out of the sidebar but visible to breadcrumbs, and the six
 * e2e-guarded labels keep their exact titles.
 */

function grants(prefixes: string[], exact: string[] = []): RouteGrants {
  return { prefixes, exact };
}

describe("visibleMenu", () => {
  it("shows only routes the grants can open", () => {
    const menu = visibleMenu(grants(["/admin/vacations", "/vacations"]), false);
    const urls = flattenMenu(menu).map((item) => item.url);
    expect(urls).toContain("/admin/vacations");
    expect(urls).toContain("/vacations");
    expect(urls).not.toContain("/admin/roles");
    expect(urls).not.toContain("/admin/incidents");
  });

  it("drops sections and groups left empty", () => {
    const menu = visibleMenu(grants(["/vacations"]), false);
    expect(menu).toHaveLength(1); // only "Mi trabajo" survives
    for (const group of menu) {
      expect(group.sections.length).toBeGreaterThan(0);
      for (const section of group.sections) {
        expect(section.items.length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps the e2e-guarded labels with exact titles", () => {
    const menu = visibleMenu(
      grants([
        "/admin/vacations",
        "/vacations",
        "/fsr/assignments",
        "/admin/users",
        "/admin/roles",
        "/admin/incidents",
      ]),
      false,
    );
    const titles = flattenMenu(menu).map((item) => item.title);
    for (const required of [
      "Solicitudes",
      "Mis Vacaciones",
      "Mis Asignaciones",
      "Roles",
      "Usuarios",
      "Incidentes",
    ]) {
      expect(titles).toContain(required);
    }
  });

  it("hides administration and operation from ADMIN_VACACIONES", () => {
    const menu = visibleMenu(
      grants(["/admin/vacations", "/vacations", "/profile", "/notifications"]),
      false,
    );
    const titles = flattenMenu(menu).map((item) => item.title);
    expect(titles).toContain("Solicitudes");
    expect(titles).toContain("Mis Vacaciones");
    for (const forbidden of ["Roles", "Usuarios", "Incidentes"]) {
      expect(titles.filter((title) => title.includes(forbidden))).toHaveLength(
        0,
      );
    }
  });

  it("lists only the Reportes index in the sidebar", () => {
    const menu = visibleMenu(grants(["/admin/reports"]), true);
    const reportGroup = menu.find((group) => group.title === "Reportes");
    expect(reportGroup).toBeDefined();
    if (!reportGroup) return;
    expect(flattenMenu([reportGroup]).map((item) => item.url)).toEqual([
      "/admin/reports",
    ]);
  });

  it("exposes hidden report pages with includeHidden", () => {
    const menu = visibleMenu(grants(["/admin/reports"]), true, {
      includeHidden: true,
    });
    const urls = flattenMenu(menu).map((item) => item.url);
    expect(urls).toContain("/admin/reports/fsr-performance");
    expect(urls).toContain("/admin/reports/incident-program");
  });

  it("lets the superuser through everywhere", () => {
    const menu = visibleMenu(grants([]), true);
    expect(menu).toHaveLength(5);
    expect(flattenMenu(menu).length).toBeGreaterThan(30);
  });
});

describe("flattenMenu", () => {
  it("tags every item with its group and section", () => {
    const flat = flattenMenu(MENU);
    const tracking = flat.find((item) => item.url === "/admin/tracking");
    expect(tracking?.group).toBe("Operación");
    expect(tracking?.section).toBe("Incidentes");
    const roles = flat.find((item) => item.url === "/admin/roles");
    expect(roles?.group).toBe("Administración");
    expect(roles?.section).toBe("Usuarios y Roles");
  });

  it("includes sidebar-hidden report pages", () => {
    const flat = flattenMenu(MENU);
    expect(
      flat.find((item) => item.url === "/admin/reports/seen-time")?.group,
    ).toBe("Reportes");
  });
});

describe("breadcrumbsFor", () => {
  it("returns group and page for a top-level item", () => {
    expect(breadcrumbsFor("/admin/incidents")).toEqual([
      { title: "Operación" },
      { title: "Incidentes" },
    ]);
  });

  it("links the list page when standing on a detail page", () => {
    expect(breadcrumbsFor("/admin/incidents/abc123")).toEqual([
      { title: "Operación" },
      { title: "Incidentes", url: "/admin/incidents" },
    ]);
  });

  it("nests a report under the Reportes index", () => {
    expect(breadcrumbsFor("/admin/reports/fsr-performance")).toEqual([
      { title: "Reportes" },
      { title: "Reportes", url: "/admin/reports" },
      { title: "Rendimiento FSR" },
    ]);
  });

  it("never drags in same-prefix items from another group", () => {
    const crumbs = breadcrumbsFor("/admin/incidents");
    expect(crumbs.map((crumb) => crumb.title)).not.toContain("Panel");
  });

  it("returns [] for unknown paths", () => {
    expect(breadcrumbsFor("/no-existe")).toEqual([]);
  });

  it("respects the filtered menu it is given", () => {
    const menu = visibleMenu(
      grants(["/admin/vacations", "/vacations"]),
      false,
      { includeHidden: true },
    );
    expect(breadcrumbsFor("/admin/roles", menu)).toEqual([]);
    expect(breadcrumbsFor("/admin/vacations", menu)).toEqual([
      { title: "Administración" },
      { title: "Solicitudes" },
    ]);
  });
});
