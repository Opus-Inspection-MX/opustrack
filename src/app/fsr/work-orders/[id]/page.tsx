"use client";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  Package,
  Paperclip,
  Play,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { AttachmentPreview } from "@/components/work-orders/attachment-preview";
import { WorkActivityEdit } from "@/components/work-orders/work-activity-edit";
import { WorkActivityForm } from "@/components/work-orders/work-activity-form";
import {
  deleteWorkActivity,
  getWorkActivities,
} from "@/lib/actions/work-activities";
import {
  completeWorkOrder,
  deleteWorkOrderAttachment,
  getWorkOrderById,
  reopenWorkOrder,
  startWorkOrder,
} from "@/lib/actions/work-orders";
import { getWorkParts } from "@/lib/actions/work-parts";

interface WorkOrderStatus {
  id: number;
  name: string;
}

interface WorkOrderIncident {
  id: number;
  title: string;
  priority: number;
  status?: WorkOrderStatus | null;
  type?: { name: string } | null;
}

interface FSRWorkOrder {
  id: string;
  status?: WorkOrderStatus | null;
  startedAt?: Date | string | null;
  finishedAt?: Date | string | null;
  incident?: WorkOrderIncident | null;
  attachments?: WorkOrderAttachment[];
}

interface WorkActivityPart {
  id: string;
  partId: string;
  quantity: number;
  price?: number | null;
  part?: { name: string } | null;
}

interface FSRWorkActivity {
  id: string;
  description: string;
  performedAt: Date | string;
  workParts?: WorkActivityPart[];
}

interface FSRWorkPart {
  id: string;
  partId: string;
  quantity: number;
  price?: number | null;
  part?: { name: string } | null;
}

interface WorkOrderAttachment {
  id: string;
  filename: string;
  filepath: string;
  mimetype: string;
  size: number;
  uploadedAt: Date | string;
  description?: string | null;
}

