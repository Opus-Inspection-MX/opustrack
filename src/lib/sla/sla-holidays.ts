import { getHolidayDatesForYear } from "@/lib/utils/availability";
import { mxDateString } from "@/lib/utils/datetime";

/**
 * Shared holiday set for SLA math (RF-218).
 *
 * `businessDaysBetween` takes a precomputed set so list queries never issue
 * per-row lookups. Callers gather the CDMX years spanned by their rows plus
 * `now` (≤ 2 in practice) and merge one `getHolidayDatesForYear` result per
 * year — a single-digit number of queries per request, not per incident.
 */
export async function getSlaHolidaySet(
  dates: Date[],
  now: Date,
): Promise<Set<string>> {
  const years = new Set<number>();
  for (const date of [...dates, now]) {
    years.add(Number(mxDateString(date).slice(0, 4)));
  }
  const perYear = await Promise.all(
    [...years].map((year) => getHolidayDatesForYear(year)),
  );
  const merged = new Set<string>();
  for (const set of perYear) {
    for (const dateStr of set) merged.add(dateStr);
  }
  return merged;
}
