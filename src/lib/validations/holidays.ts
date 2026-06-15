import { z } from "zod";

/**
 * Schema for creating or updating a holiday rule.
 *
 * Constraint: exactly one of `day` or `nthMonday` must be set (XOR).
 * One-time sexennial rule: isRecurring=false requires year to be set.
 */
export const HolidayCreateSchema = z
  .object({
    name: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(200, "Name must be at most 200 characters"),
    month: z
      .number()
      .int()
      .min(1, "Month must be between 1 and 12")
      .max(12, "Month must be between 1 and 12"),
    day: z.number().int().min(1).max(31).optional().nullable(),
    nthMonday: z.number().int().min(1).max(5).optional().nullable(),
    isRecurring: z.boolean().default(true),
    year: z.number().int().min(2000).max(2100).optional().nullable(),
    active: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    const hasDay = data.day !== undefined && data.day !== null;
    const hasNthMonday =
      data.nthMonday !== undefined && data.nthMonday !== null;

    if (hasDay && hasNthMonday) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Only one of 'day' or 'nthMonday' may be set, not both.",
        path: ["day"],
      });
    }

    if (!hasDay && !hasNthMonday) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Either 'day' (fixed date) or 'nthMonday' must be set.",
        path: ["day"],
      });
    }

    if (!data.isRecurring && (data.year === undefined || data.year === null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Year is required for one-time (non-recurring) holidays.",
        path: ["year"],
      });
    }
  });

/**
 * Schema for updating a holiday (all fields optional except the id guard).
 */
export const HolidayUpdateSchema = HolidayCreateSchema.partial();

// Type inference
export type HolidayCreateInput = z.infer<typeof HolidayCreateSchema>;
export type HolidayUpdateInput = z.infer<typeof HolidayUpdateSchema>;

/**
 * Plain FormData type used by server actions (pre-Zod validation layer).
 */
export type HolidayFormData = {
  name: string;
  month: number;
  day?: number | null;
  nthMonday?: number | null;
  isRecurring: boolean;
  year?: number | null;
};

/**
 * Validate that the day/nthMonday XOR constraint is satisfied and that
 * a one-time holiday has a year. Throws with a Spanish message on failure.
 */
export function validateHolidayXOR(data: HolidayFormData): void {
  const hasDay = data.day !== undefined && data.day !== null;
  const hasNthMonday = data.nthMonday !== undefined && data.nthMonday !== null;

  if (hasDay && hasNthMonday) {
    throw new Error(
      "Solo se puede especificar 'día fijo' o 'lunes N' en un festivo, no ambos.",
    );
  }

  if (!hasDay && !hasNthMonday) {
    throw new Error(
      "Debe especificar un día fijo o un lunes N para el festivo.",
    );
  }

  if (!data.isRecurring && (data.year === undefined || data.year === null)) {
    throw new Error(
      "Los festivos de ocurrencia única requieren especificar el año.",
    );
  }
}
