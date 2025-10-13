import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  // Lo que va en session.user
  interface Session {
    user: {
      id: string;
      roleId: number | null;
      roleName: string | null;
      defaultPath: string | null;
    } & DefaultSession["user"];
  }

  // Lo que retorna authorize() o exista en la DB (PrismaAdapter)
  interface User {
    id: string;
    email: string;
    name?: string | null;
    roleId: number | null;
    role: { name: string; defaultPath: string } | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    roleId?: number | null;
    roleName?: string | null;
    defaultPath?: string | null;
  }
}
