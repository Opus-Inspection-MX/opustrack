import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Public routes that don't require authentication
  const isPublic =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/logout" ||
    pathname === "/unauthorized" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/api/auth");

  if (isPublic) {
    return NextResponse.next();
  }

  // Get authentication token
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // Not authenticated - redirect to login
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", pathname + (search || ""));
    return NextResponse.redirect(url);
  }

  // User is authenticated - check route access
  const roleName = token.roleName as string | undefined;
  const defaultPath = token.defaultPath as string | undefined;

  if (!roleName || !defaultPath) {
    console.error("[Middleware] Missing role data in token:", { roleName, defaultPath });
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Handle root path - redirect to user's default path
  if (pathname === "/" || pathname === "/dashboard") {
    console.log(`[Middleware] Redirecting to defaultPath: ${defaultPath} for role: ${roleName}`);
    return NextResponse.redirect(new URL(defaultPath, req.url));
  }

  // Admin has access to all routes
  if (roleName === "ADMINISTRADOR") {
    console.log(`[Middleware] Admin accessing: ${pathname}`);
    return NextResponse.next();
  }

  // Check if user has permission to access this route based on role
  const canAccess = checkRouteAccess(roleName, pathname);

  if (!canAccess) {
    console.warn(`[Middleware] Access denied for role ${roleName} to ${pathname}`);
    return NextResponse.redirect(new URL("/unauthorized", req.url));
  }

  console.log(`[Middleware] Access granted for role ${roleName} to ${pathname}`);
  return NextResponse.next();
}

/**
 * Check if a role can access a specific route
 * This is a simplified version that works without database calls
 */
function checkRouteAccess(roleName: string, pathname: string): boolean {
  // Define route access rules per role
  const roleRoutes: Record<string, string[]> = {
    ADMINISTRADOR: ["/*"], // Admin can access everything
    FSR: [
      "/fsr",
      "/incidents",
      "/work-orders",
      "/parts",
      "/schedules",
      "/reports",
      "/profile",
    ],
    CLIENT: [
      "/client",
      "/incidents",
      "/work-orders",
      "/schedules",
      "/profile",
    ],
    GUEST: [
      "/guest",
      "/incidents",
      "/work-orders",
      "/parts",
      "/schedules",
      "/profile",
    ],
  };

  const allowedRoutes = roleRoutes[roleName] || [];

  // Check if pathname starts with any allowed route
  return allowedRoutes.some((route) => {
    if (route === "/*") return true; // Wildcard for admin
    return pathname.startsWith(route);
  });
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|api/auth).*)"],
};
