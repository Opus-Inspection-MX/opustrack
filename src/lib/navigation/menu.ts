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
  Eye,
  FileText,
  Home,
  Key,
  LayoutDashboard,
  List,
  type LucideIcon,
  MapPin,
  Palmtree,
  PieChart,
  Settings,
  Shield,
  ShieldAlert,
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
 *
 * The registry holds five collapsible groups. Grouping is presentation, not
 * authorization: `visibleMenu` still filters item by item.
 */

export interface MenuItem {
  title: string;
  /** Also the permission check: the item shows when this path is reachable. */
  url: string;
  icon: LucideIcon;
  /** Extra search terms for the command palette (synonyms, abbreviations). */
  keywords?: readonly string[];
  /**
   * Order hint for the mobile tab bar. The lowest value among the visible
   * items becomes the third tab (after Inicio and Búsqueda). Items without a
   * value never appear in the tab bar.
   */
  mobilePriority?: number;
  /** One-line summary shown in the command palette. */
  description?: string;
  /**
   * False for pages reachable through the palette, tabs, or breadcrumbs but
   * not listed in the sidebar. The nine individual reports live under the
   * "Reportes" tab instead of bloating the sidebar.
   */
  showInSidebar?: boolean;
}

export interface MenuSection {
  title: string;
  items: MenuItem[];
}

export interface MenuGroup {
  title: string;
  sections: MenuSection[];
}

