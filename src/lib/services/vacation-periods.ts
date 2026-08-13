import type { Prisma, VacationPeriod } from "@prisma/client";
import moment from "moment-timezone";
import { businessRule } from "@/lib/actions/result";
import { prisma } from "@/lib/database/prisma.singleton";
import { APP_TZ } from "@/lib/utils/datetime";

/**
 * Vacation periods: one anniversary year of service per user.
 *
 * A period is the unit days are earned and spent in. It carries a snapshot of
 * the accrual rule and the grace window as they stood the day it was created,
 * so later edits to either catalog can never retroactively resize a window a
 * user already has approved vacations inside.
 *
 * The balance is always DERIVED, never stored — see `getPeriodBalance`. That is
 * what makes raising `overrideDays` safe: it can only ever increase what is
 * available, and it never touches a Vacation row.
 *
 * This is a plain service module, not a Server Action: it is called both from
 * actions and from server components, sometimes inside a transaction.
 */

type TxClient = Prisma.TransactionClient | typeof prisma;

/** Statuses that reserve days. RECHAZADA frees them again by dropping out. */
const CONSUMING_STATUSES = ["PENDIENTE", "APROBADA"];

export interface PeriodBalance {
  allottedDays: number;
  usedDays: number;
  remainingDays: number;
}

/** Days a period grants: the admin override when set, otherwise the rule. */
export function allottedDaysFor(period: VacationPeriod): number {
  return period.overrideDays ?? period.ruleDays;
}

/**
 * Whether `date` falls inside the window during which a period's days can
 * still be requested: from the start of accrual through the end of grace.
 */
export function isPeriodRequestable(
  period: VacationPeriod,
  date: Date,
): boolean {
  return date >= period.accrualStart && date <= period.graceEnd;
}

/** The configured grace window, falling back to the schema default. */
async function getGraceWindowMonths(client: TxClient): Promise<number> {
  const setting = await client.vacationSetting.findUnique({ where: { id: 1 } });
  return setting?.graceWindowMonths ?? 12;
}

/**
 * Window boundaries for the Nth year of service, as CDMX day edges.
 *
 * Period 1 runs from the hire date to the day before the first anniversary;
 * grace extends past that by the configured number of months.
 */
function computeWindow(
  hireDate: Date,
  periodNumber: number,
  graceWindowMonths: number,
): { accrualStart: Date; accrualEnd: Date; graceEnd: Date } {
  const hire = moment(hireDate).tz(APP_TZ).startOf("day");

  const accrualStart = hire.clone().add(periodNumber - 1, "years");
  const accrualEnd = accrualStart
    .clone()
    .add(1, "year")
    .subtract(1, "day")
    .endOf("day");
  const graceEnd = accrualEnd
    .clone()
    .add(graceWindowMonths, "months")
    .endOf("day");

  return {
    accrualStart: accrualStart.toDate(),
    accrualEnd: accrualEnd.toDate(),
    graceEnd: graceEnd.toDate(),
  };
}

/** How many anniversary periods a hire date has reached, including the current one. */
function periodsElapsed(hireDate: Date, reference: Date = new Date()): number {
  const hire = moment(hireDate).tz(APP_TZ).startOf("day");
  const now = moment(reference).tz(APP_TZ).startOf("day");
  if (now.isBefore(hire)) return 0;
  return now.diff(hire, "years") + 1;
}

/**
 * Entitlement for the Nth year of service, or null when no rule covers it.
 *
 * Returning null rather than guessing keeps a missing tier visible: the period
 * is not created and the UI says so, instead of silently inventing a number.
 */
async function resolveRuleDays(
  client: TxClient,
  yearsOfService: number,
): Promise<number | null> {
  const rule = await client.vacationAccrualRule.findFirst({
    where: {
      active: true,
      minYears: { lte: yearsOfService },
      OR: [{ maxYears: null }, { maxYears: { gte: yearsOfService } }],
    },
    orderBy: { minYears: "desc" },
  });

  return rule?.days ?? null;
}

/**
 * Create any periods the user has reached but does not have rows for yet.
 *
 * Idempotent by design: the upsert's empty `update` means re-running this on
 * every page load can never clobber an admin's `overrideDays` or re-snapshot a
 * window that already governs approved vacations. There is no job runner in
 * this app, so this is what keeps periods current — called when a hire date is
 * first set and lazily whenever balances are read.
 *
 * Returns the user's periods ordered oldest-first. Empty when no hire date is
 * set; callers decide how to surface that.
 */
export async function ensurePeriodsUpToNow(
  userId: string,
  client: TxClient = prisma,
): Promise<VacationPeriod[]> {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: { hireDate: true },
  });

  if (!user?.hireDate) return [];

  const total = periodsElapsed(user.hireDate);
  const graceWindowMonths = await getGraceWindowMonths(client);

  for (let periodNumber = 1; periodNumber <= total; periodNumber += 1) {
    const ruleDays = await resolveRuleDays(client, periodNumber);
    // No tier covers this year of service — leave the gap visible.
    if (ruleDays === null) continue;

    const window = computeWindow(
      user.hireDate,
      periodNumber,
      graceWindowMonths,
    );

    await client.vacationPeriod.upsert({
      where: { userId_periodNumber: { userId, periodNumber } },
      // Empty on purpose: never re-snapshot or overwrite an existing period.
      update: {},
      create: { userId, periodNumber, ruleDays, ...window },
    });
  }

  return client.vacationPeriod.findMany({
    where: { userId },
    orderBy: { periodNumber: "asc" },
  });
}

