"use client"

import { IncidentStatusForm } from "@/components/incident-status/incident-status-form"

export default function NewIncidentStatusPage() {
  const handleSubmit = async (data: any) => {
    // Mock API call
    console.log("Creating incident status:", data)
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create Incident Status</h1>
        <p className="text-muted-foreground">Add a new incident status type to the system</p>
      </div>

      <IncidentStatusForm onSubmit={handleSubmit} />
    </div>
  )
}
