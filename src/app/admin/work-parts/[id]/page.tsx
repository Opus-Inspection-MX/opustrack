"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Edit, Trash2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { getWorkPartById, deleteWorkPart } from "@/lib/actions/work-parts";

export default function WorkPartDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [workPart, setWorkPart] = useState<any>(null);

  useEffect(() => {
    const fetchWorkPart = async () => {
      try {
        const data = await getWorkPartById(id);
        setWorkPart(data);
      } catch (error) {
        console.error("Error fetching work part:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkPart();
  }, [id]);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this work part? Stock will be restored.")) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteWorkPart(id);
      router.push(
        `/admin/work-orders/${workPart.workOrderId}`
      );
    } catch (error) {
      console.error("Error deleting work part:", error);
      alert(
        error instanceof Error ? error.message : "Failed to delete work part"
      );
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" text="Loading work part..." />
      </div>
    );
  }

  if (!workPart) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Work Part Not Found</h1>
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
            <h1 className="text-3xl font-bold">Work Part Details</h1>
            <p className="text-muted-foreground">View work part information</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/admin/work-parts/${id}/edit`)}
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
        {/* Work Part Information */}
        <Card>
          <CardHeader>
            <CardTitle>Part Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Work Part ID
                </p>
                <p className="text-sm">{workPart.id}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Part Name
                </p>
                <p className="text-sm">{workPart.part?.name || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Quantity
                </p>
                <p className="text-sm">{workPart.quantity}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Price (at time of use)
                </p>
                <p className="text-sm">
                  ${workPart.price?.toFixed(2) || "0.00"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Cost
                </p>
                <p className="text-sm font-bold">
                  $
                  {(
                    (workPart.price || 0) * (workPart.quantity || 0)
                  ).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Added On
                </p>
                <p className="text-sm">
                  {new Date(workPart.createdAt).toLocaleString()}
                </p>
              </div>
            </div>

            {workPart.description && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Description
                </p>
                <p className="text-sm whitespace-pre-wrap">
                  {workPart.description}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Part Details */}
        {workPart.part && (
          <Card>
            <CardHeader>
              <CardTitle>Part Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Part ID
                  </p>
                  <p className="text-sm">{workPart.part.id}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Current Stock
                  </p>
                  <p className="text-sm">{workPart.part.stock}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Current Price
                  </p>
                  <p className="text-sm">
                    ${workPart.part.price?.toFixed(2) || "0.00"}
                  </p>
                </div>
              </div>
              {workPart.part.description && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Part Description
                  </p>
                  <p className="text-sm">{workPart.part.description}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Work Order Information */}
        {workPart.workOrder && (
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
                      router.push(`/admin/work-orders/${workPart.workOrderId}`)
                    }
                  >
                    {workPart.workOrderId}
                  </Button>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Status
                  </p>
                  <p className="text-sm">{workPart.workOrder.status?.name || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Assigned To
                  </p>
                  <p className="text-sm">
                    {workPart.workOrder.assignedTo?.name || "N/A"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Work Activity Information */}
        {workPart.workActivity && (
          <Card>
            <CardHeader>
              <CardTitle>Work Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Activity Description
                </p>
                <p className="text-sm">{workPart.workActivity.description}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
