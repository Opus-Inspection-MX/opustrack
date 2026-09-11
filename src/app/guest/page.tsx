import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAuth, requireRouteAccess } from "@/lib/auth/auth";
import {
  getReportScope,
  incidentScopeWhere,
  scheduleScopeWhere,
} from "@/lib/auth/report-scope";
import { prisma } from "@/lib/database/prisma.singleton";
import { formatMX } from "@/lib/utils/datetime";

/**
 * Read-only consultation landing (Fase 3): GUEST holds incidents:read,
 * assignments:read and schedules:read, so instead of the old static
 * "restricted" notice this page shows the scoped data without any
 * create/update affordance — no links to detail pages, no buttons.
 */
export default async function GuestDashboard() {
  await requireRouteAccess("/guest");
  const user = await requireAuth();
  const scope = await getReportScope(user);

  const [incidents, schedules] = await Promise.all([
    prisma.incident.findMany({
      where: { active: true, ...incidentScopeWhere(scope) },
      include: {
        status: { select: { name: true } },
        client: { select: { name: true } },
      },
      orderBy: { reportedAt: "desc" },
      take: 5,
    }),
    prisma.schedule.findMany({
      where: {
        active: true,
        scheduledAt: { gte: new Date() },
        ...scheduleScopeWhere(scope),
      },
      orderBy: { scheduledAt: "asc" },
      take: 5,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Panel de Invitado</h1>
        <p className="text-muted-foreground mt-2">
          Consulta de solo lectura ·{" "}
          <Link href="/inicio" className="text-primary hover:underline">
            volver a Inicio
          </Link>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Incidentes recientes</CardTitle>
            <CardDescription>
              Últimos reportes en tu alcance, sin acciones disponibles
            </CardDescription>
          </CardHeader>
          <CardContent>
            {incidents.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No hay incidentes en tu alcance.
              </p>
            ) : (
              <ul className="space-y-3">
                {incidents.map((incident) => (
                  <li
                    key={incident.id}
                    className="flex items-center justify-between gap-2 border-b py-2 last:border-0"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium">{incident.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {incident.client?.name ?? "Sin centro"} ·{" "}
                        {formatMX(incident.reportedAt)}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {incident.status?.name ?? "Sin estado"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Próximas programaciones</CardTitle>
            <CardDescription>Visitas agendadas en tu alcance</CardDescription>
          </CardHeader>
          <CardContent>
            {schedules.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nada agendado.
              </p>
            ) : (
              <ul className="space-y-3">
                {schedules.map((schedule) => (
                  <li
                    key={schedule.id}
                    className="flex items-center justify-between gap-2 border-b py-2 last:border-0"
                  >
                    <p className="text-sm font-medium">{schedule.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatMX(schedule.scheduledAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Tu cuenta es de solo lectura: para solicitar permisos adicionales,
        contacta a tu administrador.
      </p>
    </div>
  );
}
