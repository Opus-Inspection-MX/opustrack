"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { ThemeToggle } from "./theme-toggle"
import { LogoutButton } from "@/components/auth/logout-button"
import { Plus, List, AlertTriangle, User } from "lucide-react"

const menuItems = [
  {
    title: "Mis Incidentes",
    url: "/client",
    icon: List,
  },
  {
    title: "Reportar Incidente",
    url: "/client/new",
    icon: Plus,
  },
  {
    title: "Mi Perfil",
    url: "/profile",
    icon: User,
  },
]

export function ClientSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/client" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold">Portal Cliente</span>
          </Link>
          <SidebarTrigger />
        </div>
      </SidebarHeader>

      <SidebarContent className="px-4 py-4">
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton asChild isActive={pathname === item.url}>
                <Link href={item.url}>
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>

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
