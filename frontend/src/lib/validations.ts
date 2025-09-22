import { z } from "zod";

// Incident validation schema
export const incidentSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be less than 200 characters"),
  description: z
    .string()
    .min(1, "Description is required")
    .max(1000, "Description must be less than 1000 characters"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  sla: z
    .number()
    .min(1, "SLA must be at least 1 hour")
    .max(8760, "SLA cannot exceed 1 year"),
  typeId: z.string().min(1, "Incident type is required"),
  statusId: z.string().min(1, "Status is required"),
  vicId: z.string().min(1, "VIC is required"),
  reportedById: z.string().min(1, "Reporter is required"),
  scheduleId: z.string().optional(),
});

// Work order validation schema
export const workOrderSchema = z
  .object({
    incidentId: z.string().min(1, "Incident is required"),
    assignedToId: z.string().min(1, "Assignee is required"),
    status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"], {
      message: "Status is required",
    }),
    notes: z
      .string()
      .max(1000, "Notes must be less than 1000 characters")
      .optional(),
    startedAt: z.string().optional(),
    finishedAt: z.string().optional(),
  })
  .refine(
    (data) => {
      // If status is COMPLETED, finishedAt should be provided
      if (data.status === "COMPLETED" && !data.finishedAt) {
        return false;
      }
      // If finishedAt is provided, startedAt should also be provided
      if (data.finishedAt && !data.startedAt) {
        return false;
      }
      // finishedAt should be after startedAt
      if (data.startedAt && data.finishedAt) {
        return new Date(data.finishedAt) > new Date(data.startedAt);
      }
      return true;
    },
    {
      message: "Invalid date configuration",
      path: ["finishedAt"],
    }
  );

export type IncidentFormData = z.infer<typeof incidentSchema>;
export type WorkOrderFormData = z.infer<typeof workOrderSchema>;
