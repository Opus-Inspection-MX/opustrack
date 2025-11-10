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
import { User } from "lucide-react"

const menuItems = [
  {
    title: "Mi Perfil",
    url: "/guest/profile",
    icon: User,
  },
]

export function InvitadoSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b px-6 py-4 group-data-[collapsible=icon]:px-2">
        <div className="flex items-center justify-between">
          <Link href="/guest" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <User className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold group-data-[collapsible=icon]:hidden">Portal Invitado</span>
          </Link>
          <SidebarTrigger className="group-data-[collapsible=icon]:hidden" />
        </div>
      </SidebarHeader>

      <SidebarContent className="px-4 py-4">
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton asChild isActive={pathname === item.url} tooltip={item.title}>
                <Link href={item.url}>
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="border-t p-4 group-data-[collapsible=icon]:p-2">
        <div className="flex flex-col gap-2 group-data-[collapsible=icon]:items-center">
          <ThemeToggle />
          <LogoutButton variant="outline" size="sm" className="w-full bg-transparent group-data-[collapsible=icon]:w-auto group-data-[collapsible=icon]:px-2" />
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
