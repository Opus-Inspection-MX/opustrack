"use client";

import {
  Activity,
  AlertTriangle,
  Lock,
  Paperclip,
  ScrollText,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AssignmentActivityEdit } from "@/components/assignments/assignment-activity-edit";
import { AssignmentActivityForm } from "@/components/assignments/assignment-activity-form";
import { AssignmentItems } from "@/components/assignments/assignment-items";
import { AttachmentPreview } from "@/components/assignments/attachment-preview";
import { OdtFolioCapture } from "@/components/assignments/odt-folio-capture";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import {
  ActivitiesSection,
  AssignmentDetails,
  AssignmentHeader,
  AttachmentsSection,
  JobActions,
} from "@/components/fsr/assignment-detail";
import { PendingDrafts } from "@/components/offline/pending-drafts";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/hooks/use-toast";
import {
  deleteAssignmentActivity,
  getAssignmentActivities,
} from "@/lib/actions/assignment-activities";
import { getAssignmentItems } from "@/lib/actions/assignment-items";
import {
  closeAssignment,
  deleteAssignmentAttachment,
  getAssignmentById,
  markAssignmentSeen,
  pauseAssignment,
  resumeAssignment,
  startAssignmentWork,
} from "@/lib/actions/assignments";
import { isFailure } from "@/lib/actions/result";
import { logger } from "@/lib/observability/logger";
import { describeEnqueueFailure, saveDraft } from "@/lib/offline/flush";

interface AssignmentStatus {
  id: number;
  name: string;
  color?: string | null;
}

interface Client {
  id: string;
  name: string;
  code: string;
}

interface AssignmentIncident {
  id: number;
  title: string;
  status?: AssignmentStatus | null;
  type?: { name: string } | null;
  client?: Client | null;
}

interface FSRAssignment {
  id: string;
  folio: number;
  odtFolio?: string | null;
  notes?: string | null;
  status?: AssignmentStatus | null;
  startedAt?: Date | string | null;
  finishedAt?: Date | string | null;
  seenAt?: Date | string | null;
  seenBy?: { id: string; name: string } | null;
  startLatitude?: number | null;
  startLongitude?: number | null;
  startAddress?: string | null;
  endLatitude?: number | null;
  endLongitude?: number | null;
  endAddress?: string | null;
  assignedAt?: Date | string | null;
  createdAt?: Date | string | null;
  incident?: AssignmentIncident | null;
  attachments?: AssignmentAttachment[];
}

interface FSRAssignmentActivity {
  id: string;
  description: string;
  performedAt: Date | string;
}

interface AssignmentAttachment {
  id: string;
  filename: string;
  filepath: string;
  mimetype: string;
  size: number;
  uploadedAt: Date;
  description?: string | null;
  provider?: string | null;
}

