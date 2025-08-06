"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { IncidentForm } from "@/components/incidents/incident-form";
import { Spinner } from "@/components/ui/spinner";

interface EditIncidentPageProps {
  params: {
    id: string;
  };
}

export default function EditIncidentPage({ params }: EditIncidentPageProps) {
  const [incident, setIncident] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock API call - replace with actual API
    const fetchIncident = async () => {
      setLoading(true);
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Mock incident data
      const mockIncident = {
        id: params.id,
        title: "Equipment Malfunction",
        description: "Inspection equipment not working properly",
        priority: "HIGH",
        sla: 24,
        typeId: "1",
        statusId: "1",
        vicId: "vic_001",
        reportedById: "user_001",
        scheduleId: "",
      };

      setIncident(mockIncident);
      setLoading(false);
    };

    fetchIncident();
  }, [params.id]);

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Spinner size="lg" text="Loading incident..." />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/incidents">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Incidents
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Edit Incident</h1>
          <p className="text-muted-foreground">Update incident details</p>
        </div>
      </div>

      <div className="max-w-4xl">
        <IncidentForm incident={incident} />
      </div>
    </div>
  );
}
