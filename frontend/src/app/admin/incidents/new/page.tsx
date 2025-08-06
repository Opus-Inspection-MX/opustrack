"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { IncidentForm } from "@/components/incidents/incident-form";

export default function NewIncidentPage() {
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
          <h1 className="text-3xl font-bold">Create New Incident</h1>
          <p className="text-muted-foreground">
            Fill in the details to create a new incident
          </p>
        </div>
      </div>

      <div className="max-w-4xl">
        <IncidentForm />
      </div>
    </div>
  );
}
