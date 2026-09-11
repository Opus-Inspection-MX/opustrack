import {
  Calendar,
  CheckCircle,
  Clock,
  FileText,
  User,
  Wrench,
} from "lucide-react";
import NextImage from "next/image";
import { notFound } from "next/navigation";
import { BackButton } from "@/components/common/back-button";
import { EmptyState } from "@/components/common/empty-state";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { StatusBadge } from "@/components/common/status-badge";
import { getAssignmentById } from "@/lib/actions/assignments";
import { requireRouteAccess } from "@/lib/auth/auth";
import { getFileUrl } from "@/lib/storage/file-storage";
import { formatMX } from "@/lib/utils/datetime";

export default async function ReporterAssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRouteAccess("/reporter");
  const { id } = await params;

  const assignment = await getAssignmentById(id);
  if (!assignment) notFound();

  const getTimelineStep = (
    label: string,
    date: Date | string | null | undefined,
    isActive: boolean,
  ) => (
    <div className="flex items-center gap-3">
      <div
        className={`h-8 w-8 rounded-full flex items-center justify-center ${
          date
            ? "bg-success-muted text-success-muted-foreground"
            : isActive
              ? "bg-info-muted text-info-muted-foreground animate-pulse"
              : "bg-muted text-muted-foreground"
        }`}
      >
        {date ? (
          <CheckCircle className="h-4 w-4" aria-hidden />
        ) : (
          <Clock className="h-4 w-4" aria-hidden />
        )}
      </div>
      <div>
        <p className="text-sm font-medium">{label}</p>
        {date && (
          <p className="text-xs text-muted-foreground">{formatMX(date)}</p>
        )}
      </div>
    </div>
  );

  return (
    <PageContainer>
      <PageHeader
        title={`Asignación AS-${assignment.folio}`}
        breadcrumbs={[
          { label: "Mis Incidentes", href: "/reporter" },
          { label: `AS-${assignment.folio}` },
        ]}
        actions={
          assignment.status ? (
            <StatusBadge tone="info">{assignment.status.name}</StatusBadge>
          ) : undefined
        }
      />
      <div>
        <BackButton
          fallback={
            assignment.incident
              ? `/reporter/incidents/${assignment.incident.id}`
              : "/reporter"
          }
          label="Volver"
        />
      </div>

      {/* Timeline */}
      <SectionCard
        title="Progreso"
        description="Seguimiento del estado de la asignación"
      >
        <div className="flex flex-col gap-4">
          {getTimelineStep("Creada", assignment.createdAt, false)}
          {getTimelineStep(
            "Asignada",
            assignment.assignedAt,
            !assignment.assignedAt,
          )}
          {getTimelineStep(
            "Recibida por FSR",
            assignment.seenAt,
            !!assignment.assignedAt && !assignment.seenAt,
          )}
          {getTimelineStep(
            "Trabajo iniciado",
            assignment.startedAt,
            !!assignment.seenAt && !assignment.startedAt,
          )}
          {getTimelineStep(
            "Completada",
            assignment.finishedAt,
            !!assignment.startedAt && !assignment.finishedAt,
          )}
        </div>
      </SectionCard>

      {/* Assigned FSRs */}
      {assignment.assignees && assignment.assignees.length > 0 && (
        <SectionCard
          title={
            assignment.assignees.length === 1
              ? "Tecnico Asignado"
              : "Tecnicos Asignados"
          }
        >
          <ul className="space-y-3">
            {assignment.assignees.map((aa) => (
              <li key={aa.user.id} className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" aria-hidden />
                </div>
                <div>
                  <p className="font-medium">{aa.user.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {aa.user.email}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* Work Activities */}
      <SectionCard
        title={`Actividades Realizadas (${assignment.assignmentActivities?.length || 0})`}
        description="Trabajo documentado por el tecnico"
      >
        {!assignment.assignmentActivities ||
        assignment.assignmentActivities.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title="Sin actividades"
            description="Aun no se han registrado actividades"
          />
        ) : (
          <ul className="space-y-4">
            {assignment.assignmentActivities.map((activity) => (
              <li key={activity.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p>{activity.description}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" aria-hidden />
                      <span>{formatMX(activity.performedAt)}</span>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* Attachments */}
      {assignment.attachments && assignment.attachments.length > 0 && (
        <SectionCard
          title={`Evidencia (${assignment.attachments.length})`}
          description="Fotos y documentos del trabajo realizado"
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {assignment.attachments.map((attachment) => {
              const url = getFileUrl(
                attachment.filepath,
                attachment.provider as "vercel-blob" | "filesystem",
              );
              return (
                <a
                  key={attachment.id}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border rounded-lg p-3 hover:bg-accent/50 transition-colors flex flex-col items-center gap-2"
                >
                  {attachment.mimetype?.startsWith("image/") ? (
                    <NextImage
                      src={url}
                      alt={attachment.filename}
                      width={200}
                      height={128}
                      unoptimized
                      className="w-full h-32 object-cover rounded"
                    />
                  ) : (
                    <FileText
                      className="h-12 w-12 text-muted-foreground"
                      aria-hidden
                    />
                  )}
                  <p className="text-xs text-muted-foreground truncate w-full text-center">
                    {attachment.filename}
                  </p>
                </a>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* Notes */}
      {assignment.notes && (
        <SectionCard title="Notas">
          <p>{assignment.notes}</p>
        </SectionCard>
      )}
    </PageContainer>
  );
}
