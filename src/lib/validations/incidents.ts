import { z } from "zod";
import {
  cuidSchema,
  intIdSchema,
  prioritySchema,
  slaSchema,
  baseQuerySchema,
} from "./common";

/**
 * Schema for creating an incident
 */
export const IncidentCreateSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title must be at most 200 characters"),
  description: z.string().min(1, "Description is required"),
  priority: prioritySchema,
  sla: slaSchema,
  typeId: intIdSchema.nullable().optional(),
  statusId: intIdSchema.nullable().optional(),
  vicId: cuidSchema.nullable().optional(),
  scheduleId: cuidSchema.nullable().optional(),
  reportedById: cuidSchema.nullable().optional(),
  resolvedAt: z.date().nullable().optional(),
});

/**
 * Schema for creating an incident as a client
 */
export const IncidentClientCreateSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title must be at most 200 characters"),
  description: z.string().min(1, "Description is required"),
  priority: prioritySchema,
  typeId: intIdSchema.optional(),
  lineId: intIdSchema.optional(),
  equipmentId: intIdSchema.optional(),
});

/**
 * Schema for updating an incident
 */
export const IncidentUpdateSchema = IncidentCreateSchema.partial().extend({
  id: intIdSchema,
});

/**
 * Schema for deleting an incident
 */
export const IncidentDeleteSchema = z.object({
  id: intIdSchema,
});

/**
 * Schema for changing incident status
 */
export const IncidentChangeStatusSchema = z.object({
  id: intIdSchema,
  statusId: intIdSchema,
});

/**
 * Schema for assigning incident to FSR
 */
export const IncidentAssignSchema = z.object({
  incidentId: intIdSchema,
  fsrUserId: cuidSchema,
});

/**
 * Schema for querying incidents
 */
export const IncidentQuerySchema = baseQuerySchema.extend({
  statusId: z.coerce.number().int().positive().optional(),
  typeId: z.coerce.number().int().positive().optional(),
  vicId: z.string().cuid().optional(),
  priority: z.coerce.number().int().min(1).max(10).optional(),
  sortBy: z
    .enum(["reportedAt", "priority", "title", "updatedAt"])
    .default("reportedAt"),
});

// Type inference
export type IncidentCreateInput = z.infer<typeof IncidentCreateSchema>;
export type IncidentClientCreateInput = z.infer<
  typeof IncidentClientCreateSchema
>;
export type IncidentUpdateInput = z.infer<typeof IncidentUpdateSchema>;
export type IncidentDeleteInput = z.infer<typeof IncidentDeleteSchema>;
export type IncidentChangeStatusInput = z.infer<
  typeof IncidentChangeStatusSchema
>;
export type IncidentAssignInput = z.infer<typeof IncidentAssignSchema>;
export type IncidentQueryInput = z.infer<typeof IncidentQuerySchema>;
