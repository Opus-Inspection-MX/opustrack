import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  Clock,
  FileText,
  Image as ImageIcon,
  Package,
  User,
  Wrench,
} from "lucide-react";
import NextImage from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getAssignmentById } from "@/lib/actions/assignments";
import { requireRouteAccess } from "@/lib/auth/auth";
import { getFileUrl } from "@/lib/storage/file-storage";

export default async function ClientAssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRouteAccess("/client");
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
            ? "bg-green-100 text-green-700"
            : isActive
              ? "bg-blue-100 text-blue-700 animate-pulse"
              : "bg-gray-100 text-gray-400"
        }`}
      >
        {date ? (
          <CheckCircle className="h-4 w-4" />
        ) : (
          <Clock className="h-4 w-4" />
        )}
      </div>
      <div>
        <p className="text-sm font-medium">{label}</p>
        {date && (
          <p className="text-xs text-muted-foreground">
            {new Date(date).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="sm">
          <Link
            href={
              assignment.incident
                ? `/client/incidents/${assignment.incident.id}`
                : "/client"
            }
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">
            Asignación AS-{assignment.folio}
          </h1>
        </div>
        {assignment.status && (
          <Badge variant="secondary" className="ml-auto text-sm">
            {assignment.status.name}
          </Badge>
        )}
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Progreso</CardTitle>
          <CardDescription>
            Seguimiento del estado de la asignación
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {getTimelineStep("Creada", assignment.createdAt, false)}
            {getTimelineStep(
              "Asignada",
              assignment.assignedAt,
              !assignment.assignedAt,
            )}
            {getTimelineStep(
              "Recibida por FSR",
              assignment.unlockedAt,
              !!assignment.assignedAt && !assignment.unlockedAt,
            )}
            {getTimelineStep(
              "Trabajo iniciado",
              assignment.startedAt,
              !!assignment.unlockedAt && !assignment.startedAt,
            )}
            {getTimelineStep(
              "Completada",
              assignment.finishedAt,
              !!assignment.startedAt && !assignment.finishedAt,
            )}
          </div>
        </CardContent>
      </Card>

      {/* Assigned FSR */}
      {assignment.assignedTo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Tecnico Asignado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">{assignment.assignedTo.name}</p>
                <p className="text-sm text-muted-foreground">
                  {assignment.assignedTo.email}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Work Activities */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Actividades Realizadas (
            {assignment.assignmentActivities?.length || 0})
          </CardTitle>
          <CardDescription>Trabajo documentado por el tecnico</CardDescription>
        </CardHeader>
        <CardContent>
          {!assignment.assignmentActivities ||
          assignment.assignmentActivities.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              Aun no se han registrado actividades
            </p>
          ) : (
            <div className="space-y-4">
              {assignment.assignmentActivities.map((activity) => (
                <div key={activity.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p>{activity.description}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {new Date(activity.performedAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Parts Used */}
      {assignment.workParts && assignment.workParts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Partes Utilizadas ({assignment.workParts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {assignment.workParts.map((wp) => (
                <div
                  key={wp.id}
                  className="flex items-center justify-between border rounded-lg p-3"
                >
                  <div>
                    <p className="font-medium">{wp.part?.name || "Parte"}</p>
                    {wp.description && (
                      <p className="text-sm text-muted-foreground">
                        {wp.description}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-medium">x{wp.quantity}</p>
                    {wp.price && (
                      <p className="text-sm text-muted-foreground">
                        ${Number(wp.price).toFixed(2)} c/u
                      </p>
                    )}
                  </div>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between font-medium">
                <span>Total</span>
                <span>
                  $
                  {assignment.workParts
                    .reduce(
                      (sum, wp) => sum + Number(wp.price || 0) * wp.quantity,
                      0,
                    )
                    .toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attachments */}
      {assignment.attachments && assignment.attachments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Evidencia ({assignment.attachments.length})
            </CardTitle>
            <CardDescription>
              Fotos y documentos del trabajo realizado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
                      <FileText className="h-12 w-12 text-muted-foreground" />
                    )}
                    <p className="text-xs text-muted-foreground truncate w-full text-center">
                      {attachment.filename}
                    </p>
                  </a>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {assignment.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{assignment.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
