import { z } from "zod";

// IDs
export const cuidSchema = z.string().cuid();
export const intIdSchema = z.number().int().positive();
export const intIdStringSchema = z.string().regex(/^\d+$/).transform(Number);

// Pagination
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

// Sorting
export const sortOrderSchema = z.enum(["asc", "desc"]);

// Common query parameters
export const baseQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  sortOrder: sortOrderSchema.default("desc"),
});

// File uploads
export const base64FileSchema = z.object({
  filename: z.string().min(1, "Filename is required"),
  mimetype: z.string().regex(/^[a-z]+\/[a-z0-9\-+.]+$/i, "Invalid mimetype"),
  base64: z.string().min(1, "File content is required"),
  size: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024, "File size must be less than 10MB"),
});

// Non-empty string
export const nonEmptyStringSchema = z.string().min(1, "This field is required");

// Optional non-empty string (transforms empty string to undefined)
export const optionalStringSchema = z
  .string()
  .optional()
  .transform((val) => (val === "" ? undefined : val));

// Priority (1-10)
export const prioritySchema = z.number().int().min(1).max(10);

// SLA (hours)
export const slaSchema = z.number().int().min(1).max(720); // Max 30 days

// Type exports
export type PaginationInput = z.infer<typeof paginationSchema>;
export type BaseQueryInput = z.infer<typeof baseQuerySchema>;
export type Base64FileInput = z.infer<typeof base64FileSchema>;
