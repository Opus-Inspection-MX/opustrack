/** Seed baseline; runtime entitlement remains controlled by the admin catalog. */
export const DEFAULT_VACATION_ACCRUAL_RULES = [
  { minYears: 1, maxYears: 1, days: 12 },
  { minYears: 2, maxYears: 2, days: 14 },
  { minYears: 3, maxYears: 3, days: 16 },
  { minYears: 4, maxYears: 4, days: 18 },
  { minYears: 5, maxYears: 5, days: 20 },
  ...Array.from({ length: 10 }, (_, index) => ({
    minYears: 6 + index * 5,
    maxYears: 10 + index * 5,
    days: 22 + index * 2,
  })),
];
