import { z } from "zod";
import { cuidSchema, intIdSchema } from "./common";

/**
 * Schema for creating a schedule
 */
export const ScheduleCreateSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title must be at most 200 characters"),
  description: z
    .string()
    .max(2000, "Description must be at most 2000 characters")
    .optional(),
  scheduledAt: z.date({ message: "Scheduled date is required" }),
  endDate: z.date().optional().nullable(),
  statusId: intIdSchema.optional().nullable(),
  clientIds: z.array(cuidSchema),
});

/**
 * Lightweight schema for the quick-edit dialog (Clients + date range only).
 */
export const ScheduleQuickUpdateSchema = z.object({
  clientIds: z.array(cuidSchema),
  scheduledAt: z.date({ message: "Scheduled date is required" }),
  endDate: z.date().optional().nullable(),
});

/**
 * Schema for updating a schedule
 */
export const ScheduleUpdateSchema = ScheduleCreateSchema.partial().extend({
  id: cuidSchema,
});

// Type inference
export type ScheduleCreateInput = z.infer<typeof ScheduleCreateSchema>;
export type ScheduleUpdateInput = z.infer<typeof ScheduleUpdateSchema>;
export type ScheduleQuickUpdateInput = z.infer<
  typeof ScheduleQuickUpdateSchema
>;
