/**
 * Route-access matching, shared by the Edge middleware and the server-side
 * authorization helpers.
 *
 * This module is intentionally dependency-free (no Prisma, no Node APIs) so the
 * middleware can import it on the Edge runtime. The route list it matches
 * against comes from the database — `Permission.routePath` for the user's role,
 * carried in the JWT — so there are no hardcoded per-role route tables.
 */

/** Role that bypasses every route check. */
export const ADMIN_ROLE_NAME = "ADMINISTRADOR";

/** Paths served without authentication. */
const PUBLIC_PATHS = new Set(["/login", "/signup", "/logout", "/unauthorized"]);

/**
 * `/uploads` is public because the filesystem storage provider writes there
 * (public/uploads/…) and the app renders those paths with next/image. Behind
 * the session check every attachment redirected to /login, so the optimizer
 * received HTML and no image ever rendered. The production provider (Vercel
 * Blob) also serves its files publicly, so this matches what ships.
 */
const PUBLIC_PREFIXES = [
  "/_next",
  "/favicon",
  "/images",
  "/uploads",
  "/api/auth",
];

/** Strip a trailing slash so `/fsr/` and `/fsr` compare equal. */
export function normalizeRoutePath(path: string): string {
  return path.replace(/\/$/, "") || "/";
}

/** True when the path is reachable without a session. */
export function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_PATHS.has(normalizeRoutePath(pathname))) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Whether `pathname` is covered by `routePath`.
 *
 * Matching is segment-aware: `/fsr` grants `/fsr` and `/fsr/vacations` but not
 * `/fsr-admin`. A plain `startsWith` would leak across the segment boundary.
 */
function routeCovers(routePath: string, pathname: string): boolean {
  const route = normalizeRoutePath(routePath);
  if (route === "/") return true;
  if (pathname === route) return true;
  return pathname.startsWith(`${route}/`);
}

/**
 * Check whether a role may access a path.
 *
 * @param routePaths `Permission.routePath` values granted to the role.
 * @param roleName   Role name; ADMINISTRADOR bypasses the list.
 * @param pathname   Requested path.
 */
export function canAccessRoute(
  routePaths: readonly (string | null | undefined)[],
  roleName: string | null | undefined,
  pathname: string,
): boolean {
  if (roleName === ADMIN_ROLE_NAME) return true;

  const normalized = normalizeRoutePath(pathname);
  return routePaths.some(
    (routePath) =>
      Boolean(routePath) && routeCovers(routePath as string, normalized),
  );
}