export const MENU: MenuGroup[] = [
  {
    title: "Inicio",
    sections: [
      {
        title: "Principal",
        items: [
          {
            title: "Inicio",
            url: "/inicio",
            icon: Home,
            keywords: ["home", "panel", "principal"],
            description: "Tu pantalla inicial con accesos y resumen",
          },
          {
            title: "Notificaciones",
            url: "/notifications",
            icon: Bell,
            keywords: ["notificacion", "avisos", "alertas", "inbox"],
            description: "Tus avisos y notificaciones recientes",
          },
          {
            title: "Perfil",
            url: "/profile",
            icon: User,
            keywords: ["perfil", "cuenta", "mis datos"],
            description: "Tus datos y preferencias de cuenta",
          },
        ],
      },
    ],
  },
  {
    title: "Mi trabajo",
    sections: [
      {
        title: "FSR",
        items: [
          {
            title: "Panel FSR",
            url: "/fsr",
            icon: LayoutDashboard,
            keywords: ["fsr", "tecnico", "panel"],
            description: "Panel del técnico en campo",
          },
          {
            title: "Mis Incidentes",
            url: "/fsr/incidents",
            icon: AlertTriangle,
            keywords: ["incidente", "falla", "reporte"],
            description: "Incidentes asignados a tu zona",
          },
          {
            title: "Mis Asignaciones",
            url: "/fsr/assignments",
            icon: Wrench,
            keywords: ["asignacion", "odt", "orden", "trabajo"],
            mobilePriority: 1,
            description: "Tus órdenes de trabajo",
          },
          {
            title: "Viajes",
            url: "/fsr/vehicle-trips",
            icon: Car,
            keywords: ["viaje", "vehiculo", "odometro", "kilometraje"],
            description: "Tus recorridos con odómetro y foto",
          },
        ],
      },
      {
        title: "Vacaciones",
        items: [
          // Self-service, for every staff role. A REPORTER is a shared center
          // account, not a person with days to book.
          {
            title: "Mis Vacaciones",
            url: "/vacations",
            icon: Palmtree,
            keywords: ["vacacion", "descanso", "dias", "permiso"],
            mobilePriority: 2,
            description: "Tus días, solicitudes y saldo",
          },
        ],
      },
      {
        title: "Centro",
        items: [
          {
            title: "Mis Reportes",
            url: "/reporter",
            icon: LayoutDashboard,
            keywords: ["centro", "cliente", "panel"],
            description: "Panel de tu centro de inspección",
          },
          {
            title: "Reportar Incidente",
            url: "/reporter/new",
            icon: AlertTriangle,
            keywords: ["reportar", "nuevo", "falla", "incidente"],
            mobilePriority: 1,
            description: "Levanta un reporte de falla en tu centro",
          },
        ],
      },
      {
        title: "Consulta",
        items: [
          {
            title: "Panel de Invitado",
            url: "/guest",
            icon: LayoutDashboard,
            keywords: ["invitado", "consulta", "panel"],
            description: "Consulta de solo lectura",
          },
        ],
      },
    ],
  },
  {
    title: "Operación",
    sections: [
      {
        title: "Incidentes",
        items: [
          {
            title: "Seguimiento de Atención",
            url: "/admin/tracking",
            icon: ClipboardList,
            keywords: ["seguimiento", "tracking", "atencion", "cola"],
            mobilePriority: 1,
            description: "Cola de atención de incidentes abiertos",
          },
          {
            title: "Asignación de Programación",
            url: "/admin/programacion",
            icon: Calendar,
            keywords: ["programacion", "asignacion", "calendario"],
            description: "Asigna personal a las programaciones",
          },
          {
            title: "Programación",
            url: "/admin/schedules",
            icon: Calendar,
            keywords: ["programacion", "agenda", "visitas", "calendario"],
            description: "Calendario de visitas a centros",
          },
          {
            title: "Incidentes",
            url: "/admin/incidents",
            icon: AlertTriangle,
            keywords: ["incidente", "falla", "ticket"],
            description: "Todos los incidentes reportados",
          },
          {
            title: "Asignaciones",
            url: "/admin/assignments",
            icon: Wrench,
            keywords: ["asignacion", "odt", "orden", "trabajo"],
            description: "Órdenes de trabajo del personal de campo",
          },
        ],
      },
      {
        title: "Trabajo",
        items: [
          {
            title: "Actividades de Trabajo",
            url: "/admin/assignment-activities",
            icon: Activity,
            keywords: ["actividad", "bitacora", "tarea"],
            description: "Catálogo de actividades ejecutables",
          },
        ],
      },
    ],
  },
  {
    title: "Reportes",
    sections: [
      {
        title: "Reportes",
        items: [
          {
            title: "Reportes",
            url: "/admin/reports",
            icon: BarChart3,
            keywords: ["reporte", "dashboard", "metricas", "graficas"],
            description: "Métricas y reportes de la operación",
          },
          {
            title: "Rendimiento FSR",
            url: "/admin/reports/fsr-performance",
            icon: TrendingUp,
            showInSidebar: false,
            keywords: ["rendimiento", "fsr", "desempeno", "tecnico"],
            description: "Asignaciones, tiempos y kilometraje por técnico",
          },
          {
            title: "Reporte de Asignaciones",
            url: "/admin/reports/assignments",
            icon: ClipboardList,
            showInSidebar: false,
            keywords: ["asignacion", "estado", "distribucion"],
            description: "Asignaciones por estado y completitud",
          },
          {
            title: "Análisis de Incidentes",
            url: "/admin/reports/incidents",
            icon: PieChart,
            showInSidebar: false,
            keywords: ["incidente", "tendencia", "tipo", "resolucion"],
            description: "Tendencias y distribución por tipo",
          },
          {
            title: "Reporte de Incidentes",
            url: "/admin/reports/incident-program",
            icon: FileText,
            showInSidebar: false,
            keywords: ["programa", "programacion", "excel", "exportar"],
            description: "Incidentes por programación, exportable a Excel",
          },
          {
            title: "Incumplimiento SLA",
            url: "/admin/reports/sla-breach",
            icon: ShieldAlert,
            showInSidebar: false,
            keywords: ["sla", "vencido", "riesgo", "incumplimiento"],
            description: "Incidentes vencidos y en riesgo por tipo",
          },
          {
            title: "Viajes de Vehículos",
            url: "/admin/reports/vehicle-trips",
            icon: Car,
            showInSidebar: false,
            keywords: ["viaje", "vehiculo", "kilometraje", "flota"],
            description: "Kilometraje y uso de la flota",
          },
          {
            title: "Antigüedad de Asignaciones",
            url: "/admin/reports/assignment-aging",
            icon: Clock,
            showInSidebar: false,
            keywords: ["antiguedad", "vencido", "sla", "atraso"],
            description: "Asignaciones abiertas por antigüedad",
          },
          {
            title: "Tiempo de Visualización",
            url: "/admin/reports/seen-time",
            icon: Eye,
            showInSidebar: false,
            keywords: ["visualizacion", "visto", "lectura", "notificacion"],
            description: "Cuánto tardan en verse las notificaciones",
          },
          {
            title: "Cumplimiento de Viajes",
            url: "/admin/reports/daily-trip-compliance",
            icon: CheckCircle2,
            showInSidebar: false,
            keywords: ["cumplimiento", "diario", "viaje", "matriz"],
            description: "Quién registró su viaje diario y quién no",
          },
          {
            title: "Engagement de Notificaciones",
            url: "/admin/reports/notification-engagement",
            icon: Bell,
            showInSidebar: false,
            keywords: ["engagement", "apertura", "notificacion", "fsr"],
            description: "Quién abre sus notificaciones de trabajo",
          },
        ],
      },
    ],
  },
  {
    title: "Administración",
    sections: [
      {
        title: "Organización",
        items: [
          {
            title: "Cliente",
            url: "/admin/clients",
            icon: Building2,
            keywords: ["cliente", "centro", "verificacion"],
            description: "Centros de inspección",
          },
          {
            title: "Líneas",
            url: "/admin/lines",
            icon: List,
            keywords: ["linea", "carril"],
            description: "Líneas de inspección por centro",
          },
          {
            title: "Equipos",
            url: "/admin/equipments",
            icon: Wrench,
            keywords: ["equipo", "maquina", "aparato"],
            description: "Equipos físicos de cada línea",
          },
          {
            title: "Estados",
            url: "/admin/states",
            icon: MapPin,
            keywords: ["estado", "entidad", "geografia"],
            description: "Entidades federativas",
          },
          {
            title: "Vehículos",
            url: "/admin/vehicles",
            icon: Car,
            keywords: ["vehiculo", "flota", "unidad"],
            description: "Flota de vehículos de servicio",
          },
        ],
      },
      {
        title: "Usuarios y Roles",
        items: [
          {
            title: "Usuarios",
            url: "/admin/users",
            icon: Users,
            keywords: ["usuario", "persona", "cuenta", "empleado"],
            description: "Cuentas, roles y accesos",
          },
          {
            title: "Roles",
            url: "/admin/roles",
            icon: Shield,
            keywords: ["rol", "permiso", "acceso"],
            description: "Roles y sus permisos",
          },
          {
            title: "Permisos",
            url: "/admin/permissions",
            icon: Key,
            keywords: ["permiso", "catalogo", "acceso"],
            description: "Catálogo de permisos (solo lectura)",
          },
          // Reachable only by typing the URL until now: no sidebar ever listed it.
          {
            title: "Difusiones",
            url: "/admin/notifications",
            icon: Bell,
            keywords: ["difusion", "aviso", "broadcast", "comunicado"],
            description: "Avisos masivos a los equipos",
          },
        ],
      },
      {
        title: "Vacaciones (admin)",
        items: [
          {
            title: "Solicitudes",
            url: "/admin/vacations",
            icon: Palmtree,
            keywords: ["solicitud", "aprobar", "vacacion", "permiso"],
            mobilePriority: 2,
            description: "Solicitudes por aprobar y calendarios",
          },
          {
            title: "Días Festivos",
            url: "/admin/holidays",
            icon: Calendar,
            keywords: ["festivo", "feriado", "inhabil", "calendario"],
            description: "Días inhábiles del calendario",
          },
          {
            title: "Reglas de acumulación",
            url: "/admin/settings/vacation-accrual",
            icon: Settings,
            keywords: ["acumulacion", "antiguedad", "regla", "saldo"],
            description: "Días por antigüedad y vigencia",
          },
        ],
      },
      {
        title: "Configuración",
        items: [
          {
            title: "Ciclo de Vida",
            url: "/admin/lifecycle",
            icon: Workflow,
            keywords: ["ciclo", "vida", "flujo", "estado"],
            description: "Flujo de estados de incidentes y asignaciones",
          },
          {
            title: "Canales de notificación",
            url: "/admin/settings/notifications",
            icon: Bell,
            keywords: ["canal", "correo", "email", "notificacion"],
            description: "Qué eventos avisan por correo",
          },
          {
            title: "Tipos de Incidente",
            url: "/admin/incident-types",
            icon: Tag,
            keywords: ["tipo", "categoria", "incidente"],
            description: "Catálogo de tipos de falla",
          },
          {
            title: "Estado de Incidente",
            url: "/admin/incident-status",
            icon: FileText,
            keywords: ["estado", "estatus", "incidente"],
            description: "Catálogo de estados de incidente",
          },
          {
            title: "Estado de Asignación",
            url: "/admin/settings/assignment-status",
            icon: Wrench,
            keywords: ["estado", "estatus", "asignacion"],
            description: "Catálogo de estados de asignación",
          },
          {
            title: "Estado de Equipo",
            url: "/admin/settings/equipment-status",
            icon: Wrench,
            keywords: ["estado", "estatus", "equipo"],
            description: "Catálogo de estados de equipo",
          },
          {
            title: "Estado de Vehículo",
            url: "/admin/settings/vehicle-status",
            icon: Car,
            keywords: ["estado", "estatus", "vehiculo"],
            description: "Catálogo de estados de vehículo",
          },
          {
            title: "Estado de Viaje",
            url: "/admin/settings/vehicle-trip-status",
            icon: Activity,
            keywords: ["estado", "estatus", "viaje"],
            description: "Catálogo de estados de viaje",
          },
          {
            title: "Estado de Usuario",
            url: "/admin/user-status",
            icon: UserCheck,
            keywords: ["estado", "estatus", "usuario", "activo"],
            description: "Catálogo de estados de usuario",
          },
        ],
      },
    ],
  },
];

