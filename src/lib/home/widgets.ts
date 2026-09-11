import { canAccessRoute, type RouteGrants } from "@/lib/authz/route-access";

/**
 * Pure widget registry for the /inicio home (Fase 3).
 *
 * Metadata ONLY — no Prisma, no Next APIs, no auth lookups. The registry
 * decides WHICH widgets a viewer may see; the loaders in
 * `src/lib/actions/home-*.ts` re-check the same permission and actually
 * fetch. Registry ≠ authorization, on purpose: a stale client list must
 * still hit a server gate that denies.
 *
 * Every widget demands permission AND route (double check): FSR holds
 * `reports:view` and `dashboard:view` but no `/admin/*` route, so without
 * the route half it would see admin widgets. The one exception is
 * `upcoming-schedules` — FSR/REPORTER/GUEST share no schedule route, so it
 * requires only the permission and its component links conditionally.
 */

export type WidgetId =
  | "quick-actions"
  | "notifications"
  | "my-work"
  | "my-active-trip"
  | "my-reports"
  | "my-vacation"
  | "vacation-approvals"
  | "upcoming-absences"
  | "tracking-queue"
  | "ops-kpis"
  | "incidents-by-status"
  | "sla-risk"
  | "upcoming-schedules";

/** Grid footprint: sm = 1 col, md = 2 cols, lg = full row (xl:4). */
export type WidgetSize = "sm" | "md" | "lg";

export interface WidgetRequirement {
  /** ALL of these permissions (AND). */
  permissions?: readonly string[];
  /** ANY of these permissions (OR). */
  anyPermission?: readonly string[];
  /** Reachable route — the page behind the widget must open. */
  route?: string;
}

export interface WidgetDefinition {
  id: WidgetId;
  title: string;
  description?: string;
  requires: WidgetRequirement;
  size: WidgetSize;
  /** Grid order, ascending. */
  priority: number;
  /**
   * Personal data (own assignments, trips, reports, vacations). A superuser
   * holds every permission but has no personal rows, so the component hides
   * the widget when its data is empty for a superuser.
   */
  selfService?: boolean;
}

/** The minimum a viewer decision needs — buildable from UserAuthz or by hand. */
export interface WidgetViewer {
  permissions: ReadonlySet<string> | readonly string[];
  routeGrants: RouteGrants;
  isSuperuser: boolean;
}

export function viewerFromUser(user: {
  permissions: WidgetViewer["permissions"];
  routeGrants: RouteGrants;
  isSuperuser: boolean;
}): WidgetViewer {
  return {
    permissions: user.permissions,
    routeGrants: user.routeGrants,
    isSuperuser: user.isSuperuser,
  };
}

function hasPermission(viewer: WidgetViewer, name: string): boolean {
  return viewer.isSuperuser
    ? true
    : viewer.permissions instanceof Set
      ? viewer.permissions.has(name)
      : viewer.permissions.includes(name);
}

export function isWidgetVisible(
  viewer: WidgetViewer,
  def: WidgetDefinition,
): boolean {
  if (viewer.isSuperuser) return true;
  const { permissions, anyPermission, route } = def.requires;
  if (permissions && !permissions.every((p) => hasPermission(viewer, p))) {
    return false;
  }
  if (anyPermission && !anyPermission.some((p) => hasPermission(viewer, p))) {
    return false;
  }
  if (
    route &&
    !canAccessRoute(viewer.routeGrants, viewer.isSuperuser, route)
  ) {
    return false;
  }
  return true;
}

export const WIDGETS: readonly WidgetDefinition[] = [
  {
    id: "quick-actions",
    title: "Accesos rápidos",
    description: "Acciones según tus permisos",
    requires: {},
    size: "lg",
    priority: 0,
  },
  {
    id: "notifications",
    title: "Notificaciones",
    description: "Tus avisos recientes",
    requires: { permissions: ["notifications:read"], route: "/notifications" },
    size: "md",
    priority: 10,
  },
  {
    id: "my-work",
    title: "Mi trabajo",
    description: "Tus órdenes de trabajo",
    requires: { permissions: ["assignments:read"], route: "/fsr/assignments" },
    size: "md",
    priority: 20,
    selfService: true,
  },
  {
    id: "my-active-trip",
    title: "Mi viaje",
    description: "Tu recorrido de hoy",
    requires: {
      permissions: ["vehicle-trips:read"],
      route: "/fsr/vehicle-trips",
    },
    size: "sm",
    priority: 30,
    selfService: true,
  },
  {
    id: "my-reports",
    title: "Mis reportes",
    description: "Incidentes que levantaste",
    requires: { permissions: ["incidents:create"], route: "/reporter" },
    size: "md",
    priority: 40,
    selfService: true,
  },
  {
    id: "my-vacation",
    title: "Mis vacaciones",
    description: "Tu saldo y próximas solicitudes",
    requires: { permissions: ["vacations:read"], route: "/vacations" },
    size: "md",
    priority: 50,
    selfService: true,
  },
  {
    id: "vacation-approvals",
    title: "Vacaciones por aprobar",
    description: "Solicitudes pendientes de decisión",
    requires: { permissions: ["vacations:approve"], route: "/admin/vacations" },
    size: "md",
    priority: 60,
  },
  {
    id: "upcoming-absences",
    title: "Próximas ausencias",
    description: "Quién estará fuera",
    requires: { permissions: ["vacations:manage"], route: "/admin/vacations" },
    size: "md",
    priority: 70,
  },
  {
    id: "tracking-queue",
    title: "Cola de seguimiento",
    description: "Incidentes abiertos, del más antiguo al más reciente",
    requires: { permissions: ["tracking:read"], route: "/admin/tracking" },
    size: "lg",
    priority: 80,
  },
  {
    id: "ops-kpis",
    title: "Indicadores de operación",
    description: "Resumen de la operación en tu alcance",
    // ADMIN_OPERACION holds both, so it sees this beside incidents-by-status
    // and sla-risk; FSR holds dashboard:view but no /admin route, so the
    // route half keeps it out.
    requires: { permissions: ["dashboard:view"], route: "/admin/incidents" },
    size: "lg",
    priority: 90,
  },
  {
    id: "incidents-by-status",
    title: "Incidentes por estado",
    description: "Distribución de incidentes abiertos",
    requires: { permissions: ["incidents:read"], route: "/admin/incidents" },
    size: "md",
    priority: 100,
  },
  {
    id: "sla-risk",
    title: "Riesgo de SLA",
    description: "Vencidos y en riesgo (30 días)",
    requires: {
      permissions: ["reports:view"],
      route: "/admin/reports/sla-breach",
    },
    size: "md",
    priority: 110,
  },
  {
    id: "upcoming-schedules",
    title: "Próximas programaciones",
    description: "Visitas agendadas en tu alcance",
    // No route: FSR/REPORTER/GUEST share no schedule page. The component
    // links to /admin/schedules only when the viewer can open it.
    requires: { permissions: ["schedules:read"] },
    size: "md",
    priority: 120,
  },
];

/**
 * Visible widgets for a viewer, ordered by priority (stable).
 * Superuser sees every widget — personal ones hide later when empty.
 */
export function selectWidgets(
  viewer: WidgetViewer,
  registry: readonly WidgetDefinition[] = WIDGETS,
): WidgetDefinition[] {
  return registry
    .filter((def) => isWidgetVisible(viewer, def))
    .sort((a, b) => a.priority - b.priority);
}
