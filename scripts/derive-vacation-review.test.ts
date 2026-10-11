import { describe, expect, it } from "vitest";
import { type CsvTable, deriveVacationReview } from "./derive-vacation-review";

const digest = "a".repeat(64);
const sourceHeader = [
  "sheet",
  "row",
  "name",
  "raw_entitled",
  "raw_taken",
  "raw_remaining",
  "raw_hire",
];
const source = (...rows: string[][]): CsvTable => ({
  header: sourceHeader,
  rows,
});
const userHeader = ["candidate_key", "name", "importable", "review_status"];
const users = (): CsvTable => ({
  header: userHeader,
  rows: [
    ["user-a", "Ada Sample", "true", "approved_roles"],
    ["user-b", "Bea Example", "true", "approved_roles"],
    ...Array.from({ length: 22 }, (_, index) => [
      `other-${index}`,
      `Test Person ${index}`,
      "true",
      "approved_roles",
    ]),
    ["alias", "Sample Ada", "false", "duplicate_alias"],
  ],
});

describe("offline vacation review", () => {
  it("retains raw evidence while every match remains pending", () => {
    const result = deriveVacationReview(
      source(
        ["2025–2026", "9", "Ada Sample", "12", "3", "9", "45000"],
        ["2024–2025", "10", "Example Bea", "12", "4", "8", "01/02/23"],
        ["2024–2025", "11", "Unknown Person", "12", "", "8", ""],
        ["2024–2025", "12", "Ada Sample", "12", "4", "9", ""],
      ),
      users(),
      digest,
    );
    expect(result.rows.map((row) => row[6])).toEqual([
      "exact",
      "reordered",
      "unmatched",
      "exact",
    ]);
    expect(result.rows.map((row) => row[7])).toEqual([
      "complete",
      "complete",
      "partial",
      "inconsistent",
    ]);
    expect(result.rows.map((row) => row[8])).toEqual([
      "numeric",
      "ambiguous",
      "unavailable",
      "unavailable",
    ]);
    expect(result.rows.map((row) => row[3])).toEqual([
      "2025",
      "2024",
      "2024",
      "2024",
    ]);
    expect(
      result.rows.every(
        (row) => row[5] === "" && row[10] === "PENDING" && row[11] === "false",
      ),
    ).toBe(true);
    expect(result.rows[0].slice(12)).toEqual([
      "2025–2026",
      "9",
      "Ada Sample",
      "12",
      "3",
      "9",
      "45000",
    ]);
  });

  it("fails closed on duplicated provenance or malformed input", () => {
    const row = ["2025–2026", "9", "Ada Sample", "12", "3", "9", "45000"];
    expect(() =>
      deriveVacationReview(source(row, row), users(), digest),
    ).toThrow("PROVENANCE_DUPLICATE");
    expect(() =>
      deriveVacationReview(
        source(["unknown", ...row.slice(1)]),
        users(),
        digest,
      ),
    ).toThrow("PROVENANCE_INVALID");
    expect(() =>
      deriveVacationReview(source(row.slice(1)), users(), digest),
    ).toThrow("SOURCE_SCHEMA_INVALID");
  });

  it("does not treat arbitrary token permutations as the same person", () => {
    const result = deriveVacationReview(
      source(["2025–2026", "9", "Sample Ada", "12", "3", "9", "01-Feb-23"]),
      users(),
      digest,
    );
    expect(result.rows[0][6]).toBe("reordered");
    expect(result.rows[0][8]).toBe("ambiguous");
    const other = deriveVacationReview(
      source(["2025–2026", "9", "Sample Bea Example", "12", "3", "9", ""]),
      users(),
      digest,
    );
    expect(other.rows[0][6]).toBe("unmatched");
    expect(other.rows[0][4]).toBe("");
  });
});
