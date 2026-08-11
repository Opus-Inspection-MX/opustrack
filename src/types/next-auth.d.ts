import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    id: string;
    email: string;
    name: string;
    roleId: number;
    role?: {
      id: number;
      name: string;
      defaultPath: string;
    };
    routePaths?: string[];
    sessionVersion?: number;
    clienteId?: string | null;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      roleId: number;
      roleName?: string;
      defaultPath?: string;
      /** Route paths granted to the user's role (from Permission.routePath). */
      routePaths?: string[];
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
    roleId: number;
    roleName?: string;
    defaultPath?: string;
    /** Route paths granted to the user's role (from Permission.routePath). */
    routePaths?: string[];
    sessionVersion?: number;
    clienteId?: string;
  }
}
