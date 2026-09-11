import { describe, expect, it } from "vitest";
import { flattenMenu, MENU } from "@/lib/navigation/menu";
import {
  QUICK_ACTIONS,
  visibleQuickActions,
} from "./quick-actions";
import type { WidgetViewer } from "./widgets";

function viewer(
  permissions: string[],
  prefixes: string[],
  isSuperuser = false,
): WidgetViewer {
  return { permissions, routeGrants: { prefixes }, isSuperuser };
}

const FSR = viewer(
  ["incidents:create", "vehicle-trips:create", "vacations:create"],
  ["/fsr", "/vacations", "/inicio"],
);

describe("visibleQuickActions", () => {
  it("filtra por permiso y ruta a la vez", () => {
    const titles = visibleQuickActions(FSR, 10).map((a) => a.title);
    // FSR holds incidents:create but no /reporter route: the page would
    // not open, so the action must not show either.
    expect(titles).not.toContain("Reportar incidente");
    expect(titles).toContain("Iniciar viaje");
    expect(titles).toContain("Solicitar vacaciones");
    // No tracking grant, no tracking action.
    expect(titles).not.toContain("Seguimiento");
    expect(titles).not.toContain("Aprobar vacaciones");
  });

  it("un permiso sin ruta no alcanza", () => {
    const noRoute = viewer(["tracking:read"], ["/inicio"]);
    expect(
      visibleQuickActions(noRoute, 10).map((a) => a.title),
    ).not.toContain("Seguimiento");
  });

  it("respeta el tope", () => {
    const root = viewer([], [], true);
    expect(visibleQuickActions(root, 3)).toHaveLength(3);
    expect(visibleQuickActions(root)).toHaveLength(6);
    expect(visibleQuickActions(root, 20)).toHaveLength(QUICK_ACTIONS.length);
  });

  it("cada acción vive bajo algún URL del MENU", () => {
    // The row must never offer a page the sidebar cannot reach: every
    // action URL is either a menu URL or sits under one (prefix).
    const menuUrls = flattenMenu(MENU).map((item) =>
      item.url.replace(/\/$/, ""),
    );
    const uncovered = QUICK_ACTIONS.filter(
      (action) =>
        !menuUrls.some(
          (url) => action.url === url || action.url.startsWith(`${url}/`),
        ),
    ).map((a) => `${a.title} → ${a.url}`);
    expect(uncovered).toEqual([]);
  });
});
