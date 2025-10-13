import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  // Lo que va en session.user
  interface Session {
    user: {
      id: string;
      roleId: number | null;
      defaultPath: string | null;
    } & DefaultSession["user"];
  }

  // Lo que retorna authorize() o exista en la DB (PrismaAdapter)
  interface User {
    id: string;
    email: string;
    name?: string | null;
    roleId: number | null;
    role: { defaultPath: string } | null;
    // Aquí puedes agregar más campos si los tienes en tu modelo de usuario
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    roleId?: number | null;
    defaultPath?: string | null;
  }
}
