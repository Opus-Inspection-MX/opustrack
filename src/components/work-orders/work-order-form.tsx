"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Textarea } from "@/components/ui/textarea";
import { type WorkOrderFormData, workOrderSchema } from "@/lib/validations";

interface WorkOrderData {
  incidentId?: string;
  assignedToId?: string;
  status?: { name: string } | null;
  notes?: string;
  startedAt?: string | Date;
  finishedAt?: string | Date;
}

interface IncidentData {
  id?: string;
  title?: string;
  priority?: string;
  vic?: { name?: string } | null;
}

interface ZodIssue {
  path?: (string | number)[];
  message: string;
}

interface WorkOrderFormProps {
  workOrder?: WorkOrderData;
  incident?: IncidentData;
  onClose?: () => void;
}

export function WorkOrderForm({
  workOrder,
  incident,
  onClose,
}: WorkOrderFormProps) {
  const [formData, setFormData] = useState<WorkOrderFormData>({
    incidentId: "",
    assignedToId: "",
    status: "PENDING",
    notes: "",
    startedAt: "",
    finishedAt: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const router = useRouter();

  // Mock data - replace with actual API calls
  const users = [
    { id: "user_001", name: "John Doe", role: "Technician" },
    { id: "user_002", name: "Jane Smith", role: "System Admin" },
    { id: "user_003", name: "Mike Johnson", role: "Network Specialist" },
    { id: "user_004", name: "Sarah Wilson", role: "Equipment Specialist" },
  ];

  const workOrderStatuses = [
    { value: "PENDING", label: "Pending" },
    { value: "IN_PROGRESS", label: "In Progress" },
    { value: "COMPLETED", label: "Completed" },
    { value: "CANCELLED", label: "Cancelled" },
  ];

  useEffect(() => {
    if (workOrder) {
      setFormData({
        incidentId: workOrder.incidentId || "",
        assignedToId: workOrder.assignedToId || "",
        status:
          (workOrder.status?.name as
            | "PENDING"
            | "IN_PROGRESS"
            | "COMPLETED"
            | "CANCELLED") || "PENDING",
        notes: workOrder.notes || "",
        startedAt: workOrder.startedAt
          ? new Date(workOrder.startedAt).toISOString().slice(0, 16)
          : "",
        finishedAt: workOrder.finishedAt
          ? new Date(workOrder.finishedAt).toISOString().slice(0, 16)
          : "",
      });
    } else if (incident) {
      setFormData((prev) => ({
        ...prev,
        incidentId: incident.id || "",
      }));
    }
  }, [workOrder, incident]);

  const validateField = (field: string, value: string | undefined) => {
    try {
      workOrderSchema
        .pick({ [field]: true } as Record<keyof WorkOrderFormData, true>)
        .parse({ [field]: value });
      setErrors((prev) => ({ ...prev, [field]: "" }));
    } catch (error: unknown) {
      const zodError = error as { issues?: ZodIssue[] };
      const fieldError = zodError.issues?.[0]?.message || "Invalid value";
      setErrors((prev) => ({ ...prev, [field]: fieldError }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validate all fields
      const validatedData = workOrderSchema.parse(formData);

      // Clear any existing errors
      setErrors({});

      // Here you would make an API call to create/update the work order
      console.log("Submitting work order:", validatedData);

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Mock success
      alert(
        workOrder
          ? "Work order updated successfully!"
          : "Work order created successfully!",
      );

      // Navigate back to appropriate list
      if (onClose) {
        onClose();
      } else {
        router.push("/admin/work-orders");
      }
    } catch (error: unknown) {
      const zodError = error as { issues?: ZodIssue[] };
      if (zodError.issues) {
        const fieldErrors: Record<string, string> = {};
        for (const err of zodError.issues) {
          if (err.path?.[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        }
        setErrors(fieldErrors);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Mark field as touched
    setTouched((prev) => ({ ...prev, [field]: true }));

    // Validate field if it has been touched
    if (touched[field]) {
      validateField(field, value);
    }
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validateField(field, formData[field as keyof WorkOrderFormData]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {workOrder ? "Edit Work Order" : "Create New Work Order"}
          {incident && (
            <Badge variant="outline">Incident: {incident.title}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {incident && (
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Related Incident</h4>
              <div className="text-sm space-y-1">
                <div>
                  <strong>Title:</strong> {incident.title}
                </div>
                <div>
                  <strong>Priority:</strong> {incident.priority}
                </div>
                <div>
                  <strong>VIC:</strong> {incident.vic?.name}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="assignedToId">Assign To *</Label>
              <SearchableSelect
                options={users.map((user) => ({
                  value: user.id,
                  label: `${user.name} - ${user.role}`,
                }))}
                value={formData.assignedToId}
                onValueChange={(value) => handleChange("assignedToId", value)}
                placeholder="Select technician"
                searchPlaceholder="Search technicians..."
                emptyMessage="No technicians found."
                className={errors.assignedToId ? "border-destructive" : ""}
              />
              <FormError message={errors.assignedToId} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleChange("status", value)}
              >
                <SelectTrigger
                  className={errors.status ? "border-destructive" : ""}
                >
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {workOrderStatuses.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormError message={errors.status} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              onBlur={() => handleBlur("notes")}
              placeholder="Add any additional notes or instructions"
              rows={4}
              className={errors.notes ? "border-destructive" : ""}
            />
            <FormError message={errors.notes} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startedAt">Started At</Label>
              <Input
                id="startedAt"
                type="datetime-local"
                value={formData.startedAt}
                onChange={(e) => handleChange("startedAt", e.target.value)}
                onBlur={() => handleBlur("startedAt")}
                className={errors.startedAt ? "border-destructive" : ""}
              />
              <FormError message={errors.startedAt} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="finishedAt">Finished At</Label>
              <Input
                id="finishedAt"
                type="datetime-local"
                value={formData.finishedAt}
                onChange={(e) => handleChange("finishedAt", e.target.value)}
                onBlur={() => handleBlur("finishedAt")}
                disabled={formData.status !== "COMPLETED"}
                className={errors.finishedAt ? "border-destructive" : ""}
              />
              <FormError message={errors.finishedAt} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                onClose ? onClose() : router.push("/admin/work-orders")
              }
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {workOrder ? "Update Work Order" : "Create Work Order"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
