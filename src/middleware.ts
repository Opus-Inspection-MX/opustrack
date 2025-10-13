import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isAuthPage = pathname === "/login";
  const isPublic =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/api/auth");

  if (isPublic) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // 1) Usuario no autenticado → manda a login
  if (!token && !isAuthPage) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", pathname + (search || ""));
    return NextResponse.redirect(url);
  }

  // 2) Usuario autenticado entrando a /login → mándalo a callback o a su defaultPath
  if (token && isAuthPage) {
    const url = req.nextUrl.clone();
    const cb = url.searchParams.get("callbackUrl");
    if (cb) return NextResponse.redirect(new URL(cb, url.origin));

    const home = (token as any).defaultPath ?? "/dashboard";
    return NextResponse.redirect(new URL(home, url.origin));
  }

  // 3) Usuario autenticado en ruta protegida
  if (token && !isAuthPage) {
    const home = (token as any).defaultPath ?? "/dashboard";

    // Si ya está en su home, deja pasar
    if (pathname === home) return NextResponse.next();

    // Si está en hubs generales, redirígelo a su home
    if (pathname === "/" || pathname === "/dashboard") {
      return NextResponse.redirect(new URL(home, req.url));
    }

    // Si está en otra ruta protegida válida, deja pasar
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|api/auth).*)"],
};