/**
 * Days granted, reserved and left for a period.
 *
 * `usedDays` sums the snapshotted cost of every request that still holds days.
 * A PENDIENTE request reserves them the moment it is created, which is why
 * approving one consumes nothing new and rejecting one frees them again — no
 * balance re-check is needed at approval time.
 */
export async function getPeriodBalance(
  periodId: string,
  client: TxClient = prisma,
): Promise<PeriodBalance> {
  const period = await client.vacationPeriod.findUnique({
    where: { id: periodId },
  });
  if (!period) {
    throw new Error(`VacationPeriod ${periodId} not found`);
  }

  const aggregate = await client.vacation.aggregate({
    where: {
      periodId,
      active: true,
      status: { name: { in: CONSUMING_STATUSES } },
    },
    _sum: { businessDaysUsed: true },
  });

  const allottedDays = allottedDaysFor(period);
  const usedDays = aggregate._sum.businessDaysUsed ?? 0;

  return { allottedDays, usedDays, remainingDays: allottedDays - usedDays };
}

/**
 * The period a requested range belongs to.
 *
 * A range must sit entirely inside one period's requestable window. Spanning
 * two of them is rejected rather than split, because the days would have to be
 * charged against two different balances with two different expiry dates.
 *
 * Accrual and grace windows overlap, so a range often fits more than one
 * period. `preferredPeriodId` is the period the user picked in the balance
 * panel and wins when it fits — otherwise the oldest fitting period is used, so
 * the days closest to expiring are spent first.
 */
export async function resolveVacationPeriod(
  userId: string,
  startDate: Date,
  endDate: Date,
  client: TxClient = prisma,
  preferredPeriodId?: string,
): Promise<VacationPeriod> {
  const periods = await ensurePeriodsUpToNow(userId, client);

  if (periods.length === 0) {
    businessRule(
      "El usuario no tiene fecha de contratación registrada. Un administrador debe configurarla antes de solicitar vacaciones.",
    );
  }

  const fits = (period: VacationPeriod) =>
    isPeriodRequestable(period, startDate) &&
    isPeriodRequestable(period, endDate);

  if (preferredPeriodId) {
    const preferred = periods.find((period) => period.id === preferredPeriodId);
    if (!preferred) {
      businessRule("El período vacacional seleccionado no existe.");
    }
    if (!fits(preferred)) {
      businessRule(
        `Las fechas solicitadas están fuera de la vigencia del período ${preferred.periodNumber}. Selecciona otro período o ajusta las fechas.`,
      );
    }
    return preferred;
  }

  const match = periods.find(fits);
  if (match) return match;

  // Distinguish "crosses a boundary" from "outside every window": the first is
  // a fixable mistake, the second usually means the dates are simply wrong.
  const startPeriod = periods.find((period) =>
    isPeriodRequestable(period, startDate),
  );
  const endPeriod = periods.find((period) =>
    isPeriodRequestable(period, endDate),
  );

  if (startPeriod && endPeriod && startPeriod.id !== endPeriod.id) {
    businessRule(
      `El rango abarca dos períodos vacacionales (año ${startPeriod.periodNumber} y año ${endPeriod.periodNumber}). Divide la solicitud en una por período.`,
    );
  }

  businessRule(
    "Las fechas solicitadas no caen dentro de ningún período vacacional vigente. Revisa que el período no haya vencido.",
  );
}

/**
 * Move a user's periods onto a corrected hire date.
 *
 * Admins do mistype hire dates, so this is allowed rather than frozen — but
 * only when it stays non-destructive: `overrideDays` survives, and every
 * existing request must still fall inside its period afterwards. If any would
 * be left stranded, nothing is written and the admin is told which one, so the
 * vacation can be sorted out first.
 */
export async function recomputePeriodsForNewHireDate(
  userId: string,
  newHireDate: Date,
  client: TxClient = prisma,
): Promise<void> {
  const existing = await client.vacationPeriod.findMany({
    where: { userId },
    include: {
      vacations: {
        where: { active: true },
        select: { id: true, startDate: true, endDate: true, reason: true },
      },
    },
  });

  if (existing.length === 0) return;

  const graceWindowMonths = await getGraceWindowMonths(client);
  const total = periodsElapsed(newHireDate);

  for (const period of existing) {
    // The corrected date no longer reaches this period at all.
    if (period.periodNumber > total) {
      if (period.vacations.length > 0) {
        businessRule(
          `La nueva fecha de contratación elimina el período ${period.periodNumber}, que tiene ${period.vacations.length} solicitud(es) de vacaciones. Elimina o reasigna esas solicitudes primero.`,
        );
      }
      continue;
    }

    const window = computeWindow(
      newHireDate,
      period.periodNumber,
      graceWindowMonths,
    );

    const stranded = period.vacations.find(
      (vacation) =>
        vacation.startDate < window.accrualStart ||
        vacation.endDate > window.graceEnd,
    );
    if (stranded) {
      businessRule(
        `La nueva fecha de contratación dejaría fuera del período ${period.periodNumber} una solicitud de vacaciones existente. Ajusta o elimina esa solicitud antes de corregir la fecha.`,
      );
    }
  }

  // Every period checks out — apply the new windows, keeping overrideDays.
  for (const period of existing) {
    if (period.periodNumber > total) {
      await client.vacationPeriod.delete({ where: { id: period.id } });
      continue;
    }

    const window = computeWindow(
      newHireDate,
      period.periodNumber,
      graceWindowMonths,
    );
    await client.vacationPeriod.update({
      where: { id: period.id },
      data: window,
    });
  }
}
