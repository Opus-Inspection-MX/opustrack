"use client";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  Lock,
  Package,
  Paperclip,
  Play,
  Trash2,
  Unlock,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AssignmentActivityEdit } from "@/components/assignments/assignment-activity-edit";
import { AssignmentActivityForm } from "@/components/assignments/assignment-activity-form";
import { AttachmentPreview } from "@/components/assignments/attachment-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
  deleteAssignmentActivity,
  getAssignmentActivities,
} from "@/lib/actions/assignment-activities";
import {
  completeAssignment,
  deleteAssignmentAttachment,
  getAssignmentById,
  reopenAssignment,
  startAssignment,
  unlockAssignment,
} from "@/lib/actions/assignments";
import { getWorkParts } from "@/lib/actions/work-parts";

interface AssignmentStatus {
  id: number;
  name: string;
  color?: string | null;
}

interface VIC {
  id: string;
  name: string;
  code: string;
}

interface AssignmentIncident {
  id: number;
  title: string;
  priority: number;
  status?: AssignmentStatus | null;
  type?: { name: string } | null;
  vic?: VIC | null;
}

interface FSRAssignment {
  id: string;
  folio: number;
  notes?: string | null;
  status?: AssignmentStatus | null;
  startedAt?: Date | string | null;
  finishedAt?: Date | string | null;
  unlockedAt?: Date | string | null;
  assignedAt?: Date | string | null;
  createdAt?: Date | string | null;
  incident?: AssignmentIncident | null;
  attachments?: AssignmentAttachment[];
}

interface AssignmentActivityPart {
  id: string;
  partId: string;
  quantity: number;
  price?: number | null;
  part?: { name: string } | null;
}

interface FSRAssignmentActivity {
  id: string;
  description: string;
  performedAt: Date | string;
  workParts?: AssignmentActivityPart[];
}

