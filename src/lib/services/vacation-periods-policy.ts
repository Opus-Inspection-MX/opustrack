import type { Prisma } from "@prisma/client";
import { holidayRuleMatchesDate } from "@/lib/utils/availability";
import { mxDateString } from "@/lib/utils/datetime";

/** Civil arithmetic uses UTC fields only; the keys themselves are CDMX dates. */
export function vacationCivilDates(start: string, end: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

/** Holiday reads belong to the same serializable snapshot as funding. */
export async function vacationChargedDates(
  start: Date,
  end: Date,
  tx: Prisma.TransactionClient,
): Promise<string[]> {
  const rules = await tx.holiday.findMany({ where: { active: true } });
  return vacationCivilDates(mxDateString(start), mxDateString(end)).filter(
    (date) =>
      new Date(`${date}T00:00:00Z`).getUTCDay() !== 0 &&
      !rules.some((rule) => holidayRuleMatchesDate(rule, date)),
  );
}
