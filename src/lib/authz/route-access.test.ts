import { describe, expect, it } from "vitest";
import {
  canAccessRoute,
  isPublicRoute,
  normalizeRoutePath,
} from "./route-access";

/** Prefix-only grants, the common case. */
const grants = (...prefixes: string[]) => ({ prefixes });

describe("normalizeRoutePath", () => {
  it("strips a trailing slash", () => {
    expect(normalizeRoutePath("/fsr/")).toBe("/fsr");
  });

  it("keeps the root path", () => {
    expect(normalizeRoutePath("/")).toBe("/");
    expect(normalizeRoutePath("")).toBe("/");
  });

  it("leaves an already-normal path untouched", () => {
    expect(normalizeRoutePath("/admin/reports")).toBe("/admin/reports");
  });
});

describe("canAccessRoute", () => {
  const fsrRoutes = ["/fsr", "/incidents", "/profile"];

  it("grants an exact match", () => {
    expect(canAccessRoute(grants(...fsrRoutes), false, "/fsr")).toBe(true);
  });

  it("grants a sub-route", () => {
    expect(
      canAccessRoute(grants(...fsrRoutes), false, "/fsr/assignments/new"),
    ).toBe(true);
  });

  it("normalizes a trailing slash", () => {
    expect(canAccessRoute(grants(...fsrRoutes), false, "/fsr/")).toBe(true);
  });

  it("denies a route the role has no permission for", () => {
    expect(canAccessRoute(grants(...fsrRoutes), false, "/admin")).toBe(false);
    expect(canAccessRoute(grants(...fsrRoutes), false, "/admin/reports")).toBe(
      false,
    );
  });

  it("does not let a prefix leak across a path segment", () => {
    // "/fsr" must not grant "/fsr-admin" — the old startsWith check did.
    expect(canAccessRoute(grants(...fsrRoutes), false, "/fsr-admin")).toBe(
      false,
    );
    expect(canAccessRoute(grants("/reports"), false, "/reports-internal")).toBe(
      false,
    );
  });

  it("grants a superuser everything, even with no route permissions", () => {
    // The bypass is a capability now, not the role NAME "ADMINISTRADOR": that
    // string also meant "sees every Cliente", and fusing the two would have
    // made every operations admin a second root.
    expect(canAccessRoute(grants(), true, "/admin/holidays")).toBe(true);
    expect(canAccessRoute(grants(), true, "/literally/anything")).toBe(true);
  });

  it("grants an exact route without granting what is under it", () => {
    // This is what lets a vacation admin open the /admin landing page while
    // /admin/incidents stays closed.
    const vacationAdmin = {
      prefixes: ["/admin/vacations"],
      exact: ["/admin"],
    };
    expect(canAccessRoute(vacationAdmin, false, "/admin")).toBe(true);
    expect(canAccessRoute(vacationAdmin, false, "/admin/")).toBe(true);
    expect(canAccessRoute(vacationAdmin, false, "/admin/vacations")).toBe(true);
    expect(canAccessRoute(vacationAdmin, false, "/admin/incidents")).toBe(
      false,
    );
    expect(canAccessRoute(vacationAdmin, false, "/admin/roles")).toBe(false);
  });

  it("denies everything when the role has no routes and is not admin", () => {
    // A role created from the admin UI starts with no route permissions; it
    // must be denied rather than silently inherit another role's routes.
    expect(canAccessRoute(grants(), false, "/nuevo")).toBe(false);
  });

  it("ignores blank entries in the route list", () => {
    expect(canAccessRoute(grants("", "/fsr"), false, "/admin")).toBe(false);
    expect(canAccessRoute(grants("", "/fsr"), false, "/fsr")).toBe(true);
  });

  it("treats a root route permission as full access", () => {
    expect(canAccessRoute(grants("/"), false, "/anything")).toBe(true);
  });
});

describe("isPublicRoute", () => {
  it("recognizes the auth pages", () => {
    for (const path of ["/login", "/signup", "/logout", "/unauthorized"]) {
      expect(isPublicRoute(path)).toBe(true);
    }
  });

  it("recognizes framework and asset prefixes", () => {
    expect(isPublicRoute("/_next/static/chunk.js")).toBe(true);
    expect(isPublicRoute("/favicon.ico")).toBe(true);
    expect(isPublicRoute("/images/logo.png")).toBe(true);
    expect(isPublicRoute("/api/auth/session")).toBe(true);
  });

  it("treats uploaded files as public", () => {
    // The filesystem storage provider writes into public/uploads and the app
    // renders those paths with next/image. Gating them behind the session made
    // every attachment redirect to /login, so next/image received HTML and
    // rendered nothing. Vercel Blob — the production provider — serves its
    // files publicly too, so this matches the shipped behaviour.
    expect(isPublicRoute("/uploads/assignments/1712-evidencia.png")).toBe(true);
    expect(isPublicRoute("/uploads")).toBe(true);
  });

  it("does not treat application routes as public", () => {
    expect(isPublicRoute("/admin")).toBe(false);
    expect(isPublicRoute("/fsr")).toBe(false);
    expect(isPublicRoute("/api/reports/incident-program")).toBe(false);
  });
});
