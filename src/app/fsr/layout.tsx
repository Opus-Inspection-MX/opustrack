"use client";

import type React from "react";
import { AppShell } from "@/components/layout/app-shell";

/**
 * The navigation is shared and permission-driven, so this portal no longer
 * carries its own sidebar. See `src/lib/navigation/menu.ts`.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
