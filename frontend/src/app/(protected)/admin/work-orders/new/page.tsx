"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { WorkOrderForm } from "@/components/work-orders/work-order-form";
import { Spinner } from "@/components/ui/spinner";

export default function NewWorkOrderPage() {
  const searchParams = useSearchParams();
  const incidentId = searchParams.get("incidentId");
  const [incident, setIncident] = useState(null);
  const [loading, setLoading] = useState(!!incidentId);

  useEffect(() => {
    if (incidentId) {
      // Mock API call to fetch incident details
      const fetchIncident = async () => {
        setLoading(true);
        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Mock incident data
        const mockIncident = {
          id: incidentId,
          title: "Equipment Malfunction",
          priority: "HIGH",
          vic: { name: "VIC Centro", code: "VIC001" },
        };

        setIncident(mockIncident);
        setLoading(false);
      };

      fetchIncident();
    }
  }, [incidentId]);

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Spinner size="lg" text="Loading..." />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href={incidentId ? "/admin/incidents" : "/admin/work-orders"}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to {incidentId ? "Incidents" : "Work Orders"}
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Create New Work Order</h1>
          <p className="text-muted-foreground">
            {incident
              ? `Creating work order for incident: ${incident.title}`
              : "Fill in the details to create a new work order"}
          </p>
        </div>
      </div>

      <div className="max-w-4xl">
        <WorkOrderForm incident={incident} />
      </div>
    </div>
  );
}
