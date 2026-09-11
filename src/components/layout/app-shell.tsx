"use client";

import type React from "react";
import { useState } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { PageTransition } from "@/components/motion/page-transition";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppHeader } from "./app-header";
import { CommandPalette } from "./command-palette";
import { TabBar } from "./tab-bar";

/**
 * The application shell.
 *
 * Four portal layouts used to repeat this markup with only the sidebar and
 * the header label differing. Now that navigation is derived from permissions
 * rather than from which portal you are in, the shell is one component and
 * the sections a user sees follow them across routes: a sticky global
 * header on every viewport, the collapsible sidebar (a drawer below `lg`),
 * the palette, and the mobile tab bar.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const openPalette = () => setPaletteOpen(true);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex h-screen flex-col overflow-hidden">
        <AppHeader onOpenPalette={openPalette} />
        {/* Bottom padding clears the mobile tab bar plus the safe area. */}
        <main className="flex-1 overflow-auto p-4 pb-[calc(4rem+env(safe-area-inset-bottom))] md:p-6 lg:p-8 lg:pb-8">
          <PageTransition>{children}</PageTransition>
        </main>
        <TabBar onOpenPalette={openPalette} />
      </SidebarInset>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </SidebarProvider>
  );
}
