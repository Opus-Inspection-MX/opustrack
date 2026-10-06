import { describe, expect, it } from "vitest";
import {
  calculateHistoricalVacationBalance as calculate,
  type HistoricalBalanceInput,
} from "./historical-vacation-balance";

const entry = {
  userId: "verified-user",
  cycleYear: 2026,
  fundingPeriodId: "reviewed-period",
  identityVerified: true,
  reviewStatus: "APPROVED" as const,
  sourceDigest: "a".repeat(64),
  sourceSheet: "Synthetic",
  sourceRow: 1,
  sourceEntitledDays: 12,
  sourceTakenDays: 5,
  sourceRemainingDays: 7, // Source arithmetic is independent of the current grant/override.
  allocatedToDatedDays: 0,
};
const request = {
  id: "synthetic-request",
  userId: "verified-user",
  periodId: "reviewed-period",
  active: true,
  status: "PENDIENTE" as const,
  businessDaysUsed: 2,
};
const base: HistoricalBalanceInput = {
  periodId: "reviewed-period",
  userId: "verified-user",
  cycleYear: 2026,
  ruleDays: 12,
  overrideDays: null,
  historical: [entry],
  reservations: [request],
};

describe("offline historical vacation balance", () => {
  it("subtracts approved aggregate and active dated reservations from the override", () => {
    expect(calculate({ ...base, overrideDays: 14 })).toEqual({
      allottedDays: 14,
      usedDays: 7,
      remainingDays: 7,
    });
  });

  it("is idempotent for identical provenance but rejects source drift and cross-sheet cycles", () => {
    expect(calculate({ ...base, historical: [entry, { ...entry }] })).toEqual({
      allottedDays: 12,
      usedDays: 7,
      remainingDays: 5,
    });
    expect(() =>
      calculate({
        ...base,
        historical: [entry, { ...entry, sourceTakenDays: 6 }],
      }),
    ).toThrow();
    expect(() =>
      calculate({
        ...base,
        historical: [entry, { ...entry, sourceSheet: "Other" }],
      }),
    ).toThrow();
    expect(() =>
      calculate({
        ...base,
        historical: [entry, { ...entry, sourceDigest: "b".repeat(64) }],
      }),
    ).toThrow();
  });

  it("does not debit pending or rejected history and blocks unlinked approvals", () => {
    expect(
      calculate({
        ...base,
        historical: [
          { ...entry, reviewStatus: "PENDING", fundingPeriodId: null },
        ],
      }).usedDays,
    ).toBe(2);
    expect(
      calculate({
        ...base,
        historical: [
          { ...entry, reviewStatus: "REJECTED", identityVerified: false },
        ],
      }).usedDays,
    ).toBe(2);
    for (const fundingPeriodId of [null, "different-period"]) {
      expect(() =>
        calculate({ ...base, historical: [{ ...entry, fundingPeriodId }] }),
      ).toThrow();
    }
    expect(() =>
      calculate({
        ...base,
        historical: [{ ...entry, identityVerified: false }],
      }),
    ).toThrow();
  });

  it("blocks inconsistent approved source arithmetic but retains mismatched pending evidence", () => {
    for (const inconsistent of [
      { sourceRemainingDays: 99 },
      { sourceEntitledDays: 4 },
    ]) {
      expect(() =>
        calculate({ ...base, historical: [{ ...entry, ...inconsistent }] }),
      ).toThrow();
      expect(
        calculate({
          ...base,
          historical: [
            {
              ...entry,
              ...inconsistent,
              reviewStatus: "PENDING",
              fundingPeriodId: null,
            },
          ],
        }).usedDays,
      ).toBe(2);
    }
    expect(calculate(base)).toEqual({
      allottedDays: 12,
      usedDays: 7,
      remainingDays: 5,
    });
  });

  it("rejects unproven allocations even if an unrelated approved request could cover them", () => {
    expect(() =>
      calculate({
        ...base,
        historical: [{ ...entry, allocatedToDatedDays: 2 }],
        reservations: [{ ...request, status: "APROBADA" }],
      }),
    ).toThrow();
    expect(() =>
      calculate({
        ...base,
        historical: [
          { ...entry, reviewStatus: "PENDING", allocatedToDatedDays: 1 },
        ],
      }),
    ).toThrow();
    expect(
      calculate({
        ...base,
        reservations: [
          { ...request, status: "APROBADA" },
          { ...request, id: "pending-request" },
        ],
      }),
    ).toEqual({ allottedDays: 12, usedDays: 9, remainingDays: 3 });
  });

  it("rejects invalid raw values, mismatched identity, duplicate requests and overdraw", () => {
    expect(() =>
      calculate({ ...base, historical: [{ ...entry, sourceTakenDays: -1 }] }),
    ).toThrow();
    expect(() =>
      calculate({
        ...base,
        historical: [{ ...entry, allocatedToDatedDays: 6 }],
      }),
    ).toThrow();
    expect(() =>
      calculate({ ...base, historical: [{ ...entry, userId: "other" }] }),
    ).toThrow();
    expect(() =>
      calculate({ ...base, reservations: [request, request] }),
    ).toThrow();
    expect(() =>
      calculate({ ...base, reservations: [{ ...request, periodId: null }] }),
    ).toThrow();
    expect(() => calculate({ ...base, overrideDays: 6 })).toThrow();
    expect(() =>
      calculate({
        ...base,
        reservations: [{ ...request, businessDaysUsed: null }],
      }),
    ).toThrow();
  });

  it("does not invent requests, approval actors, timestamps or hire dates", () => {
    expect(calculate({ ...base, reservations: [] })).toEqual({
      allottedDays: 12,
      usedDays: 5,
      remainingDays: 7,
    });
    expect(
      calculate({ ...base, historical: [], reservations: [] }).usedDays,
    ).toBe(0);
  });
});
