"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, AlertTriangle, Calendar, User, Building, FileText, Plus, Edit as EditIcon, Wrench } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getIncidentById } from "@/lib/actions/incidents";

export default function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [incidentId, setIncidentId] = useState<number | null>(null);
  const [incident, setIncident] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then((p) => setIncidentId(parseInt(p.id)));
  }, [params]);

  useEffect(() => {
    if (incidentId) {
      fetchIncident();
    }
  }, [incidentId]);

  const fetchIncident = async () => {
    if (!incidentId) return;

    try {
      setLoading(true);
      const data = await getIncidentById(incidentId);
      setIncident(data);
    } catch (error) {
      console.error("Error fetching incident:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !incident) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" text="Loading incident..." />
      </div>
    );
  }

  const getPriorityColor = (priority: number) => {
    if (priority >= 8) return "destructive";
    if (priority >= 5) return "default";
    return "secondary";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETADO":
        return "default";
      case "EN_PROGRESO":
        return "secondary";
      case "PENDIENTE":
        return "outline";
      default:
        return "outline";
    }
  };

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
          <p className="text-muted-foreground">Incident #{incident.id}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/admin/incidents/${incident.id}/edit`}>
              <EditIcon className="mr-2 h-4 w-4" />
              Edit Incident
            </Link>
          </Button>
          <Badge variant={getPriorityColor(incident.priority)} className="h-9 px-3">
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
                <p className="font-medium">{incident.sla} hours</p>
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
        </CardContent>
      </Card>

      <Separator />

      {/* Work Orders Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Wrench className="h-6 w-6" />
              Work Orders ({incident.workOrders?.length || 0})
            </h2>
            <p className="text-sm text-muted-foreground">
              All work orders assigned to this incident
            </p>
          </div>
          <Button asChild>
            <Link href={`/admin/work-orders/new?incidentId=${incident.id}`}>
              <Plus className="mr-2 h-4 w-4" />
              Create Work Order
            </Link>
          </Button>
        </div>

        {!incident.workOrders || incident.workOrders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Wrench className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No Work Orders Yet</p>
              <p className="text-sm mb-4">
                Create a work order to start tracking work on this incident
              </p>
              <Button asChild variant="outline">
                <Link href={`/admin/work-orders/new?incidentId=${incident.id}`}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Work Order
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
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Activities</TableHead>
                    <TableHead>Parts</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Finished</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incident.workOrders.map((wo: any) => (
                    <TableRow key={wo.id}>
                      <TableCell>
                        <Badge variant={getStatusColor(wo.status)}>
                          {wo.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{wo.assignedTo.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {wo.assignedTo.email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {wo._count?.workActivities || 0}
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
                            <Link href={`/admin/work-orders/${wo.id}`}>
                              View
                            </Link>
                          </Button>
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/admin/work-orders/${wo.id}/edit`}>
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

      {/* Notes Section */}
      {incident.workOrders && incident.workOrders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Work Order Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {incident.workOrders
                .filter((wo: any) => wo.notes)
                .map((wo: any) => (
                  <div
                    key={wo.id}
                    className="p-4 border rounded-lg bg-muted/30"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium">
                        Work Order by {wo.assignedTo.name}
                      </p>
                      <Badge variant="outline">{wo.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{wo.notes}</p>
                  </div>
                ))}
              {incident.workOrders.filter((wo: any) => wo.notes).length ===
                0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No notes in work orders yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
