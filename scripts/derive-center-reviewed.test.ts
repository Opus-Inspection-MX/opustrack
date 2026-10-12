import { describe, expect, it } from "vitest";
import { EQUIPMENT_HEADER, LINE_HEADER } from "./derive-center-candidates-v2";
import {
  deriveCenterReviewed,
  REVIEWED_RECONCILIATION_HEADER,
} from "./derive-center-reviewed";
import { CLIENT_HEADER } from "./derive-client-candidates-v2";

function fixture() {
  const clients = {
    header: [...CLIENT_HEADER],
    rows: [
      [
        "Ciudad de México",
        "SYN",
        "SYN",
        "Synthetic legal name",
        "Synthetic contact",
        "",
        "",
        "sheet",
        "3",
        "blocked",
      ],
    ],
  };
  const counts = {
    header: [
      "state",
      "code",
      "type",
      "rawCount",
      "status",
      "sourceSheet",
      "sourceRow",
      "sourceColumn",
    ],
    rows: [
      [
        "Ciudad de México",
        "SYN",
        "DINAMOMETRO",
        "1",
        "valid",
        "sheet",
        "3",
        "primary",
      ],
      [
        "Ciudad de México",
        "SYN",
        "FISICO_MECANICA",
        "",
        "blank_secondary",
        "sheet",
        "3",
        "secondary",
      ],
    ],
  };
  const reconciliation = {
    header: [...REVIEWED_RECONCILIATION_HEADER],
    rows: [
      ["sheet", "3", "secondary", "blank_secondary", "SYN"],
      ["sheet", "9", "", "total_excluded", ""],
    ],
  };
  const lines = {
    header: [...LINE_HEADER],
    rows: [
      [
        "Ciudad de México",
        "SYN",
        "SYN DINAMOMETRO 1",
        "Source sheet: sheet; count type: DINAMOMETRO",
        "blocked",
        "sheet",
        "3",
        "primary",
        "DINAMOMETRO",
      ],
    ],
  };
  const equipment = {
    header: [...EQUIPMENT_HEADER],
    rows: [
      [
        "Ciudad de México",
        "SYN",
        "SYN DINAMOMETRO 1",
        "DINAMOMETRO 1",
        "blocked",
        "synthetic_unverified",
        "not_import_approved",
        "sheet",
        "3",
        "primary",
        "DINAMOMETRO",
      ],
    ],
  };
  return { clients, counts, reconciliation, lines, equipment };
}
const derive = (f: ReturnType<typeof fixture>) =>
  deriveCenterReviewed(
    f.clients,
    f.counts,
    f.reconciliation,
    f.lines,
    f.equipment,
  );

describe("reviewed zero derivation", () => {
  it("keeps raw blanks, preserves contact and exclusions, and only refreshes statuses", () => {
    const f = fixture();
    const result = derive(f);
    expect(result.counts[1]).toEqual([
      ...f.counts.rows[1].slice(0, 4),
      "reviewed_zero",
      ...f.counts.rows[1].slice(5),
      "0",
      "user-approved-all-61",
    ]);
    expect(result.counts[0].slice(0, 8)).toEqual(f.counts.rows[0]);
    expect(result.clients[0][4]).toBe("Synthetic contact");
    expect(result.clients[0][9]).toBe("needs_review");
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0][4]).toBe("candidate");
    expect(result.equipment[0].slice(4, 7)).toEqual([
      "candidate",
      "synthetic_unverified",
      "not_import_approved",
    ]);
    expect(result.reconciliation.map((row) => row[3])).toEqual([
      "resolved_zero_by_user",
      "total_excluded",
    ]);
  });
  it("fails closed on another blocker, missing trace, invented Line or unverified link drift", () => {
    const blocked = fixture();
    blocked.reconciliation.rows.push([
      "sheet",
      "3",
      "",
      "state_unmapped",
      "SYN",
    ]);
    expect(() => derive(blocked)).toThrow("OTHER_RECONCILIATION_BLOCKER");
    const missing = fixture();
    missing.reconciliation.rows.shift();
    expect(() => derive(missing)).toThrow("ISSUE_MISSING");
    const invented = fixture();
    invented.lines.rows.push([
      "Ciudad de México",
      "SYN",
      "SYN FISICO_MECANICA 1",
      "Source sheet: sheet; count type: FISICO_MECANICA",
      "blocked",
      "sheet",
      "3",
      "secondary",
      "FISICO_MECANICA",
    ]);
    expect(() => derive(invented)).toThrow("LINE_EVIDENCE_INVALID");
    const drift = fixture();
    drift.equipment.rows[0][6] = "import_approved";
    expect(() => derive(drift)).toThrow("EQUIPMENT_INVALID");
  });
});
