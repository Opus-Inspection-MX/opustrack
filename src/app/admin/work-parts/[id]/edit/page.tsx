"use client";

import { use } from "react";
import { WorkPartForm } from "@/components/work-parts/work-part-form";
import { toast } from "@/hooks/use-toast";

interface WorkPartFormData {
  partId: string;
  quantity: number;
  description?: string;
  price: number;
  assignmentId?: string;
  activityId?: string;
  active: boolean;
}

// Mock data - replace with actual API calls
const mockWorkPart = {
  id: "wp_001",
  partId: "part_001",
  quantity: 2,
  description: "Replaced worn brake pads on inspection line 1",
  price: 89.99,
  assignmentId: "wo_001",
  activityId: "wa_001",
  active: true,
};

const mockParts = [
  {
    id: "part_001",
    name: "Brake Pad Set",
    price: 89.99,
    stock: 25,
    cliente: { name: "Cliente Center 1", code: "Cliente001" },
  },
  {
    id: "part_002",
    name: "Oil Filter",
    price: 15.5,
    stock: 50,
    cliente: { name: "Cliente Center 1", code: "Cliente001" },
  },
  {
    id: "part_003",
    name: "Air Filter",
    price: 22.75,
    stock: 30,
    cliente: { name: "Cliente Center 2", code: "Cliente002" },
  },
];

const mockAssignments = [
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
];

const mockAssignmentActivities = [
  {
    id: "wa_001",
    description: "Brake pad replacement and system check",
    assignmentId: "wo_001",
  },
  {
    id: "wa_002",
    description: "Oil change and filter replacement",
    assignmentId: "wo_002",
  },
];

export default function EditWorkPartPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const handleSubmit = async (data: WorkPartFormData) => {
    console.log("Updating work part:", resolvedParams.id, data);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    toast.success("¡Refacción actualizada exitosamente!");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Editar Refacción</h1>
        <p className="text-muted-foreground">Update work part information</p>
      </div>

      <WorkPartForm
        workPart={mockWorkPart}
        parts={mockParts}
        assignments={mockAssignments}
        assignmentActivities={mockAssignmentActivities}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