/**
 * The menu this user can actually use.
 *
 * Items whose route is unreachable disappear, sections left empty disappear
 * with them, and so do groups — an empty "Administración" heading reads as a
 * broken page, not as a hidden one. Items flagged `showInSidebar: false`
 * stay out unless `includeHidden` is set — breadcrumbs and the palette need
 * the full reachable set, the sidebar does not.
 */
export function visibleMenu(
  grants: RouteGrants,
  isSuperuser: boolean,
  options: { includeHidden?: boolean } = {},
): MenuGroup[] {
  const includeHidden = options.includeHidden ?? false;
  return MENU.map((group) => ({
    ...group,
    sections: group.sections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            (includeHidden || item.showInSidebar !== false) &&
            canAccessRoute(grants, isSuperuser, item.url),
        ),
      }))
      .filter((section) => section.items.length > 0),
  })).filter((group) => group.sections.length > 0);
}

export interface FlatMenuItem extends MenuItem {
  group: string;
  section: string;
}

/** Every item in the registry, tagged with its group and section. */
export function flattenMenu(groups: MenuGroup[] = MENU): FlatMenuItem[] {
  return groups.flatMap((group) =>
    group.sections.flatMap((section) =>
      section.items.map((item) => ({
        ...item,
        group: group.title,
        section: section.title,
      })),
    ),
  );
}

export interface Crumb {
  title: string;
  /** Absent on the group entry and on the current page. */
  url?: string;
}

/**
 * Breadcrumb trail for a path, from already-visible menu groups.
 *
 * Only items in the same group as the deepest match count as ancestors, so
 * standing on `/admin/incidents` does not drag in "Panel" (`/admin`) as a
 * parent. Returns [] when nothing matches.
 */
export function breadcrumbsFor(
  pathname: string,
  menu: MenuGroup[] = MENU,
): Crumb[] {
  const flat = flattenMenu(menu);
  const matches = flat.filter(
    (item) =>
      pathname === item.url ||
      pathname.startsWith(`${item.url.replace(/\/$/, "")}/`),
  );
  if (matches.length === 0) return [];
  const deepest = matches.sort((a, b) => b.url.length - a.url.length)[0];
  const ancestors = matches
    .filter(
      (item) =>
        item !== deepest &&
        item.group === deepest.group &&
        item.section === deepest.section,
    )
    .sort((a, b) => a.url.length - b.url.length);
  return [
    { title: deepest.group },
    ...ancestors.map((item) => ({ title: item.title, url: item.url })),
    {
      title: deepest.title,
      ...(pathname === deepest.url ? {} : { url: deepest.url }),
    },
  ];
}
