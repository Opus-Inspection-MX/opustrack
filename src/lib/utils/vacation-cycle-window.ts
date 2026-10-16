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
  let day = hire.date();
  if (cycleYear <= hireYear) return null;
  if (month === 1 && day === 29 && !moment([cycleYear]).isLeapYear()) day = 28;

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

/** Missing calendar activation is blocked, including imported future grants. */
export function isVacationPeriodUsable(
  period: {
    cycleYear: number | null;
    availableFrom: Date | string | null;
    graceEnd: Date | string;
    remainingDays: number;
    isExpired: boolean;
    importBlocked?: boolean;
  },
  now = new Date(),
): boolean {
  if (
    period.importBlocked ||
    period.isExpired ||
    period.remainingDays <= 0 ||
    new Date(period.graceEnd) < now
  )
    return false;
  if (period.cycleYear != null) {
    return (
      period.availableFrom != null && new Date(period.availableFrom) <= now
    );
  }
  return true;
}

/** Earned service-year grant; leap anniversaries are resolved independently. */
export function anniversaryVacationWindow(
  hireDate: Date | null,
  cycleYear: number,
  graceWindowMonths: number,
): CalendarVacationWindow | null {
  const current = calendarVacationWindow(
    hireDate,
    cycleYear,
    graceWindowMonths,
  );
  const next = calendarVacationWindow(hireDate, cycleYear + 1, 0);
  if (!current || !next) return null;
  const end = moment(next.availableFrom)
    .tz(APP_TZ)
    .subtract(1, "day")
    .endOf("day");
  return {
    ...current,
    accrualStart: current.availableFrom,
    accrualEnd: end.toDate(),
    graceEnd: end
      .clone()
      .add(graceWindowMonths, "months")
      .endOf("day")
      .toDate(),
  };
}
