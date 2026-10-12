import { describe, expect, it } from "vitest";
import { EQUIPMENT_HEADER, LINE_HEADER } from "./derive-center-candidates-v2";
import {
  CLIENT_HEADER,
  deriveClientCandidatesV2,
} from "./derive-client-candidates-v2";

const client = [
  "State",
  "Code-X",
  "",
  "Legal name",
  "Contact",
  "Phone",
  "Email",
  "Sheet",
  "4",
  "blocked",
];
const fixture = () => ({
  source: { header: [...CLIENT_HEADER], rows: [[...client]] },
  lines: {
    header: [...LINE_HEADER],
    rows: [["State", "Code-X", ...Array(7).fill("")]],
  },
  equipment: {
    header: [...EQUIPMENT_HEADER],
    rows: [["State", "Code-X", ...Array(9).fill("")]],
  },
});

describe("offline Client v2 derivation", () => {
  it("copies all source fields and uses the exact code as name", () => {
    const { source, lines, equipment } = fixture();
    expect(deriveClientCandidatesV2(source, lines, equipment)).toEqual([
      ["State", "Code-X", "Code-X", ...client.slice(3)],
    ]);
    expect(source.rows[0][2]).toBe("");
  });
  it("rejects occupied names, absent codes, and casefold collisions", () => {
    const { source, lines, equipment } = fixture();
    source.rows[0][2] = "other";
    expect(() => deriveClientCandidatesV2(source, lines, equipment)).toThrow(
      "CLIENT_INVALID",
    );
    source.rows[0][2] = "";
    source.rows[0][1] = "";
    expect(() => deriveClientCandidatesV2(source, lines, equipment)).toThrow(
      "CLIENT_INVALID",
    );
    source.rows[0][1] = "Code-X";
    source.rows.push(["Other", "code-x", "", ...client.slice(3)]);
    expect(() => deriveClientCandidatesV2(source, lines, equipment)).toThrow(
      "CLIENT_DUPLICATE",
    );
  });
  it("rejects missing or malformed links and preserves review status", () => {
    const { source, lines, equipment } = fixture();
    source.rows[0][9] = "needs_review";
    expect(deriveClientCandidatesV2(source, lines, equipment)[0][9]).toBe(
      "needs_review",
    );
    equipment.rows[0][1] = "Unknown";
    expect(() => deriveClientCandidatesV2(source, lines, equipment)).toThrow(
      "CLIENT_LINK_INVALID",
    );
    equipment.rows[0][1] = "Code-X";
    lines.rows[0].pop();
    expect(() => deriveClientCandidatesV2(source, lines, equipment)).toThrow(
      "CLIENT_LINK_INVALID",
    );
  });
});