export default function FSRAssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [assignment, setAssignment] = useState<FSRAssignment | null>(null);
  const [activities, setActivities] = useState<FSRAssignmentActivity[]>([]);
  const [items, setItems] = useState<
    Awaited<ReturnType<typeof getAssignmentItems>>
  >([]);
  const [attachments, setAttachments] = useState<AssignmentAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    params.then((p) => setAssignmentId(p.id));
  }, [params]);

  const fetchData = useCallback(async () => {
    if (!assignmentId) return;

    try {
      setLoading(true);
      setError(null);
      const [woData, activitiesData, partsData] = await Promise.all([
        getAssignmentById(assignmentId),
        getAssignmentActivities(assignmentId),
        getAssignmentItems(assignmentId),
      ]);

      setAssignment(woData);
      setActivities(activitiesData);
      setItems(partsData);
      setAttachments(woData?.attachments || []);
    } catch (error) {
      logger.error("Error fetching data:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Error al cargar la asignación",
      );
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    if (assignmentId) {
      fetchData();
    }
  }, [assignmentId, fetchData]);

  const handleDeleteActivity = async (id: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar esta actividad?"))
      return;

    try {
      const result = await deleteAssignmentActivity(id);

      if (isFailure(result)) {
        toast.error(result.error);
        return;
      }
      await fetchData();
    } catch (error) {
      logger.error("Error deleting activity:", error);
      toast.error("Error al eliminar la actividad");
    }
  };

  const handleDeleteAttachment = async (id: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este archivo?")) return;

    try {
      const result = await deleteAssignmentAttachment(id);

      if (isFailure(result)) {
        toast.error(result.error);
        return;
      }
      await fetchData();
    } catch (error) {
      logger.error("Error deleting attachment:", error);
      toast.error("Error al eliminar el archivo");
    }
  };

  const handleActivitySuccess = () => {
    setShowActivityForm(false);
    fetchData();
  };

  // ---------- State machine handlers ----------

  const captureGps = (): Promise<{
    latitude: number;
    longitude: number;
  }> =>
    new Promise((resolve, reject) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        reject(new Error("Geolocalización no disponible en este dispositivo"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }),
        (err) => {
          const messages: Record<number, string> = {
            1: "Permiso de ubicación denegado",
            2: "Ubicación no disponible",
            3: "Tiempo de espera agotado al obtener la ubicación",
          };
          reject(new Error(messages[err.code] ?? err.message));
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      );
    });

  const handleMarkSeen = async () => {
    if (!assignmentId) return;
    try {
      setActionLoading(true);
      const result = await markAssignmentSeen(assignmentId);

      if (isFailure(result)) {
        toast.error(result.error);
        return;
      }
      await fetchData();
    } catch (error) {
      logger.error("Error marking asignación as seen:", error);
      toast.error("Error al marcar como vista");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartWork = async () => {
    if (!assignmentId) return;
    // GPS is captured BEFORE any network use: without coordinates there is
    // no field evidence to freeze, so a GPS failure never creates a draft.
    let coords: { latitude: number; longitude: number };
    try {
      coords = await captureGps();
    } catch (error) {
      logger.error("Error capturing GPS:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo obtener la ubicación",
      );
      return;
    }
    // Fully offline: skip the call and freeze the draft directly.
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      queueStartDraft(coords.latitude, coords.longitude);
      return;
    }
    try {
      setActionLoading(true);
      const fd = new FormData();
      fd.append("assignmentId", assignmentId);
      fd.append("latitude", String(coords.latitude));
      fd.append("longitude", String(coords.longitude));
      const result = await startAssignmentWork(fd);

      if (isFailure(result)) {
        toast.error(result.error);
        return;
      }
      await fetchData();
    } catch (error) {
      // Transport failure (connection dropped mid-submit): freeze the
      // action-time evidence as a draft for retry. Business-rule failures
      // arrive as values above, never here.
      logger.error("Error starting asignación:", error);
      queueStartDraft(coords.latitude, coords.longitude);
    } finally {
      setActionLoading(false);
    }
  };

  const queueStartDraft = (latitude: number, longitude: number) => {
    if (!assignmentId) return;
    const queued = saveDraft({
      kind: "startAssignmentWork",
      fields: {
        assignmentId,
        latitude: String(latitude),
        longitude: String(longitude),
      },
    });
    if (!queued.queued) {
      toast.error(describeEnqueueFailure(queued.reason));
      return;
    }
    toast.success("Sin conexión. Inicio guardado como borrador.");
  };

  const handlePauseWork = async () => {
    if (!assignmentId) return;
    try {
      setActionLoading(true);
      const result = await pauseAssignment(assignmentId);
      if (isFailure(result)) {
        toast.error(result.error);
        return;
      }
      await fetchData();
    } catch (error) {
      logger.error("Error pausing asignación:", error);
      toast.error("Error al pausar la asignación");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResumeWork = async () => {
    if (!assignmentId) return;
    try {
      setActionLoading(true);
      const result = await resumeAssignment(assignmentId);
      if (isFailure(result)) {
        toast.error(result.error);
        return;
      }
      await fetchData();
    } catch (error) {
      logger.error("Error resuming asignación:", error);
      toast.error("Error al retomar el trabajo");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCloseWork = async () => {
    if (!assignmentId) return;
    if (
      !confirm(
        "¿Cerrar esta asignación? Se capturará tu ubicación actual. Asegúrate de haber capturado el folio ODT y subido al menos una evidencia.",
      )
    )
      return;
    let coords: { latitude: number; longitude: number };
    try {
      coords = await captureGps();
    } catch (error) {
      logger.error("Error capturing GPS:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo obtener la ubicación",
      );
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      queueCloseDraft(coords.latitude, coords.longitude);
      return;
    }
    try {
      setActionLoading(true);
      const fd = new FormData();
      fd.append("assignmentId", assignmentId);
      fd.append("latitude", String(coords.latitude));
      fd.append("longitude", String(coords.longitude));
      const result = await closeAssignment(fd);

      if (isFailure(result)) {
        toast.error(result.error);
        return;
      }
      await fetchData();
      toast.success("¡Asignación cerrada exitosamente!");
    } catch (error) {
      // Transport failure: freeze the close evidence as a draft. The server
      // re-validates preconditions (evidencia, ODT, estado) at flush time.
      logger.error("Error closing asignación:", error);
      queueCloseDraft(coords.latitude, coords.longitude);
    } finally {
      setActionLoading(false);
    }
  };

  const queueCloseDraft = (latitude: number, longitude: number) => {
    if (!assignmentId) return;
    const queued = saveDraft({
      kind: "closeAssignment",
      fields: {
        assignmentId,
        latitude: String(latitude),
        longitude: String(longitude),
      },
    });
    if (!queued.queued) {
      toast.error(describeEnqueueFailure(queued.reason));
      return;
    }
    toast.success("Sin conexión. Cierre guardado como borrador.");
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" text="Cargando asignación..." />
        </div>
      </PageContainer>
    );
  }

  if (error || !assignment) {
    return (
      <PageContainer>
        <PageHeader
          title="Asignación"
          breadcrumbs={[
            { label: "Mis Asignaciones", href: "/fsr/assignments" },
          ]}
        />
        <Card className="border-destructive">
          <CardContent className="py-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <AlertTriangle
                className="h-12 w-12 text-destructive"
                aria-hidden
              />
              <div>
                <h3 className="mb-2 text-lg font-semibold">
                  Error al Cargar la Asignación
                </h3>
                <p className="text-muted-foreground">
                  {error ||
                    "Asignación no encontrada o no tienes permiso para verla."}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button onClick={() => fetchData()} variant="outline">
                  Reintentar
                </Button>
                <Button asChild>
                  <Link href="/fsr/assignments">Volver a Órdenes</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  const currentStatus = assignment.status?.name ?? "";
  const isAssigned = currentStatus === "ASIGNADO";
  const isSeen = currentStatus === "VISTO";
  const isStarted = currentStatus === "INICIADO";
  const isInProgress = currentStatus === "EN_PROGRESO";
  const isClosed = currentStatus === "CERRADO";
  const incidentStatus = assignment.incident?.status?.name ?? "";
  const incidentLocked =
    incidentStatus === "CERRADO" || incidentStatus === "CANCELADA";
  // Activities and attachments are read-only once the assignment is closed or
  // the parent incident is in a terminal state.
  const isCompleted = isClosed || incidentLocked;
  const hasEvidence = (assignment.attachments?.length ?? 0) > 0;
  const hasOdt = Boolean(assignment.odtFolio?.trim());
  const closeDisabledReason =
    !hasOdt && !hasEvidence
      ? "Captura el folio ODT y sube al menos una evidencia antes de cerrar"
      : !hasOdt
        ? "Captura el folio ODT antes de cerrar"
        : !hasEvidence
          ? "Sube al menos una evidencia antes de cerrar"
          : undefined;
  const closeDisabled = actionLoading || !hasEvidence || !hasOdt;

  const jobActions = (
    <JobActions
      isAssigned={isAssigned}
      isSeen={isSeen}
      isStarted={isStarted}
      isInProgress={isInProgress}
      actionLoading={actionLoading}
      closeDisabled={closeDisabled}
      closeDisabledReason={closeDisabledReason}
      onMarkSeen={() => void handleMarkSeen()}
      onStartWork={() => void handleStartWork()}
      onPauseWork={() => void handlePauseWork()}
      onResumeWork={() => void handleResumeWork()}
      onCloseWork={() => void handleCloseWork()}
    />
  );

  return (
    <PageContainer>
      <PageHeader
        title="Asignación"
        description={assignment.incident?.title || "Sin incidente"}
        breadcrumbs={[
          { label: "Mis Asignaciones", href: "/fsr/assignments" },
          { label: `AS-${assignment.folio}` },
        ]}
        actions={<div className="hidden md:block">{jobActions}</div>}
      />

      <AssignmentHeader
        incidentTitle={assignment.incident?.title || "Sin incidente"}
        statusName={currentStatus}
        incidentLocked={incidentLocked}
        incidentStatus={incidentStatus}
        assignmentClosed={isClosed}
      />

      {assignmentId && (
        <PendingDrafts
          kinds={["startAssignmentWork", "closeAssignment"]}
          matchField={{ key: "assignmentId", value: assignmentId }}
          onFlushed={() => void fetchData()}
        />
      )}

      {incidentLocked && (
        <Card
          className={
            incidentStatus === "CANCELADA"
              ? "border-danger/50 bg-danger-muted"
              : "border-success/50 bg-success-muted"
          }
        >
          <CardContent className="flex items-center gap-3 py-3">
            <Lock className="h-5 w-5" aria-hidden />
            <p className="text-sm">
              {incidentStatus === "CANCELADA"
                ? "La incidencia padre está cancelada. No puedes hacer cambios en esta asignación."
                : "La incidencia padre está cerrada. No puedes hacer cambios en esta asignación."}
            </p>
          </CardContent>
        </Card>
      )}

      <Accordion
        type="multiple"
        defaultValue={["details", "odt", "activities", "items", "attachments"]}
        className="space-y-4"
      >
        <AccordionItem
          value="details"
          className="rounded-xl border px-4 last:border-b"
        >
          <AccordionTrigger className="text-base font-semibold hover:no-underline">
            Detalles de la asignación
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <AssignmentDetails
              folio={assignment.folio}
              statusName={currentStatus}
              createdAt={assignment.createdAt}
              seenAt={assignment.seenAt}
              seenByName={assignment.seenBy?.name}
              startedAt={assignment.startedAt}
              finishedAt={assignment.finishedAt}
              startLatitude={assignment.startLatitude}
              startLongitude={assignment.startLongitude}
              startAddress={assignment.startAddress}
              endLatitude={assignment.endLatitude}
              endLongitude={assignment.endLongitude}
              endAddress={assignment.endAddress}
              notes={assignment.notes}
              incidentTitle={assignment.incident?.title}
              incidentTypeName={assignment.incident?.type?.name}
              incidentStatusName={assignment.incident?.status?.name}
              incidentClientName={assignment.incident?.client?.name}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem
          value="odt"
          className="rounded-xl border px-4 last:border-b"
        >
          <AccordionTrigger className="text-base font-semibold hover:no-underline">
            Folio ODT
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            {assignmentId && (
              <OdtFolioCapture
                assignmentId={assignmentId}
                initialValue={assignment.odtFolio || null}
                disabled={isCompleted}
                onChange={(v) =>
                  setAssignment((prev) =>
                    prev ? { ...prev, odtFolio: v } : prev,
                  )
                }
              />
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem
          value="activities"
          className="rounded-xl border px-4 last:border-b"
        >
          <AccordionTrigger className="text-base font-semibold hover:no-underline">
            <span className="flex items-center gap-2">
              <Activity className="h-4 w-4" aria-hidden />
              Actividades ({activities.length})
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <ActivitiesSection
              activities={activities}
              showForm={showActivityForm}
              form={
                showActivityForm && assignmentId ? (
                  <AssignmentActivityForm
                    assignmentId={assignmentId}
                    onSuccess={handleActivitySuccess}
                    onCancel={() => setShowActivityForm(false)}
                  />
                ) : null
              }
              renderEditor={(activity) => (
                <AssignmentActivityEdit
                  activity={activity}
                  onSuccess={fetchData}
                  readOnly={isCompleted}
                />
              )}
              canEdit={!isCompleted}
              onToggleForm={() => setShowActivityForm(!showActivityForm)}
              onDeleteActivity={(id) => void handleDeleteActivity(id)}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem
          value="items"
          className="rounded-xl border px-4 last:border-b"
        >
          <AccordionTrigger className="text-base font-semibold hover:no-underline">
            <span className="flex items-center gap-2">
              <ScrollText className="h-4 w-4" aria-hidden />
              Refacciones y equipo ({items.length})
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            {/* Refacciones y equipo usados: lista abierta, sin catálogo detrás. */}
            {assignmentId && (
              <AssignmentItems
                assignmentId={assignmentId}
                items={items}
                onChange={fetchData}
              />
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem
          value="attachments"
          className="rounded-xl border px-4 last:border-b"
        >
          <AccordionTrigger className="text-base font-semibold hover:no-underline">
            <span className="flex items-center gap-2">
              <Paperclip className="h-4 w-4" aria-hidden />
              Adjuntos ({attachments.length})
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <AttachmentsSection
              attachments={attachments}
              renderPreview={(attachment) => (
                <AttachmentPreview
                  attachment={attachment}
                  onDelete={!isCompleted ? handleDeleteAttachment : undefined}
                  readOnly={isCompleted}
                />
              )}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {!incidentLocked && !isClosed && (
        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur md:hidden">
          {jobActions}
        </div>
      )}

      {/* Back Button */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => router.back()}>
          Volver a Órdenes
        </Button>
      </div>
    </PageContainer>
  );
}
