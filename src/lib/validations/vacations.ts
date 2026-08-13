import { z } from "zod";
import { cuidSchema } from "./common";

/**
 * Schema for creating a vacation request.
 */
export const VacationCreateSchema = z
  .object({
    userId: cuidSchema.optional(),
    startDate: z.date({ message: "La fecha de inicio es obligatoria." }),
    endDate: z.date({ message: "La fecha de fin es obligatoria." }),
    reason: z
      .string()
      .max(1000, "Reason must be at most 1000 characters")
      .optional()
      .nullable(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "La fecha de fin debe ser igual o posterior a la fecha de inicio.",
    path: ["endDate"],
  });

/**
 * Schema for updating a vacation (partial).
 */
export const VacationUpdateSchema = VacationCreateSchema.partial();

// Type inference
export type VacationCreateInput = z.infer<typeof VacationCreateSchema>;
export type VacationUpdateInput = z.infer<typeof VacationUpdateSchema>;

/**
 * Plain FormData type used by server actions (pre-Zod validation layer).
 */
export type VacationFormData = {
  userId?: string;
  startDate: Date;
  endDate: Date;
  reason?: string | null;
  /**
   * Period to charge. When omitted the oldest period covering the range is
   * used, so days closest to expiring are spent first. The calendar always
   * sends the period the user picked, so what the panel shows is what gets
   * charged.
   */
  periodId?: string;
};

/**
 * Validate that endDate is not before startDate.
 * Throws with a Spanish message on failure.
 */
export function validateVacationDates(data: VacationFormData): void {
  if (data.endDate < data.startDate) {
    throw new Error(
      "La fecha de fin debe ser igual o posterior a la fecha de inicio.",
    );
  }
}
