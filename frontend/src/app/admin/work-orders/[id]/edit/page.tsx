"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { WorkOrderForm } from "@/components/work-orders/work-order-form";
import { Spinner } from "@/components/ui/spinner";

interface EditWorkOrderPageProps {
  params: {
    id: string;
  };
}

export default function EditWorkOrderPage({ params }: EditWorkOrderPageProps) {
  const [workOrder, setWorkOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock API call - replace with actual API
    const fetchWorkOrder = async () => {
      setLoading(true);
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Mock work order data
      const mockWorkOrder = {
        id: params.id,
        incidentId: "inc_001",
        assignedToId: "user_001",
        status: "IN_PROGRESS",
        notes: "Checking equipment sensors and calibration",
        startedAt: "2024-01-15T11:00:00Z",
        finishedAt: null,
        incident: {
          id: "inc_001",
          title: "Equipment Malfunction",
          priority: "HIGH",
          vic: { name: "VIC Centro", code: "VIC001" },
        },
      };

      setWorkOrder(mockWorkOrder);
      setLoading(false);
    };

    fetchWorkOrder();
  }, [params.id]);

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Spinner size="lg" text="Loading work order..." />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/work-orders">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Work Orders
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Edit Work Order</h1>
          <p className="text-muted-foreground">Update work order details</p>
        </div>
      </div>

      <div className="max-w-4xl">
        <WorkOrderForm workOrder={workOrder} />
      </div>
    </div>
  );
}
