import { compare } from "bcrypt";
import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/database/prisma.singleton";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        // Find user with role information
        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email,
            active: true,
          },
          select: {
            id: true,
            email: true,
            name: true,
            password: true,
            clienteId: true,
            sessionVersion: true,
            // Every active role: a user can administer vacations, administer
            // operations, and still be an FSR. What travels in the JWT is the
            // UNION of their route grants.
            userRoles: {
              where: { active: true },
              select: {
                role: {
                  select: {
                    id: true,
                    name: true,
                    defaultPath: true,
                    isSuperuser: true,
                    priority: true,
                    active: true,
                    // Route permissions travel in the JWT so the Edge middleware can
                    // authorize without a DB round-trip — and without a hardcoded
                    // per-role route table.
                    rolePermission: {
                      select: {
                        permission: {
                          select: {
                            routePath: true,
                            exact: true,
                            active: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            userStatus: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

        if (!user) {
          throw new Error("Invalid email or password");
        }

        // Check if user is active
        if (user.userStatus.name !== "ACTIVO") {
          throw new Error("Account is not active");
        }

        // Verify password
        const isPasswordValid = await compare(
          credentials.password,
          user.password,
        );

        if (!isPasswordValid) {
          throw new Error("Invalid email or password");
        }

        const roles = user.userRoles
          .map((ur) => ur.role)
          .filter((role) => role.active);

        // A user stripped of every role cannot be authorized at all. Failing
        // the sign-in is safer than issuing a token with an empty grant list,
        // which would look like a valid session that silently denies each page.
        if (roles.length === 0) {
          throw new Error("Account has no roles assigned");
        }

        // Distinct, non-null route paths across ALL roles, split by match mode.
        const prefixes = new Set<string>();
        const exact = new Set<string>();
        for (const role of roles) {
          for (const rp of role.rolePermission) {
            const perm = rp.permission;
            if (!perm.active || !perm.routePath) continue;
            (perm.exact ? exact : prefixes).add(perm.routePath);
          }
        }

        // Highest priority decides where they land after login.
        const landing = [...roles].sort(
          (a, b) => b.priority - a.priority || a.id - b.id,
        )[0];

        // Return user object that will be encoded in JWT
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          roleNames: roles.map((role) => role.name),
          isSuperuser: roles.some((role) => role.isSuperuser),
          defaultPath: landing.defaultPath,
          routePaths: [...prefixes],
          exactRoutePaths: [...exact],
          sessionVersion: user.sessionVersion,
          clienteId: user.clienteId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // On first sign in, add user data to token
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.roleNames = user.roleNames ?? [];
        token.isSuperuser = user.isSuperuser ?? false;
        token.defaultPath = user.defaultPath;
        token.routePaths = user.routePaths ?? [];
        token.exactRoutePaths = user.exactRoutePaths ?? [];
        token.sessionVersion = user.sessionVersion;
        token.clienteId = user.clienteId ?? undefined;
      }
      return token;
    },
    async session({ session, token }) {
      // Add user data from token to session
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.roleNames = (token.roleNames as string[]) ?? [];
        session.user.isSuperuser = (token.isSuperuser as boolean) ?? false;
        session.user.defaultPath = token.defaultPath as string;
        // The navigation menu filters against these, so they have to reach the
        // client — not just the Edge middleware.
        session.user.routePaths = (token.routePaths as string[]) ?? [];
        session.user.exactRoutePaths =
          (token.exactRoutePaths as string[]) ?? [];
        session.user.sessionVersion = token.sessionVersion as number;
        session.user.clienteId = token.clienteId as string | undefined;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Allow callback URLs on same origin
      if (url.startsWith("/")) return `${baseUrl}${url}`;

      // Allow callback URLs on same origin
      if (new URL(url).origin === baseUrl) return url;

      return baseUrl;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  // On in development, but silenceable: the e2e run sets NEXTAUTH_DEBUG=false
  // so its server log stays readable.
  debug:
    process.env.NODE_ENV === "development" &&
    process.env.NEXTAUTH_DEBUG !== "false",
};
