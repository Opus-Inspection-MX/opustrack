import "next-auth";
import "next-auth/jwt";

/**
 * Session/JWT shape.
 *
 * There is no singular `roleId`/`roleName`: a user holds many roles and what
 * authorization needs is the UNION of their grants. `routePaths` carries that
 * union so the Edge middleware can authorize without a database round-trip,
 * and the navigation menu can hide what the user cannot open.
 */
declare module "next-auth" {
  interface User {
    id: string;
    email: string;
    name: string;
    roleNames?: string[];
    /** Holds a role marked `isSuperuser` (ROOT); bypasses every check. */
    isSuperuser?: boolean;
    /** Landing page of the highest-priority role. */
    defaultPath?: string;
    /** Route paths granted by prefix (from `Permission.routePath`). */
    routePaths?: string[];
    /** Route paths granted by equality only (`Permission.exact`). */
    exactRoutePaths?: string[];
    sessionVersion?: number;
    clienteId?: string | null;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      roleNames?: string[];
      isSuperuser?: boolean;
      defaultPath?: string;
      routePaths?: string[];
      exactRoutePaths?: string[];
      sessionVersion?: number;
      clienteId?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email: string;
    name: string;
    roleNames?: string[];
    isSuperuser?: boolean;
    defaultPath?: string;
    routePaths?: string[];
    exactRoutePaths?: string[];
    sessionVersion?: number;
    clienteId?: string;
  }
}
