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
import { User, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"

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
          <Button variant="outline" size="sm" asChild className="w-full bg-transparent">
            <Link href="/">
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar Sesión
            </Link>
          </Button>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
