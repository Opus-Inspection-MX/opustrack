import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  ExternalLink,
  Lock,
  Paperclip,
  User,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AssignmentItems } from "@/components/assignments/assignment-items";
import { AttachmentPreview } from "@/components/assignments/attachment-preview";
import { BackButton } from "@/components/common/back-button";
import { EmptyState } from "@/components/common/empty-state";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { StatusBadge, type StatusTone } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getAssignmentActivities } from "@/lib/actions/assignment-activities";
import { getAssignmentItems } from "@/lib/actions/assignment-items";
import { getAssignmentById } from "@/lib/actions/assignments";
import { formatMX } from "@/lib/utils/datetime";

interface Attachment {
  id: string;
  filename: string;
  filepath: string;
  mimetype: string;
  size: number;
  uploadedAt: Date;
  description?: string | null;
  provider?: string | null;
}

export default async function AssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [assignment, activities, items] = await Promise.all([
    getAssignmentById(id),
    getAssignmentActivities(id),
    getAssignmentItems(id),
  ]);

  if (!assignment) notFound();

  // Helper to calculate time-to-unlock
  const formatTimeDifference = (
    start: Date | string | null,
    end: Date | string | null,
  ): string => {
    if (!start || !end) return "-";
    const diffMs = new Date(end).getTime() - new Date(start).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 60) return `${diffMins}m`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    if (hours < 24) return `${hours}h ${mins}m`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  };

  function statusTone(status: string): StatusTone {
    switch (status) {
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

  return (
    <PageContainer>
      <PageHeader
        title="Asignación"
        description={assignment.incident.title}
        breadcrumbs={[
          { label: "Asignaciones", href: "/admin/assignments" },
          { label: `AS-${assignment.folio}` },
        ]}
        actions={
          <Button variant="outline" asChild className="w-full sm:w-auto">
            <Link href={`/admin/assignments/${id}/edit`}>Editar</Link>
          </Button>
        }
      />
      <div>
        <BackButton fallback="/admin/assignments" />
      </div>

      {/* Parent Incident Link */}
      <Card className="bg-muted/30">
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-primary" aria-hidden />
            <div>
              <p className="text-sm text-muted-foreground">Incidencia padre</p>
              <p className="font-medium">{assignment.incident.title}</p>
              <p className="text-xs text-muted-foreground">
                Estado: {assignment.incident.status?.name}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            asChild
            className="w-full sm:w-auto"
          >
            <Link href={`/admin/incidents/${assignment.incident.id}`}>
              <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
              Ver incidencia
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
        <SectionCard title="Detalles de la Asignación">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <AlertTriangle
                className="h-5 w-5 text-muted-foreground"
                aria-hidden
              />
              <div>
                <p className="text-sm text-muted-foreground">Incidente</p>
                <p className="font-medium">{assignment.incident.title}</p>
                {assignment.incident.type && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Tipo: {assignment.incident.type.name}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">
                  {assignment.assignees.length > 1
                    ? "Asignados a"
                    : "Asignado a"}
                </p>
                <p className="font-medium">
                  {assignment.assignees.map((a) => a.user.name).join(", ") ||
                    "Sin asignar"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" aria-hidden />
              <div>
                <p className="text-sm text-muted-foreground">Estado</p>
                {assignment.status ? (
                  <StatusBadge tone={statusTone(assignment.status.name)}>
                    {assignment.status.name}
                  </StatusBadge>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Sin estado
                  </span>
                )}
              </div>
            </div>

            {assignment.notes && (
              <div>
                <p className="text-sm text-muted-foreground">Notas</p>
                <p className="text-sm mt-1">{assignment.notes}</p>
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Resumen">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Actividades</p>
                <p className="text-2xl font-bold">{activities.length}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Refacciones y Equipo
                </p>
                <p className="text-2xl font-bold">{items.length}</p>
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Fecha de Creacion</p>
              <p className="font-medium">{formatMX(assignment.createdAt)}</p>
            </div>

            {assignment.assignedAt && (
              <div>
                <p className="text-sm text-muted-foreground">Asignado</p>
                <p className="font-medium">{formatMX(assignment.assignedAt)}</p>
              </div>
            )}

            <div>
              <p className="text-sm text-muted-foreground">
                Estado de Desbloqueo
              </p>
              {assignment.seenAt ? (
                <div className="mt-1">
                  <StatusBadge tone="success">
                    <CheckCircle className="h-3 w-3 mr-1" aria-hidden />
                    Desbloqueado
                  </StatusBadge>
                  <p className="text-sm mt-1">{formatMX(assignment.seenAt)}</p>
                  {assignment.assignedAt && (
                    <p className="text-xs text-muted-foreground">
                      Tiempo hasta desbloqueo:{" "}
                      {formatTimeDifference(
                        assignment.assignedAt,
                        assignment.seenAt,
                      )}
                    </p>
                  )}
                </div>
              ) : (
                <StatusBadge tone="warning">
                  <Lock className="h-3 w-3 mr-1" aria-hidden />
                  No Desbloqueado
                </StatusBadge>
              )}
            </div>

            {assignment.startedAt && (
              <div>
                <p className="text-sm text-muted-foreground">Iniciado</p>
                <p className="font-medium">{formatMX(assignment.startedAt)}</p>
              </div>
            )}

            {assignment.finishedAt && (
              <div>
                <p className="text-sm text-muted-foreground">Finalizado</p>
                <p className="font-medium">{formatMX(assignment.finishedAt)}</p>
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Actividades Realizadas">
        {activities.length === 0 ? (
          <EmptyState
            title="Sin actividades"
            description="No hay actividades registradas"
          />
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="border-l-2 border-primary pl-4 py-2"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{activity.description}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatMX(activity.performedAt)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <AssignmentItems assignmentId={id} items={items} readOnly />

      {/* Attachments */}
      <SectionCard title={`Adjuntos (${assignment.attachments?.length || 0})`}>
        {!assignment.attachments || assignment.attachments.length === 0 ? (
          <EmptyState
            icon={Paperclip}
            title="Sin adjuntos"
            description="No hay archivos adjuntos"
          />
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {assignment.attachments.map((attachment: Attachment) => (
              <AttachmentPreview
                key={attachment.id}
                attachment={attachment}
                readOnly={true}
              />
            ))}
          </div>
        )}
      </SectionCard>
    </PageContainer>
  );
}
