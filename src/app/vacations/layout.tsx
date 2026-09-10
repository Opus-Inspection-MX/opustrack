import type React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { requireRouteAccess } from "@/lib/auth/auth";

/**
 * Portal guard: every route under `/vacations` requires the `/vacations`
 * grant. Shared, portal-less route: EMPLEADO lands here and belongs to no
 * portal, so without this the page would render with no navigation at all.
 */
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRouteAccess("/vacations");
  return <AppShell>{children}</AppShell>;
}
