import { z } from "zod";
import { cuidSchema, baseQuerySchema } from "./common";

/**
 * Schema for creating a part
 */
export const PartCreateSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(200, "Name must be at most 200 characters"),
  description: z.string().max(1000, "Description must be at most 1000 characters").optional(),
  price: z.number().positive("Price must be positive"),
  stock: z.number().int().min(0, "Stock cannot be negative"),
  vicId: cuidSchema,
});

/**
 * Schema for updating a part
 */
export const PartUpdateSchema = PartCreateSchema.partial().extend({
  id: cuidSchema,
});

/**
 * Schema for deleting a part
 */
export const PartDeleteSchema = z.object({
  id: cuidSchema,
});

/**
 * Schema for creating a work part (linking part to work order)
 */
export const WorkPartCreateSchema = z.object({
  workOrderId: cuidSchema.optional(),
  workActivityId: cuidSchema.optional(),
  partId: cuidSchema,
  quantity: z.number().int().positive("Quantity must be at least 1"),
  description: z.string().max(500, "Description must be at most 500 characters").optional(),
});

/**
 * Schema for updating a work part
 */
export const WorkPartUpdateSchema = z.object({
  id: cuidSchema,
  quantity: z.number().int().positive("Quantity must be at least 1").optional(),
  description: z.string().max(500, "Description must be at most 500 characters").optional(),
});

/**
 * Schema for deleting a work part
 */
export const WorkPartDeleteSchema = z.object({
  id: cuidSchema,
});

/**
 * Schema for querying parts
 */
export const PartQuerySchema = baseQuerySchema.extend({
  vicId: z.string().cuid().optional(),
  minStock: z.coerce.number().int().min(0).optional(),
  maxStock: z.coerce.number().int().optional(),
  sortBy: z.enum(["name", "price", "stock", "createdAt"]).default("name"),
});

// Type inference
export type PartCreateInput = z.infer<typeof PartCreateSchema>;
export type PartUpdateInput = z.infer<typeof PartUpdateSchema>;
export type PartDeleteInput = z.infer<typeof PartDeleteSchema>;
export type WorkPartCreateInput = z.infer<typeof WorkPartCreateSchema>;
export type WorkPartUpdateInput = z.infer<typeof WorkPartUpdateSchema>;
export type WorkPartDeleteInput = z.infer<typeof WorkPartDeleteSchema>;
export type PartQueryInput = z.infer<typeof PartQuerySchema>;
