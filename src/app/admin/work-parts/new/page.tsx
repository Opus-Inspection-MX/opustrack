"use client"

import { WorkPartForm } from "@/components/work-parts/work-part-form"

// Mock data - replace with actual API calls
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
  {
    id: "part_004",
    name: "Spark Plugs",
    price: 45.0,
    stock: 15,
    vic: { name: "VIC Center 2", code: "VIC002" },
  },
]

const mockWorkOrders = [
  {
    id: "wo_001",
    status: { name: "In Progress" },
    incident: { title: "Brake system maintenance required" },
  },
  {
    id: "wo_002",
    status: { name: "Pending" },
    incident: { title: "Routine maintenance - Line 2" },
  },
  {
    id: "wo_003",
    status: { name: "Completed" },
    incident: { title: "Air quality improvement project" },
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
  {
    id: "wa_003",
    description: "Air filter installation and testing",
    workOrderId: "wo_003",
  },
]

export default function NewWorkPartPage() {
  const handleSubmit = async (data: any) => {
    console.log("Creating work part:", data)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))
    alert("Work part added successfully!")
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Add Work Part</h1>
        <p className="text-muted-foreground">Record parts used in work orders and activities</p>
      </div>

      <WorkPartForm
        parts={mockParts}
        workOrders={mockWorkOrders}
        workActivities={mockWorkActivities}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
