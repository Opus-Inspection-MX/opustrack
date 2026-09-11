import Link from "next/link";
import { EmptyState } from "@/components/common/empty-state";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { StatusBadge } from "@/components/common/status-badge";
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
    <PageContainer>
      <PageHeader
        title="Panel de Invitado"
        description="Consulta de solo lectura"
      />

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <SectionCard
          title="Incidentes recientes"
          description="Últimos reportes en tu alcance, sin acciones disponibles"
        >
          {incidents.length === 0 ? (
            <EmptyState
              title="Sin incidentes"
              description="No hay incidentes en tu alcance."
            />
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
                  <StatusBadge tone="neutral">
                    {incident.status?.name ?? "Sin estado"}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Próximas programaciones"
          description="Visitas agendadas en tu alcance"
        >
          {schedules.length === 0 ? (
            <EmptyState title="Nada agendado" description="Nada agendado." />
          ) : (
            <ul className="space-y-3">
              {schedules.map((schedule) => (
                <li
                  key={schedule.id}
                  className="flex flex-col gap-1 border-b py-2 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-2"
                >
                  <p className="text-sm font-medium">{schedule.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatMX(schedule.scheduledAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Tu cuenta es de solo lectura: para solicitar permisos adicionales,
        contacta a tu administrador.{" "}
        <Link href="/inicio" className="text-primary hover:underline">
          Volver a Inicio
        </Link>
      </p>
    </PageContainer>
  );
}
