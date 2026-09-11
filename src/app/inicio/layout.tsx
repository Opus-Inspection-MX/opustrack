import type React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { requireRouteAccess } from "@/lib/auth/auth";

/**
 * Portal guard: every route under `/inicio` requires the `route:inicio`
 * grant, which all seven seed roles hold (Fase 3 migration).
 */
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRouteAccess("/inicio");
  return <AppShell>{children}</AppShell>;
}
