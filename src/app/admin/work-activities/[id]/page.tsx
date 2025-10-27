"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Edit, Trash2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { getWorkActivityById, deleteWorkActivity } from "@/lib/actions/work-activities";

export default function WorkActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activity, setActivity] = useState<any>(null);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const data = await getWorkActivityById(id);
        setActivity(data);
      } catch (error) {
        console.error("Error fetching work activity:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActivity();
  }, [id]);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this work activity?")) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteWorkActivity(id);
      router.push(
        `/admin/work-orders/${activity.workOrderId}`
      );
    } catch (error) {
      console.error("Error deleting work activity:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to delete work activity"
      );
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" text="Loading work activity..." />
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Work Activity Not Found</h1>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Work Activity Details</h1>
            <p className="text-muted-foreground">
              View work activity information
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() =>
              router.push(`/admin/work-activities/${id}/edit`)
            }
          >
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Work Activity Information */}
        <Card>
          <CardHeader>
            <CardTitle>Activity Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Activity ID
                </p>
                <p className="text-sm">{activity.id}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Performed At
                </p>
                <p className="text-sm">
                  {new Date(activity.performedAt).toLocaleString()}
                </p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Description
              </p>
              <p className="text-sm whitespace-pre-wrap">
                {activity.description}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Work Order Information */}
        {activity.workOrder && (
          <Card>
            <CardHeader>
              <CardTitle>Work Order Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Work Order ID
                  </p>
                  <Button
                    variant="link"
                    className="h-auto p-0 text-sm"
                    onClick={() =>
                      router.push(`/admin/work-orders/${activity.workOrderId}`)
                    }
                  >
                    {activity.workOrderId}
                  </Button>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Status
                  </p>
                  <p className="text-sm">{activity.workOrder.status}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Assigned To
                  </p>
                  <p className="text-sm">
                    {activity.workOrder.assignedTo?.name || "N/A"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Work Parts Used */}
        {activity.workParts && activity.workParts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Parts Used ({activity.workParts.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {activity.workParts.map((workPart: any) => (
                  <div
                    key={workPart.id}
                    className="flex justify-between items-center p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{workPart.part?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {workPart.description || "No description"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">Qty: {workPart.quantity}</p>
                      <p className="text-sm font-medium">
                        ${workPart.price?.toFixed(2) || "0.00"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
