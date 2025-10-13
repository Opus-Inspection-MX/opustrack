"use client"

import Link from "next/link"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { ThemeToggle } from "./theme-toggle"
import { LogoutButton } from "@/components/auth/logout-button"
import { User } from "lucide-react"

export function InvitadoSidebar() {
  return (
    <Sidebar>
      <SidebarHeader className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/guest" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <User className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold">Portal Invitado</span>
          </Link>
          <SidebarTrigger />
        </div>
      </SidebarHeader>

      <SidebarContent className="px-4 py-4">{/* Empty content - no navigation needed */}</SidebarContent>

      <SidebarFooter className="border-t p-4">
        <div className="flex flex-col gap-2">
          <ThemeToggle />
          <LogoutButton variant="outline" size="sm" className="w-full bg-transparent" />
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
