import { AlertTriangle, Car, FilePlus2, type LucideIcon } from "lucide-react";
import { canAccessRoute, type RouteGrants } from "@/lib/authz/route-access";

export interface QuickAction {
  title: string;
  description: string;
  url: string;
  icon: LucideIcon;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    title: "Nuevo incidente",
    description: "Registra una falla desde operación",
    url: "/admin/incidents/new",
    icon: FilePlus2,
  },
  {
    title: "Reportar incidente",
    description: "Levanta un reporte de falla en tu centro",
    url: "/reporter/new",
    icon: AlertTriangle,
  },
  {
    title: "Iniciar viaje",
    description: "Registra tu recorrido con odómetro y foto",
    url: "/fsr/vehicle-trips/start",
    icon: Car,
  },
];

/** Quick actions whose page the user can actually open. */
export function quickActions(
  grants: RouteGrants,
  isSuperuser: boolean,
): QuickAction[] {
  return QUICK_ACTIONS.filter((action) =>
    canAccessRoute(grants, isSuperuser, action.url),
  );
}
