import moment from "moment-timezone";
import { APP_TZ } from "@/lib/utils/datetime";

export interface CalendarVacationWindow {
  cycleYear: number;
  periodNumber: number;
  accrualStart: Date;
  accrualEnd: Date;
  availableFrom: Date;
  graceEnd: Date;
}

/** Pure candidate computation; null means automatic grant creation is blocked. */
export function calendarVacationWindow(
  hireDate: Date | null,
  cycleYear: number,
  graceWindowMonths: number,
): CalendarVacationWindow | null {
  if (
    !hireDate ||
    !Number.isFinite(hireDate.getTime()) ||
    !Number.isInteger(cycleYear) ||
    cycleYear < 1000 ||
    cycleYear > 9998 ||
    !Number.isSafeInteger(graceWindowMonths) ||
    graceWindowMonths < 0
  ) {
    return null;
  }

  const hire = moment(hireDate).tz(APP_TZ);
  const hireYear = hire.year();
  const month = hire.month();
  const day = hire.date();
  // No substitute date for Feb 29 has been approved, even in leap cycles.
  if (cycleYear <= hireYear || (month === 1 && day === 29)) return null;

  const anniversary = moment.tz({ year: cycleYear, month, day }, APP_TZ);
  if (!anniversary.isValid()) return null;

  const start = moment.tz({ year: cycleYear, month: 0, day: 1 }, APP_TZ);
  const end = start.clone().add(1, "year").subtract(1, "day").endOf("day");
  const activation = anniversary.startOf("day");
  // A hire date later in the same CDMX day counts as that calendar day.
  return {
    cycleYear,
    periodNumber: cycleYear - hireYear,
    accrualStart: start.toDate(),
    accrualEnd: end.toDate(),
    availableFrom: activation.toDate(),
    graceEnd: end
      .clone()
      .add(graceWindowMonths, "months")
      .endOf("day")
      .toDate(),
  };
}

/** Calendar grant eligibility only; does not resolve funding or legacy periods. */
export function isCalendarGrantAvailable(
  window: CalendarVacationWindow,
  date: Date,
): boolean {
  return (
    Number.isFinite(date.getTime()) &&
    date >= window.availableFrom &&
    date <= window.graceEnd
  );
}
