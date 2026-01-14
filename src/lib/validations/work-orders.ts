import { z } from "zod";
import { cuidSchema, intIdSchema, baseQuerySchema } from "./common";

/**
 * Schema for creating a work order
 */
export const WorkOrderCreateSchema = z.object({
  incidentId: intIdSchema,
  assignedToId: cuidSchema,
  statusId: intIdSchema.nullable().optional(),
  notes: z.string().max(2000, "Notes must be at most 2000 characters").optional(),
  folio: z.string().max(50, "Folio must be at most 50 characters").nullable().optional(),
  startedAt: z.date().nullable().optional(),
  finishedAt: z.date().nullable().optional(),
});

/**
 * Schema for updating a work order
 */
export const WorkOrderUpdateSchema = WorkOrderCreateSchema.partial().extend({
  id: cuidSchema,
});

/**
 * Schema for deleting a work order
 */
export const WorkOrderDeleteSchema = z.object({
  id: cuidSchema,
});

/**
 * Schema for completing a work order
 */
export const WorkOrderCompleteSchema = z.object({
  id: cuidSchema,
  notes: z.string().max(2000, "Notes must be at most 2000 characters").optional(),
});

/**
 * Schema for updating work order status
 */
export const WorkOrderStatusUpdateSchema = z.object({
  id: cuidSchema,
  statusId: intIdSchema,
});

/**
 * Schema for updating work order folio
 */
export const WorkOrderFolioUpdateSchema = z.object({
  id: cuidSchema,
  folio: z.string().min(1, "Folio is required").max(50, "Folio must be at most 50 characters"),
});

/**
 * Schema for work order attachment upload
 */
export const WorkOrderAttachmentSchema = z.object({
  workOrderId: cuidSchema,
  filename: z.string().min(1, "Filename is required"),
  base64Data: z.string().min(1, "File content is required"),
  mimetype: z.string().regex(/^[a-z]+\/[a-z0-9\-+.]+$/i, "Invalid mimetype"),
  size: z.number().int().positive().max(10 * 1024 * 1024, "File size must be less than 10MB"),
  description: z.string().max(500, "Description must be at most 500 characters").optional(),
});

/**
 * Schema for querying work orders
 */
export const WorkOrderQuerySchema = baseQuerySchema.extend({
  statusId: z.coerce.number().int().positive().optional(),
  assignedToId: z.string().cuid().optional(),
  incidentId: z.coerce.number().int().positive().optional(),
  sortBy: z
    .enum(["createdAt", "startedAt", "finishedAt", "updatedAt"])
    .default("createdAt"),
});

// Type inference
export type WorkOrderCreateInput = z.infer<typeof WorkOrderCreateSchema>;
export type WorkOrderUpdateInput = z.infer<typeof WorkOrderUpdateSchema>;
export type WorkOrderDeleteInput = z.infer<typeof WorkOrderDeleteSchema>;
export type WorkOrderCompleteInput = z.infer<typeof WorkOrderCompleteSchema>;
export type WorkOrderStatusUpdateInput = z.infer<typeof WorkOrderStatusUpdateSchema>;
export type WorkOrderFolioUpdateInput = z.infer<typeof WorkOrderFolioUpdateSchema>;
export type WorkOrderAttachmentInput = z.infer<typeof WorkOrderAttachmentSchema>;
export type WorkOrderQueryInput = z.infer<typeof WorkOrderQuerySchema>;