interface FSRWorkPart {
  id: string;
  partId: string;
  quantity: number;
  price?: number | null;
  part?: { name: string } | null;
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
  const [workParts, setWorkParts] = useState<FSRWorkPart[]>([]);
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
        getWorkParts(assignmentId),
      ]);

      setAssignment(woData);
      setActivities(activitiesData);
      setWorkParts(partsData);
      setAttachments(woData?.attachments || []);
    } catch (error) {
      console.error("Error fetching data:", error);
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
      await deleteAssignmentActivity(id);
      await fetchData();
    } catch (error) {
      console.error("Error deleting activity:", error);
      alert("Error al eliminar la actividad");
    }
  };

  const handleDeleteAttachment = async (id: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este archivo?")) return;

    try {
      await deleteAssignmentAttachment(id);
      await fetchData();
    } catch (error) {
      console.error("Error deleting attachment:", error);
      alert("Error al eliminar el archivo");
    }
  };

  const handleActivitySuccess = () => {
    setShowActivityForm(false);
    fetchData();
  };

  const handleStartWork = async () => {
    if (!assignmentId) return;

    try {
      setActionLoading(true);
      await startAssignment(assignmentId);
      await fetchData();
    } catch (error) {
      console.error("Error starting asignación:", error);
      alert("Error al iniciar la asignación");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteWork = async () => {
    if (!assignmentId) return;
    if (
      !confirm("¿Estás seguro de que deseas marcar esta orden como completada?")
    )
      return;

    try {
      setActionLoading(true);
      await completeAssignment(assignmentId);
      await fetchData();
      alert("¡Asignación completada exitosamente!");
    } catch (error) {
      console.error("Error completing asignación:", error);
      alert("Error al completar la asignación");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReopenWork = async () => {
    if (!assignmentId) return;
    if (!confirm("¿Estás seguro de que deseas reabrir esta asignación?"))
      return;

    try {
      setActionLoading(true);
      await reopenAssignment(assignmentId);
      await fetchData();
      alert("¡Asignación reabierta exitosamente!");
    } catch (error) {
      console.error("Error reopening asignación:", error);
      alert("Error al reabrir la asignación");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnlock = async () => {
    if (!assignmentId) return;

    try {
      setActionLoading(true);
      await unlockAssignment(assignmentId);
      await fetchData();
    } catch (error) {
      console.error("Error unlocking asignación:", error);
      alert("Error al desbloquear la asignación");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" text="Cargando asignación..." />
      </div>
    );
  }

  if (error || !assignment) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/fsr/assignments">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">Asignación</h1>
        </div>
        <Card className="border-destructive">
          <CardContent className="py-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <AlertTriangle className="h-12 w-12 text-destructive" />
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  Error al Cargar la Asignación
                </h3>
                <p className="text-muted-foreground">
                  {error ||
                    "Asignación no encontrada o no tienes permiso para verla."}
                </p>
              </div>
              <div className="flex gap-2">
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
      </div>
    );
  }

  const totalPartsCost = workParts.reduce(
    (sum, wp) => sum + (wp.price ?? 0) * wp.quantity,
    0,
  );

  const canComplete = activities.length > 0 && !assignment.finishedAt;
  const isCompleted = !!assignment.finishedAt;
  const isStarted = !!assignment.startedAt;
  const isUnlocked = !!assignment.unlockedAt;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/fsr/assignments">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Asignación</h1>
          <p className="text-muted-foreground">
            {assignment.incident?.title || "Sin incidente"}
          </p>
        </div>
        <div className="flex gap-2">
          {/* Unlock Button - Shows when not unlocked */}
          {!isUnlocked && !isCompleted && (
            <Button
              onClick={handleUnlock}
              disabled={actionLoading}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              <Unlock className="mr-2 h-4 w-4" />
              Desbloquear / Confirmar
            </Button>
          )}
          {/* Start Work Button - Shows after unlock, before start */}
          {isUnlocked && !isStarted && !isCompleted && (
            <Button
              onClick={handleStartWork}
              disabled={actionLoading}
              variant="secondary"
            >
              <Play className="mr-2 h-4 w-4" />
              Iniciar Trabajo
            </Button>
          )}
          {/* Complete Button - Shows after start */}
          {isStarted && canComplete && (
            <Button
              onClick={handleCompleteWork}
              disabled={actionLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Completar Orden
            </Button>
          )}
          {/* Completed state */}
          {isCompleted && (
            <>
              <Badge
                variant="default"
                className="bg-green-600 text-lg py-2 px-4"
              >
                Completada
              </Badge>
              <Button
                onClick={handleReopenWork}
                disabled={actionLoading}
                variant="outline"
              >
                Reabrir
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Parent Incident Info */}
      {assignment.incident && (
        <Card className="bg-muted/30">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">
                  Incidente Relacionado
                </p>
                <p className="font-medium">{assignment.incident.title}</p>
                <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                  {assignment.incident.type?.name && (
                    <span>Tipo: {assignment.incident.type.name}</span>
                  )}
                  <span>Prioridad: {assignment.incident.priority}/10</span>
                  {assignment.incident.status?.name && (
                    <span>Estado: {assignment.incident.status.name}</span>
                  )}
                  {assignment.incident.vic?.name && (
                    <span>VIC: {assignment.incident.vic.name}</span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assignment Details */}
      <Card>
        <CardHeader>
          <CardTitle>Detalles de la Orden</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <span className="font-medium">Estado:</span>{" "}
            <Badge
              variant="outline"
              style={{
                backgroundColor: assignment.status?.color
                  ? `${assignment.status.color}20`
                  : undefined,
                borderColor: assignment.status?.color || undefined,
                color: assignment.status?.color || undefined,
              }}
            >
              {assignment.status?.name || "N/A"}
            </Badge>
          </div>
          <div>
            <span className="font-medium">Folio:</span> AS-{assignment.folio}
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            {assignment.createdAt && (
              <div>
                <span className="font-medium">Creada:</span>{" "}
                {new Date(assignment.createdAt).toLocaleString()}
              </div>
            )}
            {assignment.unlockedAt ? (
              <div>
                <span className="font-medium">Desbloqueada:</span>{" "}
                {new Date(assignment.unlockedAt).toLocaleString()}
              </div>
            ) : (
              <div className="flex items-center gap-1 text-yellow-600">
                <Lock className="h-3 w-3" />
                <span className="font-medium">No Desbloqueada</span>
              </div>
            )}
            {assignment.startedAt && (
              <div>
                <span className="font-medium">Iniciada:</span>{" "}
                {new Date(assignment.startedAt).toLocaleString()}
              </div>
            )}
            {assignment.finishedAt && (
              <div>
                <span className="font-medium">Completada:</span>{" "}
                {new Date(assignment.finishedAt).toLocaleString()}
              </div>
            )}
          </div>
          {assignment.notes && (
            <div>
              <p className="font-medium text-sm mb-1">Notas:</p>
              <p className="text-sm text-muted-foreground">
                {assignment.notes}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Work Activities Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="h-6 w-6" />
              Actividades de Trabajo ({activities.length})
            </h2>
            <p className="text-sm text-muted-foreground">
              Documenta todo el trabajo realizado en esta orden
            </p>
          </div>
          {!isCompleted && (
            <Button
              onClick={() => setShowActivityForm(!showActivityForm)}
              variant={showActivityForm ? "outline" : "default"}
            >
              {showActivityForm ? "Cancelar" : "Agregar Actividad"}
            </Button>
          )}
        </div>

        {showActivityForm && assignmentId && (
          <AssignmentActivityForm
            assignmentId={assignmentId}
            onSuccess={handleActivitySuccess}
            onCancel={() => setShowActivityForm(false)}
          />
        )}

        {activities.length === 0 && !showActivityForm && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Sin actividades aún. Haz clic en "Agregar Actividad" para
              registrar el trabajo.
            </CardContent>
          </Card>
        )}

        {activities.map((activity) => (
          <Card key={activity.id}>
            <CardHeader>
              <div className="flex items-end justify-end gap-2">
                {!isCompleted && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteActivity(activity.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <AssignmentActivityEdit
                activity={activity}
                onSuccess={fetchData}
                readOnly={isCompleted}
              />
            </CardHeader>
            {activity.workParts && activity.workParts.length > 0 && (
              <CardContent>
                <p className="text-sm font-medium mb-2">Refacciones Usadas:</p>
                <div className="space-y-1">
                  {activity.workParts.map((wp: AssignmentActivityPart) => (
                    <div
                      key={wp.id}
                      className="text-sm flex justify-between items-center p-2 bg-muted rounded"
                    >
                      <span>
                        {wp.part?.name} x {wp.quantity}
                      </span>
                      <span className="font-medium">
                        ${((wp.price ?? 0) * wp.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      <Separator />

      {/* Parts Summary */}
      {workParts.length > 0 && (
        <>
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Package className="h-6 w-6" />
                Refacciones Usadas ({workParts.length})
              </h2>
              <p className="text-sm text-muted-foreground">
                Costo Total: ${totalPartsCost.toFixed(2)}
              </p>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {workParts.map((wp) => (
                    <div
                      key={wp.id}
                      className="p-4 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium">{wp.part?.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Cantidad: {wp.quantity} × $
                          {(wp.price ?? 0).toFixed(2)}
                        </p>
                      </div>
                      <p className="font-bold">
                        ${((wp.price ?? 0) * wp.quantity).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Separator />
        </>
      )}

      {/* Attachments Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Paperclip className="h-6 w-6" />
            Archivos Adjuntos ({attachments.length})
          </h2>
          <p className="text-sm text-muted-foreground">
            Fotos, videos y documentos adjuntos a esta orden
          </p>
        </div>

        {attachments.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Sin archivos adjuntos. Los archivos se suben al agregar
              actividades.
            </CardContent>
          </Card>
        )}

        {attachments.length > 0 && (
          <div className="grid grid-cols-1 gap-3">
            {attachments.map((attachment: AssignmentAttachment) => (
              <Card key={attachment.id}>
                <CardContent className="p-0">
                  <AttachmentPreview
                    attachment={attachment}
                    onDelete={!isCompleted ? handleDeleteAttachment : undefined}
                    readOnly={isCompleted}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Back Button */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => router.back()}>
          Volver a Órdenes
        </Button>
      </div>
    </div>
  );
}
