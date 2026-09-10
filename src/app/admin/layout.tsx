import type React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { requireRouteAccess } from "@/lib/auth/auth";

/**
 * Portal guard: every route under `/admin` requires the `/admin` grant.
 *
 * Pages with finer rules keep their own `requireRouteAccess("/admin/...")`
 * call; this layout is the coarse gate that keeps unrotauthorized portals out
 * even if a page forgets its guard. See `src/middleware.ts`, which enforces
 * the same rule at the edge.
 */
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRouteAccess("/admin");
  return <AppShell>{children}</AppShell>;
}
