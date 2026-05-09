import { z } from "zod";

// User validation
export const userSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be less than 100 characters"),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .optional(),
  roleId: z.number().min(1, "Role is required"),
  userStatusId: z.number().min(1, "Status is required"),
  vicId: z.string().optional(),
  active: z.boolean().default(true),
});

export type UserFormData = z.infer<typeof userSchema>;

export function validateUser(data: UserFormData) {
  return userSchema.safeParse(data);
}

// Incident validation
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

export type IncidentFormData = z.infer<typeof incidentSchema>;

// Assignment validation
export const assignmentSchema = z.object({
  incidentId: z.string().min(1, "Incident is required"),
  assigneeIds: z.array(z.string().min(1)).optional(),
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
  notes: z
    .string()
    .max(2000, "Notes must be less than 2000 characters")
    .optional(),
  odtFolio: z
    .string()
    .max(100, "ODT folio must be at most 100 characters")
    .optional(),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
});

export type AssignmentFormData = z.infer<typeof assignmentSchema>;

// Permission validation
export const permissionSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be less than 100 characters"),
  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .optional(),
  active: z.boolean().default(true),
});

export type PermissionFormData = z.infer<typeof permissionSchema>;

// Role validation
export const roleSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be less than 100 characters"),
  defaultPath: z
    .string()
    .min(1, "Default path is required")
    .startsWith("/", "Path must start with /"),
  active: z.boolean().default(true),
});

export type RoleFormData = z.infer<typeof roleSchema>;
