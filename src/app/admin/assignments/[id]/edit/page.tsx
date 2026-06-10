"use client";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  Package,
  Paperclip,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AssignmentActivityEdit } from "@/components/assignments/assignment-activity-edit";
import { AssignmentActivityForm } from "@/components/assignments/assignment-activity-form";
import { AssignmentEditForm } from "@/components/assignments/assignment-edit-form";
import { WorkPartEdit } from "@/components/assignments/work-part-edit";
import { WorkPartForm } from "@/components/assignments/work-part-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
  deleteAssignmentActivity,
  getAssignmentActivities,
} from "@/lib/actions/assignment-activities";
import {
  deleteAssignmentAttachment,
  getAssignmentById,
  getAssignmentFormOptions,
} from "@/lib/actions/assignments";
import { getParts } from "@/lib/actions/parts";
import { deleteWorkPart, getWorkParts } from "@/lib/actions/work-parts";
import { formatFileSize, getFileIcon } from "@/lib/upload";

interface AssignmentStatus {
  id: number;
  name: string;
}

interface IncidentType {
  id: number;
  name: string;
}

interface AssignmentIncident {
  id: number;
  title: string;
  clienteId?: string | null;
  type?: IncidentType | null;
  status?: AssignmentStatus | null;
}

interface Assignment {
  id: string;
  statusId: number | null;
  status?: AssignmentStatus | null;
  assignees: Array<{ user: { id: string; name: string } }>;
  notes: string | null;
  folio: number;
  odtFolio: string | null;
  finishedAt: Date | null;
  incident?: AssignmentIncident | null;
  attachments?: Attachment[];
}

interface AssignmentActivity {
  id: string;
  description: string;
  performedAt: Date;
  workParts?: WorkPart[];
}

interface Part {
  id: string;
  name: string;
  price: number;
  stock: number;
}

interface WorkPart {
  id: string;
  partId: string;
  quantity: number;
  price: number;
  description: string | null;
  part: { id: string; name: string; stock: number };
}

interface Attachment {
  id: string;
  filename: string;
  filepath: string;
  mimetype: string;
  size: number;
  uploadedAt: Date | string;
  description?: string | null;
}

interface User {
  id: string;
  name: string;
  email: string;
  clienteIds?: string[];
}

