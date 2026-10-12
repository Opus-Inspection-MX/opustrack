/**
 * Synthetic unit tests for the seed-full CSV validators/mappers.
 *
 * Every row here is invented (fake keys, example.test addresses). No private
 * CSV content appears in this file — the header SHAPES are asserted by width
 * only, never with real values.
 */
import { describe, expect, it } from "vitest";
import {
  assertHeader,
  assertKnownGrants,
  buildHireDateIndex,
  buildNameMatchHireIndex,
  CLIENTES_HEADER,
  columnIndex,
  currentCdmxYear,
  EQUIPMENT_HEADER,
  hireProvenanceFor,
  isImportableReview,
  LINES_HEADER,
  mapClientRow,
  mapEquipmentRow,
  mapLineRow,
  mapUserRow,
  mapVacationReviewRow,
  normalizeStateName,
  parseIsoDateOnly,
  resolveHireDate,
  resolveSeedHireDate,
  resolveStateId,
  SeedInputError,
  splitGrants,
  tokenizeHireName,
  USERS_HEADER,
  VACATION_REVIEW_HEADER,
} from "./seed-full";

const FILE = "synthetic.csv";

function userCells(overrides: Record<number, string> = {}): string[] {
  const cells = [
    "sheet",
    "7",
    "FAKE-KEY-1",
    "Fake Person",
    "fake.person@example.test",
    "cat",
    "Job",
    "Reviewed Job",
    "FSR",
    "APPROVED",
    "",
    "true",
    "ok",
    "ok",
  ];
  for (const [index, value] of Object.entries(overrides))
    cells[Number(index)] = value;
  return cells;
}

function reviewCells(overrides: Record<string, string> = {}): {
  header: string[];
  cells: string[];
} {
  const header: string[] = [...VACATION_REVIEW_HEADER];
  const at = (name: string) => header.indexOf(name);
  const cells = new Array(header.length).fill("");
  cells[at("rawInputSha256")] = "a".repeat(64);
  cells[at("sourceSheet")] = "sheet";
  cells[at("sourceRow")] = "3";
  cells[at("cycleYear")] = "2024";
  cells[at("proposedUserCandidateKey")] = "FAKE-KEY-1";
  cells[at("proposedFundingPeriodKey")] = "FAKE-FUND-1";
  cells[at("matchStatus")] = "MATCHED";
  cells[at("reviewStatus")] = "PENDING";
  cells[at("importApproved")] = "false";
  cells[at("source_source_sheet")] = "sheet";
  cells[at("source_source_row")] = "3";
  cells[at("source_entitled_days")] = "12";
  cells[at("source_taken_days")] = "4";
  cells[at("source_pending_days")] = "8";
  for (const [name, value] of Object.entries(overrides))
    cells[at(name)] = value;
  return { header, cells };
}

describe("assertHeader", () => {
  it("accepts the exact users shape", () => {
    expect(() =>
      assertHeader(FILE, [...USERS_HEADER], USERS_HEADER),
    ).not.toThrow();
  });

  it("fails closed on a dropped column", () => {
    expect(() =>
      assertHeader(FILE, [...USERS_HEADER].slice(0, -1), USERS_HEADER),
    ).toThrow(SeedInputError);
  });

  it("fails closed on a reordered header", () => {
    const swapped = [...USERS_HEADER];
    const first = swapped[0];
    const second = swapped[1];
    if (first === undefined || second === undefined) throw new Error("setup");
    swapped[0] = second;
    swapped[1] = first;
    expect(() => assertHeader(FILE, swapped, USERS_HEADER)).toThrow(
      SeedInputError,
    );
  });
});

describe("columnIndex", () => {
  it("resolves a known column", () => {
    expect(columnIndex(FILE, [...USERS_HEADER], "email")).toBe(4);
  });

  it("throws on a missing column", () => {
    expect(() => columnIndex(FILE, ["a", "b"], "email")).toThrow(
      SeedInputError,
    );
  });
});

