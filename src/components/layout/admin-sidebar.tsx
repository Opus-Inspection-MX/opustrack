"use client";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  Calendar,
  Car,
  ClipboardList,
  Clock,
  Cog,
  FileText,
  LayoutDashboard,
  List,
  Lock,
  MapPin,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  PieChart,
  Settings,
  Shield,
  Tag,
  Target,
  TrendingUp,
  User,
  UserCheck,
  Users,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "./theme-toggle";

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
      {
        title: "Seguimiento de Atención",
        url: "/admin/tracking",
        icon: ClipboardList,
      },
      { title: "Programación", url: "/admin/programacion", icon: Calendar },
      { title: "Horarios", url: "/admin/schedules", icon: Calendar },
      { title: "Incidentes", url: "/admin/incidents", icon: AlertTriangle },
      { title: "Tipos de Incidente", url: "/admin/incident-types", icon: Tag },
      {
        title: "Estado de Incidente",
        url: "/admin/incident-status",
        icon: FileText,
      },
    ],
  },
  {
    title: "Gestión de Trabajo",
    items: [
      { title: "Órdenes de Trabajo", url: "/admin/work-orders", icon: Wrench },
      {
        title: "Actividades de Trabajo",
        url: "/admin/work-activities",
        icon: Activity,
      },
      { title: "Partes de Trabajo", url: "/admin/work-parts", icon: Cog },
    ],
  },
  {
    title: "Reportes",
    items: [
      { title: "Dashboard", url: "/admin/reports", icon: BarChart3 },
      {
        title: "Rendimiento FSR",
        url: "/admin/reports/fsr-performance",
        icon: TrendingUp,
      },
      {
        title: "Órdenes de Trabajo",
        url: "/admin/reports/work-orders",
        icon: ClipboardList,
      },
      { title: "Incidentes", url: "/admin/reports/incidents", icon: PieChart },
      {
        title: "Viajes de Vehículos",
        url: "/admin/reports/vehicle-trips",
        icon: Car,
      },
      {
        title: "Uso de Partes",
        url: "/admin/reports/parts-usage",
        icon: Package,
      },
      {
        title: "Cumplimiento SLA",
        url: "/admin/reports/sla-compliance",
        icon: Target,
      },
      {
        title: "Antigüedad Órdenes",
        url: "/admin/reports/work-order-aging",
        icon: Clock,
      },
      {
        title: "Tiempo Desbloqueo",
        url: "/admin/reports/unlock-time",
        icon: Lock,
      },
    ],
  },
  {
    title: "Organización",
    items: [
      { title: "CVV", url: "/admin/vic-centers", icon: Building2 },
      { title: "Líneas", url: "/admin/lines", icon: List },
      { title: "Equipos", url: "/admin/equipments", icon: Wrench },
      { title: "Estados", url: "/admin/states", icon: MapPin },
      { title: "Inventario", url: "/admin/parts", icon: Package },
      { title: "Vehículos", url: "/admin/vehicles", icon: Car },
    ],
  },
  {
    title: "Gestión de Usuarios",
    items: [
      { title: "Usuarios", url: "/admin/users", icon: Users },
      { title: "Roles", url: "/admin/roles", icon: Shield },
      { title: "Permisos", url: "/admin/permissions", icon: Settings },
      {
        title: "Estado de Usuario",
        url: "/admin/user-status",
        icon: UserCheck,
      },
    ],
  },
  {
    title: "Configuración",
    items: [
      {
        title: "Estado de Línea",
        url: "/admin/settings/line-status",
        icon: List,
      },
      {
        title: "Estado de Equipo",
        url: "/admin/settings/equipment-status",
        icon: Wrench,
      },
      {
        title: "Estado de Vehículo",
        url: "/admin/settings/vehicle-status",
        icon: Car,
      },
      {
        title: "Estado de Viaje",
        url: "/admin/settings/vehicle-trip-status",
        icon: Activity,
      },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { toggleSidebar } = useSidebar();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b px-6 py-4 group-data-[collapsible=icon]:px-2">
        <div className="flex items-center justify-between group-data-[collapsible=icon]:justify-center">
          <Link
            href="/admin"
            className="flex items-center gap-2 group-data-[collapsible=icon]:hidden"
          >
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold">Panel de Admin</span>
          </Link>
          <button
            type="button"
            onClick={toggleSidebar}
            className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors cursor-pointer hidden group-data-[collapsible=icon]:flex"
            aria-label="Expand Sidebar"
          >
            <PanelLeftOpen className="h-5 w-5 text-primary-foreground" />
          </button>
          <button
            type="button"
            onClick={toggleSidebar}
            className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors cursor-pointer group-data-[collapsible=icon]:hidden"
            aria-label="Collapse Sidebar"
          >
            <PanelLeftClose className="h-5 w-5" />
          </button>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-4 py-4 group-data-[collapsible=icon]:px-2">
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
                        isActive={
                          pathname === item.url ||
                          pathname.startsWith(`${item.url}/`)
                        }
                        tooltip={item.title}
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

      <SidebarFooter className="border-t p-4 group-data-[collapsible=icon]:p-2">
        <div className="flex flex-col gap-2 group-data-[collapsible=icon]:items-center">
          <ThemeToggle />
          <div className="w-full group-data-[collapsible=icon]:w-auto">
            <LogoutButton
              variant="outline"
              size="sm"
              className="w-full bg-transparent group-data-[collapsible=icon]:hidden"
            />
            <LogoutButton
              variant="outline"
              size="icon"
              className="hidden group-data-[collapsible=icon]:flex"
              iconOnly
            />
          </div>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
