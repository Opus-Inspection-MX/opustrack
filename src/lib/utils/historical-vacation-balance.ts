/** Offline arithmetic only. Callers must verify identities and funding links;
 * this module does not look up users, infer hire dates or create requests. */
export interface HistoricalEntry {
  userId: string;
  cycleYear: number;
  fundingPeriodId: string | null;
  identityVerified: boolean;
  reviewStatus: "PENDING" | "APPROVED" | "REJECTED";
  sourceDigest: string;
  sourceSheet: string;
  sourceRow: number;
  sourceEntitledDays: number;
  sourceTakenDays: number;
  sourceRemainingDays: number;
  allocatedToDatedDays: number;
}

export interface DatedReservation {
  id: string;
  userId: string;
  periodId: string | null;
  active: boolean;
  status: "PENDIENTE" | "APROBADA" | "RECHAZADA";
  businessDaysUsed: number | null;
}

export interface HistoricalBalanceInput {
  periodId: string;
  userId: string;
  cycleYear: number;
  ruleDays: number;
  overrideDays: number | null;
  historical: readonly HistoricalEntry[];
  reservations: readonly DatedReservation[];
}

function nonnegative(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function requireValid(condition: boolean): void {
  if (!condition) throw new Error("Invalid historical vacation balance input");
}

/** Idempotent identical source keys, but never merge two sources for a cycle. */
export function calculateHistoricalVacationBalance(
  input: HistoricalBalanceInput,
): {
  allottedDays: number;
  usedDays: number;
  remainingDays: number;
} {
  requireValid(
    !!input.periodId &&
      !!input.userId &&
      Number.isSafeInteger(input.cycleYear) &&
      input.cycleYear >= 1000 &&
      input.cycleYear <= 9998 &&
      nonnegative(input.ruleDays) &&
      (input.overrideDays === null || nonnegative(input.overrideDays)),
  );

  const bySource = new Map<string, HistoricalEntry>();
  const byCycle = new Set<string>();
  let historicalUsed = 0;
  for (const row of input.historical) {
    requireValid(
      !!row.userId &&
        Number.isSafeInteger(row.cycleYear) &&
        row.cycleYear >= 1000 &&
        row.cycleYear <= 9998 &&
        /^[0-9a-f]{64}$/.test(row.sourceDigest) &&
        !!row.sourceSheet &&
        Number.isSafeInteger(row.sourceRow) &&
        row.sourceRow > 0 &&
        nonnegative(row.sourceEntitledDays) &&
        nonnegative(row.sourceTakenDays) &&
        nonnegative(row.sourceRemainingDays) &&
        row.allocatedToDatedDays === 0 &&
        ["PENDING", "APPROVED", "REJECTED"].includes(row.reviewStatus),
    );
    const sourceKey = JSON.stringify([
      row.sourceDigest,
      row.sourceSheet,
      row.sourceRow,
    ]);
    const previous = bySource.get(sourceKey);
    if (previous) {
      requireValid(
        previous.userId === row.userId &&
          previous.cycleYear === row.cycleYear &&
          previous.fundingPeriodId === row.fundingPeriodId &&
          previous.identityVerified === row.identityVerified &&
          previous.reviewStatus === row.reviewStatus &&
          previous.sourceEntitledDays === row.sourceEntitledDays &&
          previous.sourceTakenDays === row.sourceTakenDays &&
          previous.sourceRemainingDays === row.sourceRemainingDays &&
          previous.allocatedToDatedDays === row.allocatedToDatedDays,
      );
      continue;
    }
    bySource.set(sourceKey, row);
    const cycleKey = JSON.stringify([row.userId, row.cycleYear]);
    requireValid(!byCycle.has(cycleKey));
    byCycle.add(cycleKey);
    requireValid(
      row.userId === input.userId && row.cycleYear === input.cycleYear,
    );
    if (row.reviewStatus !== "APPROVED") {
      continue;
    }
    requireValid(
      row.identityVerified &&
        row.fundingPeriodId === input.periodId &&
        row.sourceEntitledDays >= row.sourceTakenDays &&
        row.sourceEntitledDays - row.sourceTakenDays ===
          row.sourceRemainingDays,
    );
    historicalUsed += row.sourceTakenDays;
  }

  const requestIds = new Set<string>();
  let reserved = 0;
  for (const request of input.reservations) {
    requireValid(!!request.id && !requestIds.has(request.id));
    requestIds.add(request.id);
    requireValid(
      request.userId === input.userId &&
        request.periodId === input.periodId &&
        ["PENDIENTE", "APROBADA", "RECHAZADA"].includes(request.status) &&
        (request.businessDaysUsed === null ||
          nonnegative(request.businessDaysUsed)),
    );
    if (!request.active || request.status === "RECHAZADA") continue;
    if (
      request.businessDaysUsed === null ||
      !nonnegative(request.businessDaysUsed)
    ) {
      throw new Error("Invalid historical vacation balance input");
    }
    reserved += request.businessDaysUsed;
  }
  const allottedDays = input.overrideDays ?? input.ruleDays;
  const usedDays = historicalUsed + reserved;
  requireValid(Number.isSafeInteger(usedDays) && usedDays <= allottedDays);
  return { allottedDays, usedDays, remainingDays: allottedDays - usedDays };
}
