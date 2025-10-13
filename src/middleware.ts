import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getRoleById, roleCanAccessRoute } from "@/lib/authz/authz";

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Public routes that don't require authentication
  const isPublic =
    pathname === "/login" ||
    pathname === "/signup" ||
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
  try {
    const roleId = token.roleId as number | undefined;

    if (!roleId) {
      // No role assigned - redirect to unauthorized
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }

    // Get user's role with permissions from database
    const role = await getRoleById(roleId);

    if (!role) {
      // Invalid role - redirect to unauthorized
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }

    // Handle root path - redirect to user's default path
    if (pathname === "/" || pathname === "/dashboard") {
      return NextResponse.redirect(new URL(role.defaultPath, req.url));
    }

    // Admin has access to all routes
    if (role.name === "ADMINISTRADOR") {
      return NextResponse.next();
    }

    // Check if user has permission to access this route
    const canAccess = roleCanAccessRoute(role, pathname);

    if (!canAccess) {
      // No permission - redirect to unauthorized
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }

    return NextResponse.next();
  } catch (error) {
    console.error("Middleware error:", error);
    // On error, redirect to login for safety
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|api/auth).*)"],
};
