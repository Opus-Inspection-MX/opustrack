"use client";

import { Wrench } from "lucide-react";
import Link from "next/link";
import type React from "react";
import { FSRSidebar } from "@/components/layout/fsr-sidebar";
import { NotificationBell } from "@/components/notifications";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export default function FSRLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <FSRSidebar />
      <SidebarInset className="flex flex-col h-screen overflow-hidden">
        <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-4 lg:hidden shrink-0">
          <SidebarTrigger />
          <Link href="/fsr" className="flex items-center gap-2 flex-1">
            <Wrench className="h-5 w-5" />
            <span className="font-semibold">FSR Portal</span>
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
