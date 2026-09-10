import type React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { requireRouteAccess } from "@/lib/auth/auth";

/**
 * Portal guard: every route under `/profile` requires the `/profile` grant.
 * Shared, portal-less route: EMPLEADO lands here and belongs to no portal, so
 * without this the page would render with no navigation at all.
 */
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRouteAccess("/profile");
  return <AppShell>{children}</AppShell>;
}
