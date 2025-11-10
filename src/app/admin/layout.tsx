"use client"

import type React from "react"

import { AdminSidebar } from "@/components/layout/admin-sidebar"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { Building2 } from "lucide-react"
import Link from "next/link"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset className="flex flex-col h-screen overflow-hidden">
        <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-4 lg:hidden shrink-0">
          <SidebarTrigger />
          <Link href="/admin" className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            <span className="font-semibold">Admin Panel</span>
          </Link>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
