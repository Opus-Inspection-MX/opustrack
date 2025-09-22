// config/roles/access.ts
import { roleRedirect } from "./role_redirect";

// path prefix ("/admin", "/user", …) -> minRole (5, 2, …)
const PREFIX_MIN_ROLE: Array<{ prefix: string; minRole: number }> =
  Object.entries(roleRedirect)
    .map(([role, prefix]) => ({ prefix, minRole: Number(role) }))
    // sort by longer prefix first to match more specific paths if needed
    .sort((a, b) => b.prefix.length - a.prefix.length);

export function getRequiredRole(pathname: string): number | null {
  const hit = PREFIX_MIN_ROLE.find(({ prefix }) => pathname.startsWith(prefix));
  return hit?.minRole ?? null; // null = not under a protected prefix
}

export function canAccess(userRole: number, requiredRole: number) {
  return userRole >= requiredRole;
}
