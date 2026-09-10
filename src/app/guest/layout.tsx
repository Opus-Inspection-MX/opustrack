import type React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { requireRouteAccess } from "@/lib/auth/auth";

/**
 * Portal guard: every route under `/guest` requires the `/guest` grant.
 * Pages with finer rules keep their own guard; this is the coarse gate.
 */
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRouteAccess("/guest");
  return <AppShell>{children}</AppShell>;
}