export default function EditAssignmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [activities, setActivities] = useState<AssignmentActivity[]>([]);
  const [workParts, setWorkParts] = useState<WorkPart[]>([]);
  const [availableParts, setAvailableParts] = useState<Part[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [availableIncidents, setAvailableIncidents] = useState<
    Array<{ id: number; assigneeIds: string[] }>
  >([]);
  const [availableStatuses, setAvailableStatuses] = useState<
    AssignmentStatus[]
  >([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [showPartForm, setShowPartForm] = useState(false);

  useEffect(() => {
    params.then((p) => setAssignmentId(p.id));
  }, [params]);

  const fetchData = useCallback(async () => {
    if (!assignmentId) return;

    try {
      setLoading(true);
      const { getAssignmentStatuses } = await import("@/lib/actions/lookups");
      const [
        woData,
        activitiesData,
        partsData,
        availablePartsData,
        formOptions,
        statuses,
      ] = await Promise.all([
        getAssignmentById(assignmentId),
        getAssignmentActivities(assignmentId),
        getWorkParts(assignmentId),
        getParts(),
        getAssignmentFormOptions(),
        getAssignmentStatuses(),
      ]);

      setAssignment(woData);
      setActivities(activitiesData);
      setWorkParts(partsData);
      setAvailableParts(availablePartsData);
      setAvailableUsers(formOptions.users);
      setAvailableIncidents(
        formOptions.incidents.map((i) => ({
          id: i.id,
          assigneeIds: i.assigneeIds,
        })),
      );
      setAvailableStatuses(statuses.data);
      setAttachments(woData?.attachments || []);
    } catch (error) {
      console.error("Error fetching data:", error);
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

  const handleDeletePart = async (id: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar esta refacción?"))
      return;

    try {
      await deleteWorkPart(id);
      await fetchData();
    } catch (error) {
      console.error("Error deleting part:", error);
      alert("Error al eliminar la refacción");
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

  const handlePartSuccess = () => {
    setShowPartForm(false);
    fetchData();
  };

  if (loading || !assignment) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" text="Cargando asignación..." />
      </div>
    );
  }

  const totalPartsCost = workParts.reduce(
    (sum, wp) => sum + wp.price * wp.quantity,
    0,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/assignments">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Editar Asignación</h1>
          <p className="text-muted-foreground">
            {assignment.incident?.title || "Sin incidente"}
          </p>
        </div>
        <Badge
          variant={
            assignment.status?.name === "CERRADO"
              ? "default"
              : assignment.status?.name === "INICIADO"
                ? "secondary"
                : "outline"
          }
        >
          {assignment.status?.name || "Sin estado"}
        </Badge>
      </div>

      {/* Parent Incident Link */}
      {assignment.incident && (
        <Card className="bg-muted/30">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Incidente Padre</p>
                <p className="font-medium">{assignment.incident.title}</p>
                <p className="text-xs text-muted-foreground">
                  {assignment.incident.type?.name &&
                    `Tipo: ${assignment.incident.type.name} • `}
                  Estado: {assignment.incident.status?.name}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/incidents/${assignment.incident.id}`}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Ver Incidente
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Assignment Edit Form */}
      <AssignmentEditForm
        assignment={assignment}
        users={(() => {
          const authorized =
            availableIncidents.find((i) => i.id === assignment.incident?.id)
              ?.assigneeIds ?? [];
          return availableUsers.filter((u) => authorized.includes(u.id));
        })()}
        statuses={availableStatuses}
        onSuccess={fetchData}
      />

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
              Registro de todo el trabajo realizado en esta orden
            </p>
          </div>
          <Button
            onClick={() => setShowActivityForm(!showActivityForm)}
            variant={showActivityForm ? "outline" : "default"}
          >
            {showActivityForm ? "Cancelar" : "Agregar Actividad"}
          </Button>
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteActivity(activity.id)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <AssignmentActivityEdit
                activity={activity}
                onSuccess={fetchData}
              />
            </CardHeader>
            {activity.workParts && activity.workParts.length > 0 && (
              <CardContent>
                <p className="text-sm font-medium mb-2">Refacciones Usadas:</p>
                <div className="space-y-1">
                  {activity.workParts.map((wp: WorkPart) => (
                    <div
                      key={wp.id}
                      className="text-sm flex justify-between items-center p-2 bg-muted rounded"
                    >
                      <span>
                        {wp.part?.name} x {wp.quantity}
                      </span>
                      <span className="font-medium">
                        ${(wp.price * wp.quantity).toFixed(2)}
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

      {/* Work Parts Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Package className="h-6 w-6" />
              Refacciones Usadas ({workParts.length})
            </h2>
            <p className="text-sm text-muted-foreground">
              Costo Total: ${totalPartsCost.toFixed(2)}
            </p>
          </div>
          <Button
            onClick={() => setShowPartForm(!showPartForm)}
            variant={showPartForm ? "outline" : "default"}
          >
            {showPartForm ? "Cancelar" : "Agregar Refacción"}
          </Button>
        </div>

        {showPartForm && assignmentId && (
          <WorkPartForm
            assignmentId={assignmentId}
            parts={availableParts}
            onSuccess={handlePartSuccess}
            onCancel={() => setShowPartForm(false)}
          />
        )}

        {workParts.length === 0 && !showPartForm && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Sin refacciones aún. Haz clic en "Agregar Refacción" para
              registrar.
            </CardContent>
          </Card>
        )}

        {workParts.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {workParts.map((wp) => (
                  <div key={wp.id} className="flex items-center">
                    <div className="flex-1">
                      <WorkPartEdit workPart={wp} onSuccess={fetchData} />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeletePart(wp.id)}
                      className="text-destructive mr-4"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Separator />

      {/* Attachments Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Paperclip className="h-6 w-6" />
            Archivos Adjuntos ({attachments.length})
          </h2>
          <p className="text-sm text-muted-foreground">
            Fotos, videos y documentos adjuntos a esta asignación
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
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {attachments.map((attachment: Attachment) => (
                  <div
                    key={attachment.id}
                    className="p-4 flex items-center justify-between hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-2xl">
                        {getFileIcon(attachment.mimetype)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <a
                          href={attachment.filepath}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium hover:underline truncate block"
                        >
                          {attachment.filename}
                        </a>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(attachment.size)} •{" "}
                          {new Date(attachment.uploadedAt).toLocaleDateString(
                            "es-MX",
                          )}
                        </p>
                        {attachment.description && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {attachment.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteAttachment(attachment.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
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
