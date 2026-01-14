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
    sessionVersion?: number;
    vicId?: string | null;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      roleId: number;
      roleName?: string;
      defaultPath?: string;
      sessionVersion?: number;
      vicId?: string;
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
    sessionVersion?: number;
    vicId?: string;
  }
}
