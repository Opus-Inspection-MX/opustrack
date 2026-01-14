import { z } from "zod";
import { cuidSchema, intIdSchema, baseQuerySchema } from "./common";

/**
 * Schema for creating a schedule
 */
export const ScheduleCreateSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title must be at most 200 characters"),
  description: z.string().max(2000, "Description must be at most 2000 characters").optional(),
  scheduledAt: z.date({ message: "Scheduled date is required" }),
  endDate: z.date().optional().nullable(),
  statusId: intIdSchema.optional().nullable(),
  vicId: cuidSchema,
});

/**
 * Schema for updating a schedule
 */
export const ScheduleUpdateSchema = ScheduleCreateSchema.partial().extend({
  id: cuidSchema,
});

/**
 * Schema for deleting a schedule
 */
export const ScheduleDeleteSchema = z.object({
  id: cuidSchema,
});

/**
 * Schema for changing schedule status
 */
export const ScheduleChangeStatusSchema = z.object({
  id: cuidSchema,
  statusId: intIdSchema,
});

/**
 * Schema for querying schedules
 */
export const ScheduleQuerySchema = baseQuerySchema.extend({
  statusId: z.coerce.number().int().positive().optional(),
  vicId: z.string().cuid().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  sortBy: z.enum(["scheduledAt", "title", "createdAt"]).default("scheduledAt"),
});

// Type inference
export type ScheduleCreateInput = z.infer<typeof ScheduleCreateSchema>;
export type ScheduleUpdateInput = z.infer<typeof ScheduleUpdateSchema>;
export type ScheduleDeleteInput = z.infer<typeof ScheduleDeleteSchema>;
export type ScheduleChangeStatusInput = z.infer<typeof ScheduleChangeStatusSchema>;
export type ScheduleQueryInput = z.infer<typeof ScheduleQuerySchema>;
