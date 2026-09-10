import { describe, expect, it } from "vitest";
import { localWallTimeToUTC } from "@/lib/utils/datetime";
import {
  businessDaysBetween,
  getSlaState,
  SLA_AT_RISK_RATIO,
  SLA_POLICY,
  slaBandForPriority,
} from "./sla-policy";

/**
 * SLA policy + breach math (RF-218).
 *
 * Every date below is a real 2026 CDMX calendar day — verify before editing:
 * Fri 2026-09-04, Mon 2026-09-07, Tue 2026-09-08, Wed 2026-09-09,
 * Thu 2026-09-10, Fri 2026-09-11, Mon 2026-09-14, Tue 2026-09-15,
 * Wed 2026-09-16 (Independence Day, official holiday), Thu 2026-09-17.
 */
const at = (date: string, time = "10:00") => localWallTimeToUTC(date, time);

/** Independence Day 2026 — the pinned CDMX holiday. */
const HOLIDAY_16_SEP = new Set(["2026-09-16"]);
const NO_HOLIDAYS = new Set<string>();

describe("slaBandForPriority", () => {
  it("maps 8–10 to critical, 5–7 to medium, 1–4 to low (badge buckets)", () => {
    expect([8, 9, 10].map(slaBandForPriority)).toEqual([
      "critical",
      "critical",
      "critical",
    ]);
    expect([5, 6, 7].map(slaBandForPriority)).toEqual([
      "medium",
      "medium",
      "medium",
    ]);
    expect([1, 2, 3, 4].map(slaBandForPriority)).toEqual([
      "low",
      "low",
      "low",
      "low",
    ]);
  });

  it("pins the agreed targets: critical 1/3, medium 2/7, low 5/15", () => {
    expect(SLA_POLICY).toEqual({
      critical: { responseBusinessDays: 1, resolutionBusinessDays: 3 },
      medium: { responseBusinessDays: 2, resolutionBusinessDays: 7 },
      low: { responseBusinessDays: 5, resolutionBusinessDays: 15 },
    });
    expect(SLA_AT_RISK_RATIO).toBe(0.8);
  });
});

describe("businessDaysBetween", () => {
  it("returns 0 for same-day and inverted ranges", () => {
    expect(
      businessDaysBetween(
        at("2026-09-07"),
        at("2026-09-07", "18:00"),
        NO_HOLIDAYS,
      ),
    ).toBe(0);
    expect(
      businessDaysBetween(at("2026-09-08"), at("2026-09-07"), NO_HOLIDAYS),
    ).toBe(0);
  });

  it("excludes the weekend: Friday to Monday accrues 1, not 3", () => {
    expect(
      businessDaysBetween(at("2026-09-04"), at("2026-09-07"), NO_HOLIDAYS),
    ).toBe(1);
    expect(
      businessDaysBetween(at("2026-09-04"), at("2026-09-08"), NO_HOLIDAYS),
    ).toBe(2);
  });

  it("excludes an official holiday: Mon 14 → Thu 17 across 16 de septiembre is 2", () => {
    expect(
      businessDaysBetween(at("2026-09-14"), at("2026-09-17"), HOLIDAY_16_SEP),
    ).toBe(2);
    expect(
      businessDaysBetween(at("2026-09-14"), at("2026-09-16"), HOLIDAY_16_SEP),
    ).toBe(1);
  });

  it("a holiday landing on a weekend changes nothing (no double subtraction)", () => {
    // 2026-09-05 is a Saturday: already excluded, holiday or not.
    expect(
      businessDaysBetween(
        at("2026-09-04"),
        at("2026-09-07"),
        new Set(["2026-09-05"]),
      ),
    ).toBe(1);
  });
});

