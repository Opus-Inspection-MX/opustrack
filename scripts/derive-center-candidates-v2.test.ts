import { describe, expect, it } from "vitest";
import {
  deriveCenterCandidatesV2,
  LINE_HEADER,
} from "./derive-center-candidates-v2";

const clientsHeader = [
  "state",
  "code",
  "name",
  "companyName",
  "contact",
  "phone",
  "email",
  "sourceSheet",
  "sourceRow",
  "status",
];
const countsHeader = [
  "state",
  "code",
  "type",
  "rawCount",
  "status",
  "sourceSheet",
  "sourceRow",
  "sourceColumn",
];
function fixture(
  state = "Ciudad de México",
  types = ["DINAMOMETRO", "FISICO_MECANICA"],
  status = "blocked",
) {
  const clients = {
    header: clientsHeader,
    rows: [[state, "SYN", "", "Synthetic", "", "", "", "sheet", "3", status]],
  };
  const counts = {
    header: countsHeader,
    rows: types.map((type, i) => [
      state,
      "SYN",
      type,
      i ? "1" : "2",
      "valid",
      "sheet",
      "3",
      String(i + 1),
    ]),
  };
  const lines = {
    header: [...LINE_HEADER],
    rows: counts.rows.flatMap((count) =>
      Array.from({ length: Number(count[3]) }, (_, i) => [
        state,
        "SYN",
        `OLD ${count[2]} ${i}`,
        "old",
        status === "blocked" ? "blocked" : "candidate",
        "sheet",
        "3",
        count[7],
        count[2],
      ]),
    ),
  };
  return { clients, counts, lines };
}

describe("offline v2 derivation", () => {
  it("resets numbering per type and emits only linked synthetic CDMX dynamometers", () => {
    const { clients, counts, lines } = fixture();
    const result = deriveCenterCandidatesV2(clients, counts, lines);
    expect(result.lines.map((row) => row[2])).toEqual([
      "SYN DINAMOMETRO 1",
      "SYN DINAMOMETRO 2",
      "SYN FISICO_MECANICA 1",
    ]);
    expect(
      result.equipment.map((row) => [row[2], row[3], row[4], row[5], row[6]]),
    ).toEqual([
      [
        "SYN DINAMOMETRO 1",
        "DINAMOMETRO 1",
        "blocked",
        "synthetic_unverified",
        "not_import_approved",
      ],
      [
        "SYN DINAMOMETRO 2",
        "DINAMOMETRO 2",
        "blocked",
        "synthetic_unverified",
        "not_import_approved",
      ],
    ]);
  });
  it("keeps generic fields generic and emits no equipment", () => {
    const input = fixture("México", ["LINEA"], "needs_review");
    const result = deriveCenterCandidatesV2(
      input.clients,
      input.counts,
      input.lines,
    );
    expect(result.lines.map((row) => row[2])).toEqual([
      "SYN LINEA 1",
      "SYN LINEA 2",
    ]);
    expect(result.equipment).toHaveLength(0);
  });
  it("rejects ambiguous clients, blank-to-zero, invalid counts, duplicate types and missing evidence", () => {
    const input = fixture();
    input.clients.rows.push([...input.clients.rows[0]]);
    expect(() =>
      deriveCenterCandidatesV2(input.clients, input.counts, input.lines),
    ).toThrow("CLIENT_AMBIGUOUS");
    input.clients.rows.pop();
    input.counts.rows[0][3] = "";
    input.counts.rows[0][4] = "blank_primary";
    expect(() =>
      deriveCenterCandidatesV2(input.clients, input.counts, input.lines),
    ).toThrow("LINE_EVIDENCE_INVALID");
    input.counts.rows[0][3] = "1.5";
    input.counts.rows[0][4] = "valid";
    expect(() =>
      deriveCenterCandidatesV2(input.clients, input.counts, input.lines),
    ).toThrow("COUNT_INVALID");
    input.counts.rows[0][3] = "2";
    input.counts.rows.push([...input.counts.rows[0]]);
    expect(() =>
      deriveCenterCandidatesV2(input.clients, input.counts, input.lines),
    ).toThrow("COUNT_DUPLICATE");
    input.counts.rows.pop();
    input.lines.rows.push([...input.lines.rows[0]]);
    expect(() =>
      deriveCenterCandidatesV2(input.clients, input.counts, input.lines),
    ).toThrow("COUNT_MISMATCH");
    input.lines.rows.pop();
    input.lines.rows.pop();
    expect(() =>
      deriveCenterCandidatesV2(input.clients, input.counts, input.lines),
    ).toThrow("COUNT_MISMATCH");
  });
});
