import type React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { requireRouteAccess } from "@/lib/auth/auth";

/**
 * The universal inbox lives inside the shell like every other page: header,
 * sidebar, tab bar, and palette included. It used to render bare, with no
 * way back into the navigation.
 */
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRouteAccess("/notifications");
  return <AppShell>{children}</AppShell>;
}