describe("mapUserRow", () => {
  it("maps a valid row with pipe-separated grants", () => {
    const row = mapUserRow(
      FILE,
      2,
      userCells({ 8: "ADMIN_OPERACION|ADMIN_VACACIONES" }),
    );
    expect(row.candidateKey).toBe("FAKE-KEY-1");
    expect(row.grants).toEqual(["ADMIN_OPERACION", "ADMIN_VACACIONES"]);
    expect(row.importable).toBe(true);
    expect(row.jobPosition).toBe("Reviewed Job");
  });

  it("falls back to the unreviewed job title", () => {
    const row = mapUserRow(FILE, 2, userCells({ 7: "" }));
    expect(row.jobPosition).toBe("Job");
  });

  it("rejects width drift", () => {
    expect(() => mapUserRow(FILE, 2, ["only", "two"])).toThrow(SeedInputError);
  });

  it("rejects a bad email without leaking it", () => {
    try {
      mapUserRow(FILE, 9, userCells({ 4: "not-an-email" }));
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(SeedInputError);
      expect((error as Error).message).toBe(`${FILE}:9: bad email`);
      expect((error as Error).message).not.toContain("not-an-email");
    }
  });

  it("rejects a missing key", () => {
    expect(() => mapUserRow(FILE, 2, userCells({ 2: "  " }))).toThrow(
      SeedInputError,
    );
  });
});

describe("splitGrants / assertKnownGrants", () => {
  it("splits pipes and drops empties", () => {
    expect(splitGrants("FSR| EMPLEADO |")).toEqual(["FSR", "EMPLEADO"]);
    expect(splitGrants("")).toEqual([]);
  });

  it("accepts known roles", () => {
    expect(() =>
      assertKnownGrants(FILE, 2, ["FSR", "EMPLEADO"], ["FSR", "EMPLEADO"]),
    ).not.toThrow();
  });

  it("rejects an unknown grant", () => {
    expect(() =>
      assertKnownGrants(FILE, 2, ["FSR", "NOPE"], ["FSR", "EMPLEADO"]),
    ).toThrow(SeedInputError);
  });
});

describe("mapClientRow / mapLineRow / mapEquipmentRow", () => {
  it("pins header widths", () => {
    expect(CLIENTES_HEADER).toHaveLength(10);
    expect(LINES_HEADER).toHaveLength(9);
    expect(EQUIPMENT_HEADER).toHaveLength(11);
  });

  it("maps a client row without inventing address/rfc", () => {
    const row = mapClientRow(FILE, 2, [
      "State",
      "CODE-1",
      "CODE-1",
      "Company",
      "Contact",
      "Phone",
      "mail@example.test",
      "sheet",
      "1",
      "needs_review",
    ]);
    expect(row.code).toBe("CODE-1");
    expect(row).not.toHaveProperty("address");
    expect(row).not.toHaveProperty("rfc");
  });

  it("rejects a client row with a missing code", () => {
    expect(() =>
      mapClientRow(FILE, 2, [
        "State",
        "",
        "CODE-1",
        "Company",
        "Contact",
        "Phone",
        "m",
        "s",
        "1",
        "needs_review",
      ]),
    ).toThrow(SeedInputError);
  });

  it("maps line and equipment links", () => {
    const line = mapLineRow(FILE, 2, [
      "State",
      "CODE-1",
      "CODE-1 LINE 1",
      "desc",
      "candidate",
      "s",
      "1",
      "A",
      "LINEA",
    ]);
    expect(line.clientCode).toBe("CODE-1");
    const equipment = mapEquipmentRow(FILE, 2, [
      "State",
      "CODE-1",
      "CODE-1 LINE 1",
      "EQ 1",
      "candidate",
      "synthetic",
      "no",
      "s",
      "1",
      "A",
      "T",
    ]);
    expect(equipment.lineName).toBe("CODE-1 LINE 1");
  });

  it("rejects an equipment row with a missing line link", () => {
    expect(() =>
      mapEquipmentRow(FILE, 2, [
        "State",
        "CODE-1",
        "",
        "EQ 1",
        "candidate",
        "synthetic",
        "no",
        "s",
        "1",
        "A",
        "T",
      ]),
    ).toThrow(SeedInputError);
  });
});

