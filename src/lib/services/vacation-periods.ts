import type { Prisma, VacationPeriod } from "@prisma/client";
import moment from "moment-timezone";
import { businessRule } from "@/lib/actions/result";
import { VACATION_STATUS } from "@/lib/constants/status-codes";
import { prisma } from "@/lib/database/prisma.singleton";
import { serializableTransaction } from "@/lib/database/serializable-transaction";
import { APP_TZ } from "@/lib/utils/datetime";
import { calculateHistoricalVacationBalance } from "@/lib/utils/historical-vacation-balance";
import { calendarVacationWindow } from "@/lib/utils/vacation-cycle-window";

/**
 * Vacation periods: earned calendar grants, with preserved legacy accounts.
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
const CONSUMING_STATUSES = [
  VACATION_STATUS.PENDIENTE,
  VACATION_STATUS.APROBADA,
];

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
 *
 * Calendar rows (`cycleYear` set) additionally require the grant to be
 * activated: a date before `availableFrom` (the hire anniversary) cannot be
 * funded by that cycle, even inside its Jan–Dec accrual window. A calendar
 * row without an activation instant is never requestable (fail closed).
 * Legacy anniversary rows (`cycleYear` null) keep the original check.
 */
export function isPeriodRequestable(
  period: VacationPeriod,
  date: Date,
): boolean {
  if (period.cycleYear !== null && period.cycleYear !== undefined) {
    if (!period.availableFrom) return false;
    return (
      date >= period.accrualStart &&
      date <= period.graceEnd &&
      date >= period.availableFrom
    );
  }
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
 * Accounts without legacy rows use calendar grants earned on anniversaries.
 * Legacy-only accounts remain in their original mode. Mixed accounts require
 * explicit reconciliation and cannot generate or fund requests.
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
  if (client === prisma)
    return serializableTransaction((tx) => ensurePeriodsUpToNow(userId, tx));
  const user = await client.user.findUnique({
    where: { id: userId },
    select: { hireDate: true },
  });

  if (!user?.hireDate) return [];

  const existing = await client.vacationPeriod.findMany({
    where: { userId },
    orderBy: { periodNumber: "asc" },
  });
  const hasCalendar = existing.some((period) => period.cycleYear != null);
  const hasLegacy = existing.some((period) => period.cycleYear == null);
  if (hasCalendar && hasLegacy) {
    businessRule(
      "El usuario tiene períodos calendario y heredados mezclados. Concilia su historial antes de generar o solicitar vacaciones.",
    );
  }
  if (!hasLegacy) {
    return ensureCalendarPeriodsForUser(userId, {}, client);
  }

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
 * Create the calendar-cycle grants a user has earned up to `upToCycleYear`.
 *
 * Each grant covers one shared CDMX cycle (Jan 1–Dec 31) and becomes
 * spendable only on that cycle's hire anniversary (`availableFrom`). Tier and
 * `periodNumber` equal completed service years (`cycleYear - hireYear`); the
 * hire year itself never grants. Only anniversaries already reached produce
 * rows. Legacy accounts require explicit reconciliation before calendar use.
 *
 * Fail-closed skips (no substitute rows): missing hire date, a cycle at or
 * before the hire year, an anniversary not yet reached,
 * and a service tier no accrual rule covers. A legacy row holding the same
 * `(userId, periodNumber)` with a different calendar identity is a
 * reconciliation conflict, reported loudly instead of converted: the upsert
 * key is `(userId, cycleYear)` with an empty `update`, so re-running this
 * can never re-snapshot a window or an admin override.
 *
 * Returns the user's calendar periods ordered oldest-first. Empty when no
 * hire date is set.
 */
export async function ensureCalendarPeriodsForUser(
  userId: string,
  options: { upToCycleYear?: number } = {},
  client: TxClient = prisma,
): Promise<VacationPeriod[]> {
  if (client === prisma)
    return serializableTransaction((tx) =>
      ensureCalendarPeriodsForUser(userId, options, tx),
    );
  const user = await client.user.findUnique({
    where: { id: userId },
    select: { hireDate: true },
  });

  if (!user?.hireDate) return [];

  const hireYear = moment(user.hireDate).tz(APP_TZ).year();
  const upToCycleYear = options.upToCycleYear ?? moment().tz(APP_TZ).year();
  const existing = await client.vacationPeriod.findMany({ where: { userId } });
  if (existing.some((period) => period.cycleYear == null)) {
    businessRule(
      "El usuario tiene períodos heredados. Concilia su historial antes de crear ciclos calendario.",
    );
  }
  const graceWindowMonths = await getGraceWindowMonths(client);

  const grants: {
    cycleYear: number;
    periodNumber: number;
    ruleDays: number;
    accrualStart: Date;
    accrualEnd: Date;
    availableFrom: Date;
    graceEnd: Date;
  }[] = [];
  for (
    let cycleYear = hireYear + 1;
    cycleYear <= upToCycleYear;
    cycleYear += 1
  ) {
    const window = calendarVacationWindow(
      user.hireDate,
      cycleYear,
      graceWindowMonths,
    );
    if (!window) continue;
    if (window.availableFrom > new Date()) continue;
    const ruleDays = await resolveRuleDays(client, window.periodNumber);
    // No tier covers this year of service — leave the gap visible.
    if (ruleDays === null) continue;
    grants.push({ ...window, ruleDays });
  }

  // Validate every identity before writing any row: a partial run that stops
  // on a conflict must not leave half a cycle behind.
  for (const grant of grants) {
    const clash = await client.vacationPeriod.findFirst({
      where: { userId, periodNumber: grant.periodNumber },
      select: { id: true, cycleYear: true },
    });
    if (clash && clash.cycleYear !== grant.cycleYear) {
      businessRule(
        `El usuario ya tiene un período ${grant.periodNumber} con otra identidad de ciclo. Revisa la conciliación antes de crear el ciclo ${grant.cycleYear}.`,
      );
    }
  }

  for (const grant of grants) {
    await client.vacationPeriod.upsert({
      where: { userId_cycleYear: { userId, cycleYear: grant.cycleYear } },
      // Empty on purpose: never re-snapshot or overwrite an existing period.
      update: {},
      create: {
        userId,
        periodNumber: grant.periodNumber,
        cycleYear: grant.cycleYear,
        ruleDays: grant.ruleDays,
        accrualStart: grant.accrualStart,
        accrualEnd: grant.accrualEnd,
        availableFrom: grant.availableFrom,
        graceEnd: grant.graceEnd,
      },
    });
  }

  return client.vacationPeriod.findMany({
    where: { userId, cycleYear: { not: null } },
    orderBy: { cycleYear: "asc" },
  });
}

/**
 * Days granted, reserved and left for a period.
 *
 * `usedDays` sums the snapshotted cost of every request that still holds days
 * plus every APPROVED, identity-verified historical aggregate linked to this
 * period. A PENDIENTE request reserves them the moment it is created, which is
 * why approving one consumes nothing new and rejecting one frees them again —
 * no balance re-check is needed at approval time.
 *
 * Periods with no linked historical rows compute exactly as before: the
 * ledger query finds nothing and the legacy aggregate arithmetic runs
 * untouched. With ledger rows present, the full reviewed-balance semantics
 * apply — overdraw and inconsistent inputs throw instead of returning a
 * negative balance.
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
      status: { code: { in: CONSUMING_STATUSES } },
    },
    _sum: { businessDaysUsed: true },
  });
  const reservedDays = aggregate._sum.businessDaysUsed ?? 0;

  const historicalRows = await client.historicalVacationConsumption.findMany({
    where: { fundingPeriodId: periodId },
  });
  if (historicalRows.length === 0) {
    const allottedDays = allottedDaysFor(period);
    return {
      allottedDays,
      usedDays: reservedDays,
      remainingDays: allottedDays - reservedDays,
    };
  }

  // A ledger row can only reference a calendar period (its composite FK
  // carries a non-null cycleYear), so history on a legacy row is corruption.
  if (period.cycleYear === null || period.cycleYear === undefined) {
    throw new Error(
      `VacationPeriod ${periodId} has historical consumption without a calendar cycle`,
    );
  }

  const reservations = await client.vacation.findMany({
    where: { periodId, active: true },
    include: { status: { select: { code: true } } },
  });

  return calculateHistoricalVacationBalance({
    periodId: period.id,
    userId: period.userId,
    cycleYear: period.cycleYear,
    ruleDays: period.ruleDays,
    overrideDays: period.overrideDays,
    historical: historicalRows.map((row) => ({
      userId: row.userId,
      cycleYear: row.cycleYear,
      fundingPeriodId: row.fundingPeriodId,
      identityVerified: row.identityVerified,
      reviewStatus: row.reviewStatus,
      sourceDigest: row.sourceDigest,
      sourceSheet: row.sourceSheet,
      sourceRow: row.sourceRow,
      sourceEntitledDays: row.sourceEntitledDays,
      sourceTakenDays: row.sourceTakenDays,
      sourceRemainingDays: row.sourceRemainingDays,
      allocatedToDatedDays: row.allocatedToDatedDays,
    })),
    reservations: reservations.map((vacation) => ({
      id: vacation.id,
      userId: vacation.userId,
      periodId: vacation.periodId,
      active: vacation.active,
      status: vacation.status.code as "PENDIENTE" | "APROBADA" | "RECHAZADA",
      businessDaysUsed: vacation.businessDaysUsed,
    })),
  });
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
 * panel and wins when it fits and can pay. Otherwise the earliest-expiring
 * fitting grant with enough remaining balance funds the whole range.
 *
 * Calendar rows participate through the same rule: a range before a cycle's
 * anniversary cannot be funded by that cycle (it is not requestable there),
 * so it falls back to a still-valid prior grant. Lazy generation respects the
 * account's existing mode and never converts legacy identities.
 */
export async function resolveVacationPeriod(
  userId: string,
  startDate: Date,
  endDate: Date,
  client: TxClient = prisma,
  preferredPeriodId?: string,
  requiredDays = 0,
): Promise<VacationPeriod> {
  const periods = await ensurePeriodsUpToNow(userId, client);

  if (periods.length === 0) {
    businessRule(
      "El usuario no tiene períodos disponibles. Revisa la fecha de contratación, el primer aniversario y las reglas de acumulación.",
    );
  }

  const fits = (period: VacationPeriod) =>
    (period.cycleYear == null ||
      (period.availableFrom != null && period.availableFrom <= new Date())) &&
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
    if (
      requiredDays > 0 &&
      (await getPeriodBalance(preferred.id, client)).remainingDays <
        requiredDays
    ) {
      businessRule(
        "El período seleccionado no tiene saldo suficiente para el rango completo.",
      );
    }
    return preferred;
  }

  const candidates = periods
    .filter(fits)
    .sort(
      (a, b) =>
        a.graceEnd.getTime() - b.graceEnd.getTime() ||
        a.periodNumber - b.periodNumber ||
        a.id.localeCompare(b.id),
    );
  for (const candidate of candidates) {
    if (
      requiredDays === 0 ||
      (await getPeriodBalance(candidate.id, client)).remainingDays >=
        requiredDays
    )
      return candidate;
  }
  if (candidates.length > 0) {
    businessRule(
      "Ningún período vigente tiene saldo suficiente para financiar el rango completo. Selecciona otras fechas o solicita un ajuste de saldo.",
    );
  }

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
 * only when it stays non-destructive: `overrideDays` and the `ruleDays`
 * snapshot survive, and every existing request must still fall inside its
 * period afterwards. If any would be left stranded, nothing is written and
 * the admin is told which one, so the vacation can be sorted out first.
 *
 * Calendar rows are recomputed as Jan 1–Dec 31 windows with a fresh
 * anniversary activation; legacy rows keep their anniversary windows.
 * Neither identity is ever rewritten: `periodNumber`, `cycleYear` and
 * `userId` stay frozen, which is what keeps the historical-ledger FK
 * (`fundingPeriodId`, `userId`, `cycleYear`) intact. Deleting a period that
 * still holds active vacations or historical consumption rows is refused for
 * both row kinds, and no hire date is ever inferred — an invalid date fails
 * closed before anything is read.
 */
export async function recomputePeriodsForNewHireDate(
  userId: string,
  newHireDate: Date,
  client: TxClient = prisma,
): Promise<void> {
  if (!newHireDate || !Number.isFinite(newHireDate.getTime())) {
    businessRule("La nueva fecha de contratación no es válida.");
  }

  const existing = await client.vacationPeriod.findMany({
    where: { userId },
    include: {
      vacations: {
        select: { id: true, startDate: true, endDate: true, reason: true },
      },
      historicalConsumption: { select: { id: true } },
    },
  });

  if (existing.length === 0) return;

  const total = periodsElapsed(newHireDate);

  // Validate every period before writing any window.
  const planned: {
    periodId: string;
    drop: boolean;
    legacyWindow: {
      accrualStart: Date;
      accrualEnd: Date;
      graceEnd: Date;
    } | null;
    calendarWindow: {
      accrualStart: Date;
      accrualEnd: Date;
      availableFrom: Date;
      graceEnd: Date;
    } | null;
  }[] = [];
  for (const period of existing) {
    // A hire-date correction must not adopt a later global grace policy.
    const graceWindowMonths = moment(period.graceEnd)
      .tz(APP_TZ)
      .diff(moment(period.accrualEnd).tz(APP_TZ), "months");
    const historicalCount = period.historicalConsumption?.length ?? 0;
    // The corrected date no longer reaches this period at all.
    if (period.periodNumber > total) {
      if (period.vacations.length > 0) {
        businessRule(
          `La nueva fecha de contratación elimina el período ${period.periodNumber}, que tiene ${period.vacations.length} solicitud(es) de vacaciones. Elimina o reasigna esas solicitudes primero.`,
        );
      }
      if (historicalCount > 0) {
        businessRule(
          `La nueva fecha de contratación elimina el período ${period.periodNumber}, que tiene consumo histórico de vacaciones registrado. Concilia ese consumo antes de corregir la fecha.`,
        );
      }
      planned.push({
        periodId: period.id,
        drop: true,
        legacyWindow: null,
        calendarWindow: null,
      });
      continue;
    }

    if (period.cycleYear === null || period.cycleYear === undefined) {
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
      planned.push({
        periodId: period.id,
        drop: false,
        legacyWindow: window,
        calendarWindow: null,
      });
      continue;
    }

    const calendar = calendarVacationWindow(
      newHireDate,
      period.cycleYear,
      graceWindowMonths,
    );
    // Cycles at/before the new hire year cannot have an earned grant.
    if (!calendar) {
      businessRule(
        `La nueva fecha de contratación no permite recalcular el período del ciclo ${period.cycleYear}. Revisa la fecha antes de corregirla.`,
      );
    }
    if (calendar.periodNumber !== period.periodNumber) {
      businessRule(
        "La nueva fecha de contratación cambia la identidad de un ciclo calendario. Concilia los períodos antes de corregir la fecha.",
      );
    }
    // A funded request must stay on/after the activation its grant was
    // created with, not just inside the Jan–Dec window.
    const stranded = period.vacations.find(
      (vacation) =>
        vacation.startDate < calendar.availableFrom ||
        vacation.endDate > calendar.graceEnd,
    );
    if (stranded) {
      businessRule(
        `La nueva fecha de contratación dejaría fuera del período del ciclo ${period.cycleYear} una solicitud de vacaciones existente. Ajusta o elimina esa solicitud antes de corregir la fecha.`,
      );
    }
    planned.push({
      periodId: period.id,
      drop: false,
      legacyWindow: null,
      calendarWindow: {
        accrualStart: calendar.accrualStart,
        accrualEnd: calendar.accrualEnd,
        availableFrom: calendar.availableFrom,
        graceEnd: calendar.graceEnd,
      },
    });
  }

  // Every period checks out — apply the new windows, keeping overrideDays,
  // ruleDays and both period identities untouched.
  for (const item of planned) {
    if (item.drop) {
      await client.vacationPeriod.delete({ where: { id: item.periodId } });
      continue;
    }

    if (item.calendarWindow) {
      await client.vacationPeriod.update({
        where: { id: item.periodId },
        data: item.calendarWindow,
      });
      continue;
    }

    if (item.legacyWindow) {
      await client.vacationPeriod.update({
        where: { id: item.periodId },
        data: item.legacyWindow,
      });
    }
  }
}
