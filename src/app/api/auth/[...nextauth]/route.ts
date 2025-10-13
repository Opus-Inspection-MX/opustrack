import { compare } from "bcrypt";
import NextAuth, { type NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/database/prisma.singleton"; // ← usa solo este prisma
import { ROLES } from "@/lib/authz/authz";

const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" }, // v5 + Credentials requiere JWT
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: { email: {}, password: {} },
      async authorize(creds) {
        if (!creds?.email || !creds?.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: String(creds.email) },
          include: { role: true },
        });
        if (!user) return null;
        console.log(user);
        const ok = await compare(String(creds.password), user.password);
        if (!ok) return null;

        // Lo que retornes aquí se inyecta al JWT (callback jwt)
        return user;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // En el primer login llega 'user' desde authorize()
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.roleId = user.roleId;
        token.defaultPath = user.role?.defaultPath;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.roleId = token.roleId as number;
        session.user.defaultPath = token.defaultPath as string | null;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Asegura que las rutas relativas vayan dentro del mismo dominio
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      try {
        const u = new URL(url);
        if (u.origin === baseUrl) return url;
      } catch {}
      return baseUrl;
    },
  },
};

// Evita "used before its declaration":
const authHandler = NextAuth(authOptions);
export const GET = authHandler;
export const POST = authHandler;
