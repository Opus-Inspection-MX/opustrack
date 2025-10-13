"use client"

import { WorkPartForm } from "@/components/work-parts/work-part-form"

// Mock data - replace with actual API calls
const mockWorkPart = {
  id: "wp_001",
  partId: "part_001",
  quantity: 2,
  description: "Replaced worn brake pads on inspection line 1",
  price: 89.99,
  workOrderId: "wo_001",
  workActivityId: "wa_001",
  active: true,
}

const mockParts = [
  {
    id: "part_001",
    name: "Brake Pad Set",
    price: 89.99,
    stock: 25,
    vic: { name: "VIC Center 1", code: "VIC001" },
  },
  {
    id: "part_002",
    name: "Oil Filter",
    price: 15.5,
    stock: 50,
    vic: { name: "VIC Center 1", code: "VIC001" },
  },
  {
    id: "part_003",
    name: "Air Filter",
    price: 22.75,
    stock: 30,
    vic: { name: "VIC Center 2", code: "VIC002" },
  },
]

const mockWorkOrders = [
  {
    id: "wo_001",
    status: "in_progress",
    incident: { title: "Brake system maintenance required" },
  },
  {
    id: "wo_002",
    status: "pending",
    incident: { title: "Routine maintenance - Line 2" },
  },
]

const mockWorkActivities = [
  {
    id: "wa_001",
    description: "Brake pad replacement and system check",
    workOrderId: "wo_001",
  },
  {
    id: "wa_002",
    description: "Oil change and filter replacement",
    workOrderId: "wo_002",
  },
]

export default function EditWorkPartPage({ params }: { params: { id: string } }) {
  const handleSubmit = async (data: any) => {
    console.log("Updating work part:", params.id, data)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))
    alert("Work part updated successfully!")
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Edit Work Part</h1>
        <p className="text-muted-foreground">Update work part information</p>
      </div>

      <WorkPartForm
        workPart={mockWorkPart}
        parts={mockParts}
        workOrders={mockWorkOrders}
        workActivities={mockWorkActivities}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
