import { z } from "zod";
import { cuidSchema, intIdSchema } from "./common";

/**
 * Schema for creating an assignment.
 *
 * Empty `assigneeIds` is VALID: without an FSR the state machine opens the
 * assignment as PENDIENTE_DE_ASIGNACION (the tracking quick-create sends
 * `[]` on purpose). The old `.min(1)` described a rule that never existed.
 */
export const AssignmentCreateSchema = z.object({
  incidentId: intIdSchema,
  assigneeIds: z.array(cuidSchema),
  statusId: intIdSchema.nullable().optional(),
  notes: z
    .string()
    .max(2000, "Notes must be at most 2000 characters")
    .optional(),
  odtFolio: z
    .string()
    .max(100, "ODT folio must be at most 100 characters")
    .nullable()
    .optional(),
  startedAt: z.date().nullable().optional(),
  finishedAt: z.date().nullable().optional(),
  scheduledDate: z.date().nullable().optional(),
});

/**
 * Schema for updating an assignment
 */
export const AssignmentUpdateSchema = AssignmentCreateSchema.partial().extend({
  id: cuidSchema,
  // RF-013: update may unassign all (0 assignees allowed)
  assigneeIds: z.array(cuidSchema).optional(),
});

/**
 * Schema for completing an assignment
 */
export const AssignmentCompleteSchema = z.object({
  id: cuidSchema,
  notes: z
    .string()
    .max(2000, "Notes must be at most 2000 characters")
    .optional(),
});

/**
 * Schema for updating assignment status
 */
export const AssignmentStatusUpdateSchema = z.object({
  id: cuidSchema,
  statusId: intIdSchema,
});

/**
 * Schema for assignment attachment upload
 */
export const AssignmentAttachmentSchema = z.object({
  assignmentId: cuidSchema,
  filename: z.string().min(1, "Filename is required"),
  base64Data: z.string().min(1, "File content is required"),
  mimetype: z.string().regex(/^[a-z]+\/[a-z0-9\-+.]+$/i, "Invalid mimetype"),
  size: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024, "File size must be less than 10MB"),
  description: z
    .string()
    .max(500, "Description must be at most 500 characters")
    .optional(),
});

// Type inference
export type AssignmentCreateInput = z.infer<typeof AssignmentCreateSchema>;
export type AssignmentUpdateInput = z.infer<typeof AssignmentUpdateSchema>;
export type AssignmentCompleteInput = z.infer<typeof AssignmentCompleteSchema>;
export type AssignmentStatusUpdateInput = z.infer<
  typeof AssignmentStatusUpdateSchema
>;
export type AssignmentAttachmentInput = z.infer<
  typeof AssignmentAttachmentSchema
>;
