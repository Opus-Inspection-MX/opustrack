"use client"

import { PartForm } from "@/components/parts/part-form"

const mockVICs = [
  { id: "vic_001", name: "VIC Center 1", code: "VIC001" },
  { id: "vic_002", name: "VIC Center 2", code: "VIC002" },
  { id: "vic_003", name: "VIC Center 3", code: "VIC003" },
]

export default function NewPartPage() {
  const handleSubmit = async (data: any) => {
    console.log("Creating part:", data)
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create Part</h1>
        <p className="text-muted-foreground">Add a new part to inventory</p>
      </div>

      <PartForm vics={mockVICs} onSubmit={handleSubmit} />
    </div>
  )
}