export default function FSRWorkOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [workOrderId, setWorkOrderId] = useState<string | null>(null);
  const [workOrder, setWorkOrder] = useState<FSRWorkOrder | null>(null);
  const [activities, setActivities] = useState<FSRWorkActivity[]>([]);
  const [workParts, setWorkParts] = useState<FSRWorkPart[]>([]);
  const [attachments, setAttachments] = useState<WorkOrderAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    params.then((p) => setWorkOrderId(p.id));
  }, [params]);

  const fetchData = useCallback(async () => {
    if (!workOrderId) return;

    try {
      setLoading(true);
      setError(null);
      const [woData, activitiesData, partsData] = await Promise.all([
        getWorkOrderById(workOrderId),
        getWorkActivities(workOrderId),
        getWorkParts(workOrderId),
      ]);

      setWorkOrder(woData);
      setActivities(activitiesData);
      setWorkParts(partsData);
      setAttachments(woData?.attachments || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      setError(
        error instanceof Error ? error.message : "Failed to load work order",
      );
    } finally {
      setLoading(false);
    }
  }, [workOrderId]);

  useEffect(() => {
    if (workOrderId) {
      fetchData();
    }
  }, [workOrderId, fetchData]);

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

  const handleStartWork = async () => {
    if (!workOrderId) return;

    try {
      setActionLoading(true);
      await startWorkOrder(workOrderId);
      await fetchData();
    } catch (error) {
      console.error("Error starting work order:", error);
      alert("Failed to start work order");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteWork = async () => {
    if (!workOrderId) return;
    if (!confirm("Are you sure you want to mark this work order as complete?"))
      return;

    try {
      setActionLoading(true);
      await completeWorkOrder(workOrderId);
      await fetchData();
      alert("Work order completed successfully!");
    } catch (error) {
      console.error("Error completing work order:", error);
      alert("Failed to complete work order");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReopenWork = async () => {
    if (!workOrderId) return;
    if (!confirm("Are you sure you want to reopen this work order?")) return;

    try {
      setActionLoading(true);
      await reopenWorkOrder(workOrderId);
      await fetchData();
      alert("Work order reopened successfully!");
    } catch (error) {
      console.error("Error reopening work order:", error);
      alert("Failed to reopen work order");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" text="Loading work order..." />
      </div>
    );
  }

  if (error || !workOrder) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/fsr/work-orders">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">Work Order</h1>
        </div>
        <Card className="border-destructive">
          <CardContent className="py-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <AlertTriangle className="h-12 w-12 text-destructive" />
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  Failed to Load Work Order
                </h3>
                <p className="text-muted-foreground">
                  {error ||
                    "Work order not found or you don't have permission to view it."}
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => fetchData()} variant="outline">
                  Try Again
                </Button>
                <Button asChild>
                  <Link href="/fsr/work-orders">Back to Work Orders</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalPartsCost = workParts.reduce(
    (sum, wp) => sum + wp.price * wp.quantity,
    0,
  );

  const canComplete = activities.length > 0 && !workOrder.finishedAt;
  const isCompleted = !!workOrder.finishedAt;
  const isStarted = !!workOrder.startedAt;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/fsr/work-orders">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Work Order</h1>
          <p className="text-muted-foreground">
            {workOrder.incident?.title || "No incident"}
          </p>
        </div>
        <div className="flex gap-2">
          {!isStarted && !isCompleted && (
            <Button
              onClick={handleStartWork}
              disabled={actionLoading}
              variant="secondary"
            >
              <Play className="mr-2 h-4 w-4" />
              Start Work
            </Button>
          )}
          {isStarted && canComplete && (
            <Button
              onClick={handleCompleteWork}
              disabled={actionLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Complete Work Order
            </Button>
          )}
          {isCompleted && (
            <>
              <Badge
                variant="default"
                className="bg-green-600 text-lg py-2 px-4"
              >
                Completed
              </Badge>
              <Button
                onClick={handleReopenWork}
                disabled={actionLoading}
                variant="outline"
              >
                Reopen
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Parent Incident Info */}
      {workOrder.incident && (
        <Card className="bg-muted/30">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Parent Incident</p>
                <p className="font-medium">{workOrder.incident.title}</p>
                <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                  {workOrder.incident.type?.name && (
                    <span>Type: {workOrder.incident.type.name}</span>
                  )}
                  <span>Priority: {workOrder.incident.priority}/10</span>
                  {workOrder.incident.status?.name && (
                    <span>Status: {workOrder.incident.status.name}</span>
                  )}
                  {workOrder.incident.vic?.name && (
                    <span>VIC: {workOrder.incident.vic.name}</span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Work Order Details */}
      <Card>
        <CardHeader>
          <CardTitle>Work Order Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <span className="font-medium">Status:</span>{" "}
            <Badge
              variant="outline"
              style={{
                backgroundColor: workOrder.status?.color
                  ? `${workOrder.status.color}20`
                  : undefined,
                borderColor: workOrder.status?.color || undefined,
                color: workOrder.status?.color || undefined,
              }}
            >
              {workOrder.status?.name || "N/A"}
            </Badge>
          </div>
          {workOrder.folio && (
            <div>
              <span className="font-medium">Folio:</span> {workOrder.folio}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Created:</span>{" "}
              {new Date(workOrder.createdAt).toLocaleString()}
            </div>
            {workOrder.startedAt && (
              <div>
                <span className="font-medium">Started:</span>{" "}
                {new Date(workOrder.startedAt).toLocaleString()}
              </div>
            )}
            {workOrder.finishedAt && (
              <div>
                <span className="font-medium">Completed:</span>{" "}
                {new Date(workOrder.finishedAt).toLocaleString()}
              </div>
            )}
          </div>
          {workOrder.notes && (
            <div>
              <p className="font-medium text-sm mb-1">Notes:</p>
              <p className="text-sm text-muted-foreground">{workOrder.notes}</p>
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
              Work Activities ({activities.length})
            </h2>
            <p className="text-sm text-muted-foreground">
              Document all work performed on this order
            </p>
          </div>
          {!isCompleted && (
            <Button
              onClick={() => setShowActivityForm(!showActivityForm)}
              variant={showActivityForm ? "outline" : "default"}
            >
              {showActivityForm ? "Cancel" : "Add Activity"}
            </Button>
          )}
        </div>

        {showActivityForm && workOrderId && (
          <WorkActivityForm
            workOrderId={workOrderId}
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
              <WorkActivityEdit
                activity={activity}
                onSuccess={fetchData}
                readOnly={isCompleted}
              />
            </CardHeader>
            {activity.workParts && activity.workParts.length > 0 && (
              <CardContent>
                <p className="text-sm font-medium mb-2">Parts Used:</p>
                <div className="space-y-1">
                  {activity.workParts.map((wp: WorkActivityPart) => (
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

      {/* Parts Summary */}
      {workParts.length > 0 && (
        <>
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Package className="h-6 w-6" />
                Parts Used ({workParts.length})
              </h2>
              <p className="text-sm text-muted-foreground">
                Total Cost: ${totalPartsCost.toFixed(2)}
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
                          Quantity: {wp.quantity} × ${wp.price.toFixed(2)}
                        </p>
                      </div>
                      <p className="font-bold">
                        ${(wp.price * wp.quantity).toFixed(2)}
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
          <div className="grid grid-cols-1 gap-3">
            {attachments.map((attachment: WorkOrderAttachment) => (
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
          Back to Work Orders
        </Button>
      </div>
    </div>
  );
}
