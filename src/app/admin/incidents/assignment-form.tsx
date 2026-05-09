"use client";

import { useRouter } from "next/navigation";
import type React from "react";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface AssignmentData {
  incidentId?: string;
  assigneeId?: string;
  status?: string;
  notes?: string;
  startedAt?: string | Date;
  finishedAt?: string | Date;
}

interface IncidentData {
  id: string;
  title: string;
  priority?: string;
  vic?: {
    name: string;
  };
}

interface AssignmentFormProps {
  assignment?: AssignmentData;
  incident?: IncidentData;
  onClose?: () => void;
}

export function AssignmentForm({
  assignment,
  incident,
  onClose,
}: AssignmentFormProps) {
  const [formData, setFormData] = useState({
    incidentId: "",
    assigneeId: "",
    status: "PENDING",
    notes: "",
    startedAt: "",
    finishedAt: "",
  });

  const router = useRouter();

  // Mock data - replace with actual API calls
  const users = [
    { id: "user_001", name: "John Doe", role: "Technician" },
    { id: "user_002", name: "Jane Smith", role: "System Admin" },
    { id: "user_003", name: "Mike Johnson", role: "Network Specialist" },
    { id: "user_004", name: "Sarah Wilson", role: "Equipment Specialist" },
  ];

  const assignmentStatuses = [
    { value: "PENDING", label: "Pendiente" },
    { value: "IN_PROGRESS", label: "En Progreso" },
    { value: "COMPLETED", label: "Completado" },
    { value: "CANCELLED", label: "Cancelado" },
  ];

  useEffect(() => {
    if (assignment) {
      setFormData({
        incidentId: assignment.incidentId || "",
        assigneeId: assignment.assigneeId || "",
        status: assignment.status || "PENDING",
        notes: assignment.notes || "",
        startedAt: assignment.startedAt
          ? new Date(assignment.startedAt).toISOString().slice(0, 16)
          : "",
        finishedAt: assignment.finishedAt
          ? new Date(assignment.finishedAt).toISOString().slice(0, 16)
          : "",
      });
    } else if (incident) {
      setFormData((prev) => ({
        ...prev,
        incidentId: incident.id,
      }));
    }
  }, [assignment, incident]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Here you would make an API call to create/update the asignación
    console.log("Submitting asignación:", formData);

    // Mock success
    alert(
      assignment
        ? "¡Asignación actualizada exitosamente!"
        : "¡Asignación creada exitosamente!",
    );

    // Navigate back to appropriate list
    if (onClose) {
      onClose();
    } else {
      router.push("/admin/assignments");
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {assignment ? "Edit Assignment" : "Create New Assignment"}
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
              <Label htmlFor="assigneeId">Assign To *</Label>
              <Select
                value={formData.assigneeId}
                onValueChange={(value) => handleChange("assigneeId", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select technician" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} - {user.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleChange("status", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {assignmentStatuses.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder="Add any additional notes or instructions"
              rows={4}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startedAt">Started At</Label>
              <Input
                id="startedAt"
                type="datetime-local"
                value={formData.startedAt}
                onChange={(e) => handleChange("startedAt", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="finishedAt">Finished At</Label>
              <Input
                id="finishedAt"
                type="datetime-local"
                value={formData.finishedAt}
                onChange={(e) => handleChange("finishedAt", e.target.value)}
                disabled={formData.status !== "COMPLETED"}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                onClose ? onClose() : router.push("/admin/assignments")
              }
            >
              Cancelar
            </Button>
            <Button type="submit">
              {assignment ? "Actualizar Orden" : "Crear Orden"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
