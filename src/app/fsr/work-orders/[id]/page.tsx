"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Package, Activity, Paperclip, Trash2, AlertTriangle, ExternalLink, Play, CheckCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { WorkActivityForm } from "@/components/work-orders/work-activity-form";
import { WorkActivityEdit } from "@/components/work-orders/work-activity-edit";
import { getWorkOrderById, deleteWorkOrderAttachment, startWorkOrder, completeWorkOrder } from "@/lib/actions/work-orders";
import { getWorkActivities, deleteWorkActivity } from "@/lib/actions/work-activities";
import { getWorkParts } from "@/lib/actions/work-parts";
import { formatFileSize, getFileIcon } from "@/lib/upload";

export default function FSRWorkOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [workOrderId, setWorkOrderId] = useState<string | null>(null);
  const [workOrder, setWorkOrder] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [workParts, setWorkParts] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

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
    if (!confirm("Are you sure you want to mark this work order as complete?")) return;

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
            <Badge variant="default" className="bg-green-600 text-lg py-2 px-4">
              Completed
            </Badge>
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
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Status:</span>{" "}
              {workOrder.status?.name || "N/A"}
            </div>
            <div>
              <span className="font-medium">Created:</span>{" "}
              {new Date(workOrder.createdAt).toLocaleDateString()}
            </div>
            {workOrder.startedAt && (
              <div>
                <span className="font-medium">Started:</span>{" "}
                {new Date(workOrder.startedAt).toLocaleDateString()}
              </div>
            )}
            {workOrder.finishedAt && (
              <div>
                <span className="font-medium">Completed:</span>{" "}
                {new Date(workOrder.finishedAt).toLocaleDateString()}
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
                    <div key={wp.id} className="p-4 flex items-center justify-between">
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
                    {!isCompleted && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteAttachment(attachment.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
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
