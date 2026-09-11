import {
  AlertTriangle,
  Bell,
  Calendar,
  Car,
  CheckCircle2,
  ClipboardList,
  FilePlus2,
  Palmtree,
  type LucideIcon,
} from "lucide-react";
import { canAccessRoute } from "@/lib/authz/route-access";
import type { WidgetViewer } from "./widgets";

/**
 * Pure quick actions for the /inicio hero row (Fase 3).
 *
 * Each action carries its own optional permission besides its URL: the row
 * filters with the same `canAccessRoute` as `visibleMenu`, so an action
 * shows exactly when its page would open. No Prisma, no Next APIs — tested
 * in vitest without mocks.
 */

export interface QuickActionDef {
  title: string;
  description: string;
  url: string;
  icon: LucideIcon;
  /** Extra gate besides the route (e.g. creating vs merely opening). */
  permission?: string;
}

export const QUICK_ACTIONS: readonly QuickActionDef[] = [
  {
    title: "Reportar incidente",
    description: "Levanta un reporte de falla en tu centro",
    url: "/reporter/new",
    icon: AlertTriangle,
    permission: "incidents:create",
  },
  {
    title: "Nuevo incidente",
    description: "Registra una falla desde operación",
    url: "/admin/incidents/new",
    icon: FilePlus2,
    permission: "incidents:create",
  },
  {
    title: "Iniciar viaje",
    description: "Registra tu recorrido con odómetro y foto",
    url: "/fsr/vehicle-trips/start",
    icon: Car,
    permission: "vehicle-trips:create",
  },
  {
    title: "Solicitar vacaciones",
    description: "Pide tus días de descanso",
    url: "/vacations/new",
    icon: Palmtree,
    permission: "vacations:create",
  },
  {
    title: "Nueva programación",
    description: "Agenda una visita a un centro",
    url: "/admin/schedules/new",
    icon: Calendar,
    permission: "schedules:create",
  },
  {
    title: "Seguimiento",
    description: "Cola de atención de incidentes",
    url: "/admin/tracking",
    icon: ClipboardList,
    permission: "tracking:read",
  },
  {
    title: "Aprobar vacaciones",
    description: "Decide las solicitudes pendientes",
    url: "/admin/vacations",
    icon: CheckCircle2,
    permission: "vacations:approve",
  },
  {
    title: "Difundir aviso",
    description: "Envía un aviso a los equipos",
    url: "/admin/notifications",
    icon: Bell,
    permission: "notifications:broadcast",
  },
];

function hasPermission(viewer: WidgetViewer, name: string): boolean {
  return viewer.isSuperuser
    ? true
    : viewer.permissions instanceof Set
      ? viewer.permissions.has(name)
      : viewer.permissions.includes(name);
}

/**
 * Actions this viewer can actually use, capped at `max` (default 6).
 * Superuser sees them all — the route behind each one opens for ROOT.
 */
export function visibleQuickActions(
  viewer: WidgetViewer,
  max = 6,
): QuickActionDef[] {
  return QUICK_ACTIONS.filter(
    (action) =>
      (!action.permission || hasPermission(viewer, action.permission)) &&
      canAccessRoute(viewer.routeGrants, viewer.isSuperuser, action.url),
  ).slice(0, max);
}
