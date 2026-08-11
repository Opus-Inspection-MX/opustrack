import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { canAccessRoute, isPublicRoute } from "@/lib/authz/route-access";

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // API routes handle their own auth via requireAuth/requirePermission
  const isApiRoute = pathname.startsWith("/api/");

  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Get authentication token
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // Not authenticated - redirect to login (or return 401 for API routes)
  if (!token) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return redirectToLogin(req, pathname, search);
  }

  // API routes handle their own fine-grained authorization
  if (isApiRoute) {
    return NextResponse.next();
  }

  // User is authenticated - check route access
  const roleName = token.roleName as string | undefined;
  const defaultPath = token.defaultPath as string | undefined;
  const routePaths = token.routePaths as string[] | undefined;

  if (!roleName || !defaultPath) {
    console.error("[Middleware] Missing role data in token:", {
      roleName,
      defaultPath,
    });
    return redirectToLogin(req, pathname, search);
  }

  // Route permissions are database-driven and travel in the JWT. A token issued
  // before that field existed cannot be authorized safely, so force a re-login
  // rather than falling back to a permissive default.
  if (!Array.isArray(routePaths)) {
    console.warn(
      "[Middleware] Token predates routePaths — forcing re-authentication",
    );
    return redirectToLogin(req, pathname, search);
  }

  // Handle root path - redirect to user's default path
  if (pathname === "/" || pathname === "/dashboard") {
    return NextResponse.redirect(new URL(defaultPath, req.url));
  }

  if (!canAccessRoute(routePaths, roleName, pathname)) {
    console.warn(
      `[Middleware] Access denied for role ${roleName} to ${pathname}`,
    );
    return NextResponse.redirect(new URL("/unauthorized", req.url));
  }

  return NextResponse.next();
}

function redirectToLogin(req: NextRequest, pathname: string, search: string) {
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("callbackUrl", pathname + (search || ""));
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|api/auth).*)"],
};
