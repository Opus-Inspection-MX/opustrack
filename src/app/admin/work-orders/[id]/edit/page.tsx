"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Package, Activity, Paperclip, Trash2, AlertTriangle, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { WorkActivityForm } from "@/components/work-orders/work-activity-form";
import { WorkPartForm } from "@/components/work-orders/work-part-form";
import { WorkOrderEditForm } from "@/components/work-orders/work-order-edit-form";
import { WorkActivityEdit } from "@/components/work-orders/work-activity-edit";
import { WorkPartEdit } from "@/components/work-orders/work-part-edit";
import { getWorkOrderById, deleteWorkOrderAttachment, getWorkOrderFormOptions } from "@/lib/actions/work-orders";
import { getWorkActivities, deleteWorkActivity } from "@/lib/actions/work-activities";
import { getWorkParts, deleteWorkPart } from "@/lib/actions/work-parts";
import { getParts } from "@/lib/actions/parts";
import { formatFileSize, getFileIcon } from "@/lib/upload";

export default function EditWorkOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [workOrderId, setWorkOrderId] = useState<string | null>(null);
  const [workOrder, setWorkOrder] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [workParts, setWorkParts] = useState<any[]>([]);
  const [availableParts, setAvailableParts] = useState<any[]>([]);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [availableStatuses, setAvailableStatuses] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [showPartForm, setShowPartForm] = useState(false);

  useEffect(() => {
    params.then((p) => setWorkOrderId(p.id));
  }, [params]);

  useEffect(() => {
    if (workOrderId) {
      fetchData();
    }
  }, [workOrderId]);

  const fetchData = async () => {
    if (!workOrderId) return;

    try {
      setLoading(true);
      const { getIncidentStatuses } = await import("@/lib/actions/lookups");
      const [woData, activitiesData, partsData, availablePartsData, formOptions, statuses] =
        await Promise.all([
          getWorkOrderById(workOrderId),
          getWorkActivities(workOrderId),
          getWorkParts(workOrderId),
          getParts(),
          getWorkOrderFormOptions(),
          getIncidentStatuses(),
        ]);

      setWorkOrder(woData);
      setActivities(activitiesData);
      setWorkParts(partsData);
      setAvailableParts(availablePartsData);
      setAvailableUsers(formOptions.users);
      setAvailableStatuses(statuses);
      setAttachments(woData?.attachments || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteActivity = async (id: string) => {
    if (!confirm("Are you sure you want to delete this activity?")) return;

    try {
      await deleteWorkActivity(id);
      await fetchData();
    } catch (error) {
      console.error("Error deleting activity:", error);
      alert("Failed to delete activity");
    }
  };

  const handleDeletePart = async (id: string) => {
    if (!confirm("Are you sure you want to remove this part?")) return;

    try {
      await deleteWorkPart(id);
      await fetchData();
    } catch (error) {
      console.error("Error deleting part:", error);
      alert("Failed to remove part");
    }
  };

  const handleDeleteAttachment = async (id: string) => {
    if (!confirm("Are you sure you want to delete this file?")) return;

    try {
      await deleteWorkOrderAttachment(id);
      await fetchData();
    } catch (error) {
      console.error("Error deleting attachment:", error);
      alert("Failed to delete file");
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

  if (loading || !workOrder) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" text="Loading work order..." />
      </div>
    );
  }

  const totalPartsCost = workParts.reduce(
    (sum, wp) => sum + wp.price * wp.quantity,
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/work-orders">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Edit Work Order</h1>
          <p className="text-muted-foreground">
            {workOrder.incident?.title || "No incident"}
          </p>
        </div>
        <Badge
          variant={
            workOrder.status?.name === "COMPLETADO"
              ? "default"
              : workOrder.status?.name === "EN_PROGRESO"
                ? "secondary"
                : "outline"
          }
        >
          {workOrder.status?.name || "Sin estado"}
        </Badge>
      </div>

      {/* Parent Incident Link */}
      {workOrder.incident && (
        <Card className="bg-muted/30">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Parent Incident</p>
                <p className="font-medium">{workOrder.incident.title}</p>
                <p className="text-xs text-muted-foreground">
                  {workOrder.incident.type?.name && `Type: ${workOrder.incident.type.name} • `}
                  Priority: {workOrder.incident.priority}/10 • Status: {workOrder.incident.status?.name}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/incidents/${workOrder.incident.id}`}>
                <ExternalLink className="mr-2 h-4 w-4" />
                View Incident
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Work Order Edit Form */}
      <WorkOrderEditForm
        workOrder={workOrder}
        users={availableUsers}
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
              Work Activities ({activities.length})
            </h2>
            <p className="text-sm text-muted-foreground">
              Track all work performed on this order
            </p>
          </div>
          <Button
            onClick={() => setShowActivityForm(!showActivityForm)}
            variant={showActivityForm ? "outline" : "default"}
          >
            {showActivityForm ? "Cancel" : "Add Activity"}
          </Button>
        </div>

        {showActivityForm && (
          <WorkActivityForm
            workOrderId={workOrderId!}
            onSuccess={handleActivitySuccess}
            onCancel={() => setShowActivityForm(false)}
          />
        )}

        {activities.length === 0 && !showActivityForm && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No work activities yet. Click "Add Activity" to record work done.
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
              <WorkActivityEdit
                activity={activity}
                onSuccess={fetchData}
              />
            </CardHeader>
            {activity.workParts && activity.workParts.length > 0 && (
              <CardContent>
                <p className="text-sm font-medium mb-2">Parts Used:</p>
                <div className="space-y-1">
                  {activity.workParts.map((wp: any) => (
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
              Parts Used ({workParts.length})
            </h2>
            <p className="text-sm text-muted-foreground">
              Total Cost: ${totalPartsCost.toFixed(2)}
            </p>
          </div>
          <Button
            onClick={() => setShowPartForm(!showPartForm)}
            variant={showPartForm ? "outline" : "default"}
          >
            {showPartForm ? "Cancel" : "Add Part"}
          </Button>
        </div>

        {showPartForm && (
          <WorkPartForm
            workOrderId={workOrderId!}
            parts={availableParts}
            onSuccess={handlePartSuccess}
            onCancel={() => setShowPartForm(false)}
          />
        )}

        {workParts.length === 0 && !showPartForm && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No parts used yet. Click "Add Part" to record parts.
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
                      <WorkPartEdit
                        workPart={wp}
                        onSuccess={fetchData}
                      />
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
            Attachments ({attachments.length})
          </h2>
          <p className="text-sm text-muted-foreground">
            Photos, videos, and documents attached to this work order
          </p>
        </div>

        {attachments.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No attachments. Files are uploaded when adding work activities.
            </CardContent>
          </Card>
        )}

        {attachments.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {attachments.map((attachment: any) => (
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
                          {new Date(attachment.uploadedAt).toLocaleDateString()}
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
          Back to Work Orders
        </Button>
      </div>
    </div>
  );
}