describe("parseIsoDateOnly", () => {
  it("accepts a calendar date", () => {
    expect(parseIsoDateOnly("2020-03-15")?.toISOString()).toBe(
      "2020-03-15T00:00:00.000Z",
    );
  });

  it("rejects text years and impossible dates", () => {
    expect(parseIsoDateOnly("15")).toBeNull();
    expect(parseIsoDateOnly("hired 2019")).toBeNull();
    expect(parseIsoDateOnly("2021-02-30")).toBeNull();
    expect(parseIsoDateOnly("")).toBeNull();
  });
});

describe("buildHireDateIndex / resolveHireDate", () => {
  it("resolves a single verified date", () => {
    const index = buildHireDateIndex([
      { personKey: "K1", hireDate: "2020-03-15" },
      { personKey: "K1", hireDate: "2020-03-15" },
    ]);
    expect(resolveHireDate(index, "K1")?.toISOString()).toBe(
      "2020-03-15T00:00:00.000Z",
    );
  });

  it("fails closed on conflicting dates", () => {
    const index = buildHireDateIndex([
      { personKey: "K1", hireDate: "2020-03-15" },
      { personKey: "K1", hireDate: "2021-06-01" },
    ]);
    expect(resolveHireDate(index, "K1")).toBeNull();
  });

  it("ignores text-only evidence", () => {
    const index = buildHireDateIndex([
      { personKey: "K1", hireDate: "hired 2019" },
    ]);
    expect(resolveHireDate(index, "K1")).toBeNull();
  });

  it("returns null for unknown keys", () => {
    expect(resolveHireDate(new Map(), "MISSING")).toBeNull();
  });
});

describe("tokenizeHireName (fallback normalization)", () => {
  it("matches the derive-vacation-review token rules", () => {
    expect(tokenizeHireName("  José  Pérez-García ")).toEqual([
      "jose",
      "perez",
      "garcia",
    ]);
  });
});

describe("buildNameMatchHireIndex / resolveSeedHireDate (tier-2 fallback)", () => {
  const user = (candidateKey: string, name: string) => ({
    candidateKey,
    name,
  });

  it("resolves a name match with accent/case-insensitive tokens", () => {
    const fallback = buildNameMatchHireIndex(
      [user("U1", "Fake Person")],
      [{ name: "FAKE  person", hireDate: "2020-03-15" }],
    );
    const exact = buildHireDateIndex([]);
    expect(resolveSeedHireDate(exact, fallback, "U1")?.toISOString()).toBe(
      "2020-03-15T00:00:00.000Z",
    );
    expect(hireProvenanceFor(exact, fallback, "U1")).toBe("name_match");
  });

  it("resolves a whole-block reordered name", () => {
    const fallback = buildNameMatchHireIndex(
      [user("U1", "Gamma Beta Alpha")],
      [{ name: "Alpha Gamma Beta", hireDate: "2019-05-01" }],
    );
    const exact = buildHireDateIndex([]);
    expect(resolveSeedHireDate(exact, fallback, "U1")?.toISOString()).toBe(
      "2019-05-01T00:00:00.000Z",
    );
    expect(hireProvenanceFor(exact, fallback, "U1")).toBe("name_match");
  });

  it("skips conflicting distinct dates (never guesses)", () => {
    const fallback = buildNameMatchHireIndex(
      [user("U1", "Fake Person")],
      [
        { name: "Fake Person", hireDate: "2020-03-15" },
        { name: "Fake Person", hireDate: "2021-06-01" },
      ],
    );
    const exact = buildHireDateIndex([]);
    expect(resolveSeedHireDate(exact, fallback, "U1")).toBeNull();
    expect(hireProvenanceFor(exact, fallback, "U1")).toBe("skipped");
  });

  it("skips ambiguous text-only evidence", () => {
    const fallback = buildNameMatchHireIndex(
      [user("U1", "Fake Person")],
      [
        { name: "Fake Person", hireDate: "hired 2019" },
        { name: "Fake Person", hireDate: "" },
      ],
    );
    const exact = buildHireDateIndex([]);
    expect(resolveSeedHireDate(exact, fallback, "U1")).toBeNull();
    expect(hireProvenanceFor(exact, fallback, "U1")).toBe("skipped");
  });

  it("skips a hire row matching two users (ambiguous identity)", () => {
    const fallback = buildNameMatchHireIndex(
      [user("U1", "Fake Person"), user("U2", "Fake Person")],
      [{ name: "Fake Person", hireDate: "2020-03-15" }],
    );
    const exact = buildHireDateIndex([]);
    expect(resolveSeedHireDate(exact, fallback, "U1")).toBeNull();
    expect(resolveSeedHireDate(exact, fallback, "U2")).toBeNull();
    expect(hireProvenanceFor(exact, fallback, "U1")).toBe("skipped");
  });

  it("prefers the exact person-key date over the fallback", () => {
    const exact = buildHireDateIndex([
      { personKey: "U1", hireDate: "2018-01-10" },
    ]);
    const fallback = buildNameMatchHireIndex(
      [user("U1", "Fake Person")],
      [{ name: "Fake Person", hireDate: "2020-03-15" }],
    );
    expect(resolveSeedHireDate(exact, fallback, "U1")?.toISOString()).toBe(
      "2018-01-10T00:00:00.000Z",
    );
    expect(hireProvenanceFor(exact, fallback, "U1")).toBe("exact_key");
  });
});

