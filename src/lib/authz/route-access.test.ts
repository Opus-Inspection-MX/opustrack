import { describe, expect, it } from "vitest";
import {
  ADMIN_ROLE_NAME,
  canAccessRoute,
  isPublicRoute,
  normalizeRoutePath,
} from "./route-access";

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
    expect(canAccessRoute(fsrRoutes, "FSR", "/fsr")).toBe(true);
  });

  it("grants a sub-route", () => {
    expect(canAccessRoute(fsrRoutes, "FSR", "/fsr/vacations/new")).toBe(true);
  });

  it("normalizes a trailing slash", () => {
    expect(canAccessRoute(fsrRoutes, "FSR", "/fsr/")).toBe(true);
  });

  it("denies a route the role has no permission for", () => {
    expect(canAccessRoute(fsrRoutes, "FSR", "/admin")).toBe(false);
    expect(canAccessRoute(fsrRoutes, "FSR", "/admin/reports")).toBe(false);
  });

  it("does not let a prefix leak across a path segment", () => {
    // "/fsr" must not grant "/fsr-admin" — the old startsWith check did.
    expect(canAccessRoute(fsrRoutes, "FSR", "/fsr-admin")).toBe(false);
    expect(canAccessRoute(["/reports"], "FSR", "/reports-internal")).toBe(
      false,
    );
  });

  it("grants ADMINISTRADOR everything, even with no route permissions", () => {
    expect(canAccessRoute([], ADMIN_ROLE_NAME, "/admin/holidays")).toBe(true);
    expect(canAccessRoute([], ADMIN_ROLE_NAME, "/literally/anything")).toBe(
      true,
    );
  });

  it("denies everything when the role has no routes and is not admin", () => {
    // A role created from the admin UI starts with no route permissions; it
    // must be denied rather than silently inherit another role's routes.
    expect(canAccessRoute([], "NUEVO_ROL", "/nuevo")).toBe(false);
  });

  it("ignores blank entries in the route list", () => {
    expect(canAccessRoute(["", "/fsr"], "FSR", "/admin")).toBe(false);
    expect(canAccessRoute(["", "/fsr"], "FSR", "/fsr")).toBe(true);
  });

  it("treats a root route permission as full access", () => {
    expect(canAccessRoute(["/"], "GUEST", "/anything")).toBe(true);
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
