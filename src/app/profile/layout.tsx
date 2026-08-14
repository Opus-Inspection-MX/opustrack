"use client";

import type React from "react";
import { AppShell } from "@/components/layout/app-shell";

/**
 * Shared, portal-less route: EMPLEADO lands here and belongs to no portal, so
 * without this the page would render with no navigation at all.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