describe("getSlaState · response phase (unseen)", () => {
  it("breaches a critical incident unseen past 1 business day", () => {
    expect(
      getSlaState({
        priority: 9,
        createdAt: at("2026-09-04"),
        seenAt: null,
        resolvedAt: null,
        statusName: "ABIERTO",
        now: at("2026-09-08"),
        holidays: NO_HOLIDAYS,
      }),
    ).toBe("BREACHED");
  });

  it("flags at-risk at 80% of target: critical Friday → Monday is AT_RISK, not breached", () => {
    expect(
      getSlaState({
        priority: 8,
        createdAt: at("2026-09-04"),
        seenAt: null,
        resolvedAt: null,
        statusName: "ASIGNADO",
        now: at("2026-09-07"),
        holidays: NO_HOLIDAYS,
      }),
    ).toBe("AT_RISK");
  });

  it("pins the 80% boundary on the low band (target 5): 3 on-track, 4 at-risk, 6 breached", () => {
    const base = {
      priority: 3,
      createdAt: at("2026-09-04"),
      seenAt: null,
      resolvedAt: null,
      statusName: "ABIERTO",
      holidays: NO_HOLIDAYS,
    };
    expect(getSlaState({ ...base, now: at("2026-09-09") })).toBe("ON_TRACK");
    expect(getSlaState({ ...base, now: at("2026-09-10") })).toBe("AT_RISK");
    expect(getSlaState({ ...base, now: at("2026-09-14") })).toBe("BREACHED");
  });

  it("a holiday Monday saves the response clock: Tue 15 → Thu 17 is AT_RISK, not BREACHED", () => {
    const base = {
      priority: 10,
      createdAt: at("2026-09-15"),
      seenAt: null,
      resolvedAt: null,
      statusName: "ABIERTO",
      now: at("2026-09-17"),
    };
    expect(getSlaState({ ...base, holidays: HOLIDAY_16_SEP })).toBe("AT_RISK");
    expect(getSlaState({ ...base, holidays: NO_HOLIDAYS })).toBe("BREACHED");
  });
});

describe("getSlaState · resolution phase (seen, still open)", () => {
  const base = {
    priority: 9,
    createdAt: at("2026-09-04"),
    seenAt: at("2026-09-07"),
    resolvedAt: null,
    statusName: "EN_PROGRESO",
    holidays: NO_HOLIDAYS,
  };

  it("runs against the resolution target (3): 2 on-track, 3 at-risk, 4 breached", () => {
    expect(getSlaState({ ...base, now: at("2026-09-08") })).toBe("ON_TRACK");
    expect(getSlaState({ ...base, now: at("2026-09-09") })).toBe("AT_RISK");
    expect(getSlaState({ ...base, now: at("2026-09-10") })).toBe("BREACHED");
  });
});

describe("getSlaState · closed (history)", () => {
  const base = {
    priority: 9,
    createdAt: at("2026-09-04"),
    seenAt: at("2026-09-07"),
    statusName: "CERRADO",
    holidays: NO_HOLIDAYS,
  };

  it("closed late (5 business days vs target 3) is BREACHED from resolvedAt", () => {
    expect(
      getSlaState({
        ...base,
        resolvedAt: at("2026-09-11"),
        now: at("2026-09-17"),
      }),
    ).toBe("BREACHED");
  });

  it("closed on time is ON_TRACK, and hitting the target exactly never retro-breaches", () => {
    expect(
      getSlaState({
        ...base,
        resolvedAt: at("2026-09-08"),
        now: at("2026-09-17"),
      }),
    ).toBe("ON_TRACK");
    expect(
      getSlaState({
        ...base,
        resolvedAt: at("2026-09-09"),
        now: at("2026-09-17"),
      }),
    ).toBe("ON_TRACK");
  });

  it("CERRADO with no closure timestamp at all (pre-RF-219 legacy) is ON_TRACK: no blame without evidence", () => {
    expect(
      getSlaState({ ...base, resolvedAt: null, now: at("2026-09-17") }),
    ).toBe("ON_TRACK");
  });
});

describe("getSlaState · cancellation", () => {
  it("CANCELADA never breaches, however old, with or without resolvedAt", () => {
    const base = {
      priority: 10,
      createdAt: at("2026-01-05"),
      seenAt: null,
      statusName: "CANCELADA",
      now: at("2026-09-10"),
      holidays: NO_HOLIDAYS,
    };
    expect(getSlaState({ ...base, resolvedAt: null })).toBe("NOT_APPLICABLE");
    expect(getSlaState({ ...base, resolvedAt: at("2026-01-06") })).toBe(
      "NOT_APPLICABLE",
    );
  });
});
