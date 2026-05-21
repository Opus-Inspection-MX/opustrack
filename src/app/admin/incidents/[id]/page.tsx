import {
  AlertTriangle,
  ArrowLeft,
  Building,
  Calendar,
  Edit as EditIcon,
  FileText,
  Plus,
  User,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getIncidentById } from "@/lib/actions/incidents";
import { requireRouteAccess } from "@/lib/auth/auth";

function getPriorityColor(priority: number) {
  if (priority >= 8) return "destructive";
  if (priority >= 5) return "default";
  return "secondary";
}

function getStatusColor(status: string) {
  switch (status) {
    case "CERRADO":
      return "default";
    case "INICIADO":
      return "secondary";
    case "VISTO":
    case "ASIGNADO":
      return "outline";
    default:
      return "outline";
  }
}

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRouteAccess("/admin/incidents");

  const { id } = await params;
  const incident = await getIncidentById(Number.parseInt(id, 10));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/incidents">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{incident.title}</h1>
            {incident.priority >= 8 && (
              <AlertTriangle className="h-6 w-6 text-destructive" />
            )}
          </div>
          <p className="text-muted-foreground">Folio: INC-{incident.id}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/admin/incidents/${incident.id}/edit`}>
              <EditIcon className="mr-2 h-4 w-4" />
              Edit Incident
            </Link>
          </Button>
          <Badge
            variant={getPriorityColor(incident.priority)}
            className="h-9 px-3"
          >
            Priority: {incident.priority}/10
          </Badge>
          <Badge variant="secondary" className="h-9 px-3">
            {incident.status?.name || "No Status"}
          </Badge>
        </div>
      </div>

      {/* Incident Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>Incident Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Description */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">Description</p>
            <p className="text-base">{incident.description}</p>
          </div>

          <Separator />

          {/* Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Type</p>
                <p className="font-medium">
                  {incident.type?.name || "No Type"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Priority</p>
                <p className="font-medium">{incident.priority}/10</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">SLA</p>
                <p className="font-medium">
                  {incident.type?.sla != null
                    ? `${incident.type.sla} hours`
                    : "Sin SLA"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Building className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">VIC</p>
                <p className="font-medium">
                  {incident.vic
                    ? `${incident.vic.name} (${incident.vic.code})`
                    : "Not Assigned"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Reported By</p>
                <p className="font-medium">
                  {incident.reportedBy?.name || "Unknown"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Reported At</p>
                <p className="font-medium">
                  {new Date(incident.reportedAt).toLocaleString()}
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
                    {new Date(incident.startedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            {incident.resolvedAt && (
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Resolved At</p>
                  <p className="font-medium">
                    {new Date(incident.resolvedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </div>

          {incident.schedule && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-2">Schedule</p>
                <p className="font-medium">{incident.schedule.title}</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(incident.schedule.scheduledAt).toLocaleString()}
                </p>
              </div>
            </>
          )}

          <Separator />
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
        </CardContent>
      </Card>

      <Separator />

      {/* Assignments Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Wrench className="h-6 w-6" />
              Assignments ({incident.assignments?.length || 0})
            </h2>
            <p className="text-sm text-muted-foreground">
              All asignacións assigned to this incident
            </p>
          </div>
          <Button asChild>
            <Link href={`/admin/assignments/new?incidentId=${incident.id}`}>
              <Plus className="mr-2 h-4 w-4" />
              Create Assignment
            </Link>
          </Button>
        </div>

        {!incident.assignments || incident.assignments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Wrench className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No Assignments Yet</p>
              <p className="text-sm mb-4">
                Create a asignación to start tracking work on this incident
              </p>
              <Button asChild variant="outline">
                <Link href={`/admin/assignments/new?incidentId=${incident.id}`}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Assignment
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estado</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Activities</TableHead>
                    <TableHead>Parts</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Finished</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incident.assignments?.map((wo) => (
                    <TableRow key={wo.id}>
                      <TableCell>
                        <Badge variant={getStatusColor(wo.status?.name || "")}>
                          {wo.status?.name || "No status"}
                        </Badge>
                      </TableCell>
                      <TableCell>
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
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {wo._count?.assignmentActivities || 0}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {wo._count?.workParts || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(wo.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {wo.finishedAt
                          ? new Date(wo.finishedAt).toLocaleDateString()
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/admin/assignments/${wo.id}`}>
                              View
                            </Link>
                          </Button>
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/admin/assignments/${wo.id}/edit`}>
                              <EditIcon className="mr-2 h-4 w-4" />
                              Edit
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
