import {
  Building,
  Calendar,
  Edit as EditIcon,
  FileText,
  Plus,
  User,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { CancelIncidentButton } from "@/components/admin/incidents/cancel-incident-button";
import { IncidentTimeline } from "@/components/admin/incidents/incident-timeline";
import { BackButton } from "@/components/common/back-button";
import { EmptyState } from "@/components/common/empty-state";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { ResponsiveTable } from "@/components/common/responsive-table";
import { SectionCard } from "@/components/common/section-card";
import { StatusBadge, type StatusTone } from "@/components/common/status-badge";
import { IncidentAttachments } from "@/components/incidents/incident-attachments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getIncidentById } from "@/lib/actions/incidents";
import { canPerform, requireRouteAccess } from "@/lib/auth/auth";
import {
  isIncidentCancelled,
  isIncidentTerminal,
} from "@/lib/constants/status-codes";
import { formatIncidentDateTime, formatMX } from "@/lib/utils/datetime";
import { formatReporter } from "@/lib/utils/incident-display";

function incidentStatusTone(status: string): StatusTone {
  switch (status) {
    case "ABIERTO":
    case "ASIGNADO":
      return "open";
    case "VISTO":
      return "info";
    case "INICIADO":
    case "EN_PROGRESO":
      return "progress";
    case "CERRADO":
      return "done";
    case "CANCELADA":
      return "cancelled";
    default:
      return "neutral";
  }
}

export default async function IncidentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ historial?: string }>;
}) {
  await requireRouteAccess("/admin/incidents");

  const { id } = await params;
  const incident = await getIncidentById(Number.parseInt(id, 10));
  const historyPage = Math.max(
    1,
    Number.parseInt((await searchParams)?.historial ?? "1", 10) || 1,
  );
  // RF-217: same create-OR-update gate as the attachment actions — REPORTER
  // reporters hold create, operators hold update.
  const [canCreate, canUpdate] = await Promise.all([
    canPerform("incidents:create"),
    canPerform("incidents:update"),
  ]);
  const terminal = isIncidentTerminal(incident.status);

  return (
    <PageContainer>
      <PageHeader
        title={incident.title}
        description={`Folio: INC-${incident.id}`}
        breadcrumbs={[
          { label: "Incidentes", href: "/admin/incidents" },
          { label: `INC-${incident.id}` },
        ]}
        actions={
          <>
            {!terminal && (
              <>
                <Button variant="outline" asChild className="w-full sm:w-auto">
                  <Link href={`/admin/incidents/${incident.id}/edit`}>
                    <EditIcon className="mr-2 h-4 w-4" aria-hidden />
                    Editar incidencia
                  </Link>
                </Button>
                <CancelIncidentButton incidentId={incident.id} />
              </>
            )}
            <StatusBadge tone={incidentStatusTone(incident.status?.name ?? "")}>
              {incident.status?.name || "Sin estado"}
            </StatusBadge>
          </>
        }
      />
      <div>
        <BackButton fallback="/admin/incidents" />
      </div>

      {isIncidentCancelled(incident.status) && incident.cancellationReason && (
        <Card className="border-danger/50 bg-danger-muted">
          <CardHeader>
            <CardTitle className="text-danger-muted-foreground">
              Incidencia cancelada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              <span className="font-medium">Razón:</span>{" "}
              {incident.cancellationReason}
            </p>
            {incident.cancelledAt && (
              <p className="text-xs text-muted-foreground mt-1">
                Cancelada el {formatMX(incident.cancelledAt)}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Incident Details Card */}
      <SectionCard title="Detalles del Incidente">
        <div className="space-y-6">
          {/* Description */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">Descripción</p>
            <p className="text-base">{incident.description}</p>
          </div>

          <div className="border-t" />

          {/* Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Tipo</p>
                <p className="font-medium">
                  {incident.type?.name || "Sin tipo"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Building className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Cliente</p>
                <p className="font-medium">
                  {incident.client
                    ? `${incident.client.name} (${incident.client.code})`
                    : "Sin asignar"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Reportado por</p>
                <p className="font-medium">
                  {formatReporter(
                    incident.reportedBy?.name,
                    incident.reporterName,
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">
                  Fecha de reporte
                </p>
                <p className="font-medium">
                  {formatIncidentDateTime(
                    incident.reportedAt,
                    incident.client?.state?.code,
                  )}
                </p>
              </div>
            </div>

            {incident.startedAt && (
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">
                    Fecha de inicio
                  </p>
                  <p className="font-medium">
                    {formatIncidentDateTime(
                      incident.startedAt,
                      incident.client?.state?.code,
                    )}
                  </p>
                </div>
              </div>
            )}

            {incident.resolvedAt && (
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">
                    Fecha de resolución
                  </p>
                  <p className="font-medium">
                    {formatIncidentDateTime(
                      incident.resolvedAt,
                      incident.client?.state?.code,
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>

          {incident.schedule && (
            <>
              <div className="border-t" />
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Programación
                </p>
                <p className="font-medium">{incident.schedule.title}</p>
                <p className="text-sm text-muted-foreground">
                  {formatMX(incident.schedule.scheduledAt)}
                </p>
              </div>
            </>
          )}

          <div className="border-t" />
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              FSRs Habilitados ({incident.assignees?.length || 0})
            </p>
            {incident.assignees && incident.assignees.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {incident.assignees.map((a) => (
                  <Badge key={a.user.id} variant="secondary">
                    {a.user.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aún no hay FSRs habilitados. Edita la incidencia para asignar
                FSRs.
              </p>
            )}
          </div>
        </div>
      </SectionCard>

      {/* Evidence photos filed with the report (RF-217) */}
      <IncidentAttachments
        incidentId={incident.id}
        attachments={incident.attachments ?? []}
        canManage={canCreate || canUpdate}
        terminal={terminal}
      />

      {/* Assignments Section */}
      <SectionCard
        title={`Asignaciones (${incident.assignments?.length || 0})`}
        description="Todas las asignaciones de este incidente"
        actions={
          <Button asChild className="w-full sm:w-auto">
            <Link href={`/admin/assignments/new?incidentId=${incident.id}`}>
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              Crear Asignación
            </Link>
          </Button>
        }
      >
        {(incident.assignments?.length || 0) === 0 ? (
          <EmptyState
            icon={Wrench}
            title="Aún no hay asignaciones"
            description="Crea una asignación para comenzar a dar seguimiento a este incidente"
            action={{
              label: "Crear primera asignación",
              href: `/admin/assignments/new?incidentId=${incident.id}`,
            }}
          />
        ) : (
          <ResponsiveTable
            data={incident.assignments ?? []}
            rowKey={(wo) => wo.id}
            columns={[
              {
                header: "Estado",
                cell: (wo) => (
                  <StatusBadge tone={incidentStatusTone(wo.status?.name ?? "")}>
                    {wo.status?.name || "Sin estado"}
                  </StatusBadge>
                ),
              },
              {
                header: "Asignado a",
                cell: (wo) => (
                  <div className="space-y-1">
                    {wo.assignees.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Sin asignar
                      </p>
                    ) : (
                      wo.assignees.map((aa) => (
                        <div key={aa.user.id}>
                          <p className="font-medium">{aa.user.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {aa.user.email}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                ),
              },
              {
                header: "Actividades",
                cell: (wo) => (
                  <Badge variant="outline">
                    {wo._count?.assignmentActivities || 0}
                  </Badge>
                ),
              },
              {
                header: "Creado",
                cell: (wo) => (
                  <span className="text-sm text-muted-foreground">
                    {formatMX(wo.createdAt, { dateStyle: "short" })}
                  </span>
                ),
              },
              {
                header: "Finalizado",
                cell: (wo) => (
                  <span className="text-sm text-muted-foreground">
                    {wo.finishedAt
                      ? formatMX(wo.finishedAt, { dateStyle: "short" })
                      : "-"}
                  </span>
                ),
              },
              {
                header: "Acciones",
                headerClassName: "text-right",
                className: "text-right",
                cell: (wo) => (
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/admin/assignments/${wo.id}`}>Ver</Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/admin/assignments/${wo.id}/edit`}>
                        <EditIcon className="mr-2 h-4 w-4" aria-hidden />
                        Editar
                      </Link>
                    </Button>
                  </div>
                ),
              },
            ]}
            mobileCard={(wo) => (
              <div className="space-y-2 rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={incidentStatusTone(wo.status?.name ?? "")}>
                    {wo.status?.name || "Sin estado"}
                  </StatusBadge>
                  <span className="text-xs text-muted-foreground">
                    {wo._count?.assignmentActivities || 0} actividades
                  </span>
                </div>
                <p className="text-sm">
                  {wo.assignees.length === 0
                    ? "Sin asignar"
                    : wo.assignees.map((aa) => aa.user.name).join(", ")}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="flex-1"
                  >
                    <Link href={`/admin/assignments/${wo.id}`}>Ver</Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="flex-1"
                  >
                    <Link href={`/admin/assignments/${wo.id}/edit`}>
                      Editar
                    </Link>
                  </Button>
                </div>
              </div>
            )}
            emptyTitle="Aún no hay asignaciones"
            emptyMessage="Crea una asignación para comenzar a dar seguimiento a este incidente"
          />
        )}
      </SectionCard>

      {/* Audit trail (RF-219): append-only event history, read-only. */}
      <IncidentTimeline incidentId={incident.id} page={historyPage} />
    </PageContainer>
  );
}
