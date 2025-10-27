"use client"

import { useRouter } from "next/navigation"
import { IncidentStatusForm } from "@/components/incident-status/incident-status-form"
import { createIncidentStatus } from "@/lib/actions/lookups"

export default function NewIncidentStatusPage() {
  const router = useRouter()

  const handleSubmit = async (data: any) => {
    try {
      await createIncidentStatus({
        name: data.name.trim(),
        description: data.description?.trim() || undefined,
      })
      router.push("/admin/incident-status")
      router.refresh()
    } catch (error) {
      console.error("Error creating incident status:", error)
      throw error
    }
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