describe("normalizeStateName / resolveStateId", () => {
  it("normalizes accents and case", () => {
    expect(normalizeStateName("  Querétaro ")).toBe("queretaro");
  });

  it("prefers the exact name", () => {
    const states = [
      { id: 1, name: "México" },
      { id: 2, name: "Puebla" },
    ];
    expect(resolveStateId("México", states)).toBe(1);
  });

  it("falls back to a single normalized match", () => {
    const states = [
      { id: 1, name: "Querétaro" },
      { id: 2, name: "Puebla" },
    ];
    expect(resolveStateId("queretaro", states)).toBe(1);
  });

  it("fails closed on ambiguity", () => {
    const states = [
      { id: 1, name: "Same" },
      { id: 2, name: "same " },
    ];
    expect(() => resolveStateId("SAME", states)).toThrow();
  });
});

describe("mapVacationReviewRow / isImportableReview", () => {
  it("parses a well-formed row", () => {
    const { header, cells } = reviewCells();
    const row = mapVacationReviewRow(FILE, 2, cells, header);
    expect(row.cycleYear).toBe(2024);
    expect(row.entitled).toBe(12);
    expect(row.taken).toBe(4);
    expect(row.remaining).toBe(8);
    expect(isImportableReview(row)).toBe(false);
  });

  it("never auto-approves PENDING rows", () => {
    const { header, cells } = reviewCells({
      importApproved: "true",
      proposedFundingPeriodKey: "FAKE-FUND-1",
    });
    const row = mapVacationReviewRow(FILE, 2, cells, header);
    expect(row.reviewStatus).toBe("PENDING");
    expect(isImportableReview(row)).toBe(false);
  });

  it("gates APPROVED rows on approval flag plus funding link", () => {
    const approved = reviewCells({
      reviewStatus: "APPROVED",
      importApproved: "true",
    });
    expect(
      isImportableReview(
        mapVacationReviewRow(FILE, 2, approved.cells, approved.header),
      ),
    ).toBe(true);

    const unlinked = reviewCells({
      reviewStatus: "APPROVED",
      importApproved: "true",
      proposedFundingPeriodKey: "",
    });
    expect(
      isImportableReview(
        mapVacationReviewRow(FILE, 2, unlinked.cells, unlinked.header),
      ),
    ).toBe(false);
  });

  it("rejects a malformed digest", () => {
    const { header, cells } = reviewCells({ rawInputSha256: "xyz" });
    expect(() => mapVacationReviewRow(FILE, 2, cells, header)).toThrow(
      SeedInputError,
    );
  });

  it("rejects arithmetic-shaped bad day counts", () => {
    const { header, cells } = reviewCells({ source_taken_days: "-3" });
    expect(() => mapVacationReviewRow(FILE, 2, cells, header)).toThrow(
      SeedInputError,
    );
  });
});

describe("currentCdmxYear", () => {
  it("resolves the CDMX year for a known instant", () => {
    // 2026-01-01 05:30 UTC is still Dec 31 in CDMX (UTC-6).
    expect(currentCdmxYear(new Date("2026-01-01T05:30:00Z"))).toBe(2025);
    expect(currentCdmxYear(new Date("2026-06-15T12:00:00Z"))).toBe(2026);
  });
});
