/**
 * Route-access matching, shared by the Edge middleware and the server-side
 * authorization helpers.
 *
 * This module is intentionally dependency-free (no Prisma, no Node APIs) so the
 * middleware can import it on the Edge runtime. The route list it matches
 * against comes from the database — `Permission.routePath` for every role the
 * user holds, carried in the JWT — so there are no hardcoded per-role route
 * tables.
 *
 * There is no longer a role NAME that bypasses this. The bypass is a capability
 * (`Role.isSuperuser`, held only by ROOT), because the old `ADMINISTRADOR`
 * string also stood for "sees every Cliente" and "may override other people's
 * records", and those must be grantable WITHOUT handing out the keys to roles
 * and permissions.
 */

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

/**
 * The route grants a user carries.
 *
 * Two lists rather than one tagged list: both travel in the JWT, and keeping
 * them as plain string arrays means no encoding convention to parse on the
 * Edge. `exact` is normally one or two entries.
 */
export interface RouteGrants {
  /** Cover the path and everything under it. */
  prefixes: readonly (string | null | undefined)[];
  /** Cover ONLY this exact path. */
  exact?: readonly (string | null | undefined)[];
}

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
 * Matching is segment-aware: `/fsr` grants `/fsr` and `/fsr/assignments` but not
 * `/fsr-admin`. A plain `startsWith` would leak across the segment boundary.
 */
function routeCovers(routePath: string, pathname: string): boolean {
  const route = normalizeRoutePath(routePath);
  if (route === "/") return true;
  if (pathname === route) return true;
  return pathname.startsWith(`${route}/`);
}

/**
 * Check whether a user may access a path.
 *
 * @param grants     Route grants from `Permission.routePath`.
 * @param isSuperuser ROOT bypasses the list entirely.
 * @param pathname   Requested path.
 */
export function canAccessRoute(
  grants: RouteGrants,
  isSuperuser: boolean,
  pathname: string,
): boolean {
  if (isSuperuser) return true;

  const normalized = normalizeRoutePath(pathname);

  // Exact grants are what let a vacation admin open the `/admin` landing page
  // without inheriting `/admin/incidents` along with it.
  const exactHit = (grants.exact ?? []).some(
    (routePath) =>
      Boolean(routePath) &&
      normalizeRoutePath(routePath as string) === normalized,
  );
  if (exactHit) return true;

  return grants.prefixes.some(
    (routePath) =>
      Boolean(routePath) && routeCovers(routePath as string, normalized),
  );
}
