"use client";

import { Building2 } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import type React from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { NotificationBell } from "@/components/notifications";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

/**
 * The application shell.
 *
 * Four layouts (`/admin`, `/fsr`, `/client`, `/guest`) repeated this markup
 * with only the sidebar and the header label differing. Now that navigation is
 * derived from permissions rather than from which portal you are in, the shell
 * is one component and the sections a user sees follow them across routes.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const home = session?.user?.defaultPath ?? "/";

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex flex-col h-screen overflow-hidden">
        <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-4 lg:hidden shrink-0">
          <SidebarTrigger />
          <Link href={home} className="flex items-center gap-2 flex-1">
            <Building2 className="h-5 w-5" />
            <span className="font-semibold">OpusTrack</span>
          </Link>
          <NotificationBell />
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
