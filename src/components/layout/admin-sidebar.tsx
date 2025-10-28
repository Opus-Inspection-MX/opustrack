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
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { ThemeToggle } from "./theme-toggle"
import { LogoutButton } from "@/components/auth/logout-button"
import {
  LayoutDashboard,
  Users,
  AlertTriangle,
  Wrench,
  Building2,
  Package,
  Calendar,
  Shield,
  Settings,
  User,
  MapPin,
  UserCheck,
  Tag,
  Activity,
  FileText,
  Cog,
} from "lucide-react"

const menuSections = [
  {
    title: "Resumen",
    items: [
      { title: "Panel", url: "/admin", icon: LayoutDashboard },
      { title: "Mi Perfil", url: "/admin/profile", icon: User },
    ],
  },
  {
    title: "Gestión de Incidentes",
    items: [
      { title: "Horarios", url: "/admin/schedules", icon: Calendar },
      { title: "Incidentes", url: "/admin/incidents", icon: AlertTriangle },
      { title: "Tipos de Incidente", url: "/admin/incident-types", icon: Tag },
      { title: "Estado de Incidente", url: "/admin/incident-status", icon: FileText },
    ],
  },
  {
    title: "Gestión de Trabajo",
    items: [
      { title: "Órdenes de Trabajo", url: "/admin/work-orders", icon: Wrench },
      { title: "Actividades de Trabajo", url: "/admin/work-activities", icon: Activity },
      { title: "Partes de Trabajo", url: "/admin/work-parts", icon: Cog },
    ],
  },
  {
    title: "Organización",
    items: [
      { title: "Centros CVV", url: "/admin/vic-centers", icon: Building2 },
      { title: "Estados", url: "/admin/states", icon: MapPin },
      { title: "Inventario", url: "/admin/parts", icon: Package },
    ],
  },
  {
    title: "Gestión de Usuarios",
    items: [
      { title: "Usuarios", url: "/admin/users", icon: Users },
      { title: "Roles", url: "/admin/roles", icon: Shield },
      { title: "Permisos", url: "/admin/permissions", icon: Settings },
      { title: "Estado de Usuario", url: "/admin/user-status", icon: UserCheck },
    ],
  },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold">Panel de Admin</span>
          </Link>
          <SidebarTrigger />
        </div>
      </SidebarHeader>

      <SidebarContent className="px-4 py-4">
        {menuSections.map((section, index) => (
          <div key={section.title}>
            <SidebarGroup>
              <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === item.url || pathname.startsWith(item.url + "/")}
                      >
                        <Link href={item.url}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            {index < menuSections.length - 1 && <SidebarSeparator />}
          </div>
        ))}
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
