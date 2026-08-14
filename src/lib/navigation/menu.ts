import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  Calendar,
  Car,
  CheckCircle2,
  ClipboardList,
  Clock,
  Cog,
  Eye,
  FileText,
  LayoutDashboard,
  List,
  type LucideIcon,
  MapPin,
  Package,
  Palmtree,
  PieChart,
  Settings,
  Shield,
  Tag,
  TrendingUp,
  User,
  UserCheck,
  Users,
  Workflow,
  Wrench,
} from "lucide-react";
import { canAccessRoute, type RouteGrants } from "@/lib/authz/route-access";

/**
 * The one navigation registry.
 *
 * There used to be four static sidebars — admin, fsr, client, guest — each
 * hardcoding what its portal contained and none of them checking permissions.
 * That cannot express "administers vacations AND works as an FSR", which is now
 * an ordinary combination, so the menu is derived from what the user can
 * actually open instead of from which portal they happen to be in.
 *
 * Filtering is by ROUTE, not by permission name: route grants already travel in
 * the JWT for the Edge middleware, so no extra round-trip and no fatter cookie —
 * and the rule stays honest, because a link is shown exactly when the page
 * behind it would open.
 */

export interface MenuItem {
  title: string;
  /** Also the permission check: the item shows when this path is reachable. */
  url: string;
  icon: LucideIcon;
}

export interface MenuSection {
  title: string;
  items: MenuItem[];
}

export const MENU: MenuSection[] = [
  {
    title: "Resumen",
    items: [
      { title: "Panel", url: "/admin", icon: LayoutDashboard },
      { title: "Mi Perfil", url: "/profile", icon: User },
    ],
  },
  {
    title: "Mi Trabajo",
    items: [
      { title: "Inicio", url: "/fsr", icon: LayoutDashboard },
      { title: "Mis Incidentes", url: "/fsr/incidents", icon: AlertTriangle },
      { title: "Mis Asignaciones", url: "/fsr/assignments", icon: Wrench },
      { title: "Viajes", url: "/fsr/vehicle-trips", icon: Car },
    ],
  },
  {
    title: "Mis Vacaciones",
    items: [
      // Self-service, for every staff role. A CLIENT is a shared center
      // account, not a person with days to book.
      { title: "Mis Vacaciones", url: "/vacations", icon: Palmtree },
    ],
  },
  {
    title: "Mi Centro",
    items: [
      { title: "Inicio", url: "/client", icon: LayoutDashboard },
      { title: "Reportar Incidente", url: "/client/new", icon: AlertTriangle },
    ],
  },
  {
    title: "Consulta",
    items: [{ title: "Inicio", url: "/guest", icon: LayoutDashboard }],
  },
  {
    title: "Gestión de Incidentes",
    items: [
      {
        title: "Seguimiento de Atención",
        url: "/admin/tracking",
        icon: ClipboardList,
      },
      {
        title: "Asignación de Programación",
        url: "/admin/programacion",
        icon: Calendar,
      },
      { title: "Programación", url: "/admin/schedules", icon: Calendar },
      { title: "Incidentes", url: "/admin/incidents", icon: AlertTriangle },
      { title: "Asignaciones", url: "/admin/assignments", icon: Wrench },
    ],
  },
  {
    title: "Gestión de Trabajo",
    items: [
      {
        title: "Actividades de Trabajo",
        url: "/admin/assignment-activities",
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
        title: "Asignaciones",
        url: "/admin/reports/assignments",
        icon: ClipboardList,
      },
      { title: "Incidentes", url: "/admin/reports/incidents", icon: PieChart },
      {
        title: "Reporte de Incidentes",
        url: "/admin/reports/incident-program",
        icon: FileText,
      },
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
        title: "Antigüedad Asignaciones",
        url: "/admin/reports/assignment-aging",
        icon: Clock,
      },
      {
        title: "Tiempo Visualización",
        url: "/admin/reports/seen-time",
        icon: Eye,
      },
      {
        title: "Cumplimiento Viajes",
        url: "/admin/reports/daily-trip-compliance",
        icon: CheckCircle2,
      },
      {
        title: "Engagement Notificaciones",
        url: "/admin/reports/notification-engagement",
        icon: Bell,
      },
    ],
  },
  {
    title: "Organización",
    items: [
      { title: "Cliente", url: "/admin/clientes", icon: Building2 },
      { title: "Líneas", url: "/admin/lines", icon: List },
      { title: "Equipos", url: "/admin/equipments", icon: Wrench },
      { title: "Estados", url: "/admin/states", icon: MapPin },
      { title: "Inventario", url: "/admin/parts", icon: Package },
      { title: "Vehículos", url: "/admin/vehicles", icon: Car },
    ],
  },
  {
    title: "Administrar Vacaciones",
    items: [
      { title: "Solicitudes", url: "/admin/vacations", icon: Palmtree },
      { title: "Días Festivos", url: "/admin/holidays", icon: Calendar },
      {
        title: "Reglas de acumulación",
        url: "/admin/settings/vacation-accrual",
        icon: Settings,
      },
    ],
  },
  {
    title: "Gestión de Usuarios",
    items: [
      { title: "Usuarios", url: "/admin/users", icon: Users },
      { title: "Roles", url: "/admin/roles", icon: Shield },
      { title: "Permisos", url: "/admin/permissions", icon: Settings },
      // Reachable only by typing the URL until now: no sidebar ever listed it.
      {
        title: "Enviar Notificación",
        url: "/admin/notifications/broadcast",
        icon: Bell,
      },
    ],
  },
  {
    title: "Configuración",
    items: [
      { title: "Ciclo de Vida", url: "/admin/lifecycle", icon: Workflow },
      { title: "Tipos de Incidente", url: "/admin/incident-types", icon: Tag },
      {
        title: "Estado de Incidente",
        url: "/admin/incident-status",
        icon: FileText,
      },
      {
        title: "Estado de Asignación",
        url: "/admin/settings/assignment-status",
        icon: Wrench,
      },
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
      {
        title: "Estado de Usuario",
        url: "/admin/user-status",
        icon: UserCheck,
      },
    ],
  },
];

/**
 * The menu this user can actually use.
 *
 * Sections whose every item was filtered out disappear entirely — an empty
 * "Organización" heading reads as a broken page, not as a hidden one.
 */
export function visibleMenu(
  grants: RouteGrants,
  isSuperuser: boolean,
): MenuSection[] {
  return MENU.map((section) => ({
    ...section,
    items: section.items.filter((item) =>
      canAccessRoute(grants, isSuperuser, item.url),
    ),
  })).filter((section) => section.items.length > 0);
}
