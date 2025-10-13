import { compare } from "bcrypt";
import NextAuth, { type NextAuthOptions } from "next-auth";
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
          include: {
            role: {
              select: {
                id: true,
                name: true,
                defaultPath: true,
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
        const isPasswordValid = await compare(credentials.password, user.password);

        if (!isPasswordValid) {
          throw new Error("Invalid email or password");
        }

        // Return user object that will be encoded in JWT
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          roleId: user.roleId,
          role: user.role,
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
        token.roleId = user.roleId;
        token.roleName = user.role?.name;
        token.defaultPath = user.role?.defaultPath;
      }
      return token;
    },
    async session({ session, token }) {
      // Add user data from token to session
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.roleId = token.roleId as number;
        session.user.roleName = token.roleName as string;
        session.user.defaultPath = token.defaultPath as string;
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
  debug: process.env.NODE_ENV === "development",
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
