import { describe, expect, it } from "vitest";
import { deriveCdmxEquipmentV3 } from "./derive-cdmx-equipment-v3";
import { EQUIPMENT_HEADER, LINE_HEADER } from "./derive-center-candidates-v2";
import { CLIENT_HEADER } from "./derive-client-candidates-v2";

function fixture() {
  const clients = {
    header: [...CLIENT_HEADER],
    rows: [
      [
        "Ciudad de México",
        "SYN",
        "SYN",
        "Synthetic company",
        "",
        "",
        "",
        "sheet",
        "3",
        "needs_review",
      ],
      [
        "Puebla",
        "OTHER",
        "OTHER",
        "Synthetic company",
        "",
        "",
        "",
        "other",
        "4",
        "needs_review",
      ],
    ],
  };
  const makeLine = (
    state: string,
    code: string,
    type: string,
    n: number,
    sheet: string,
    row: string,
  ) => [
    state,
    code,
    `${code} ${type} ${n}`,
    `Source sheet: ${sheet}; count type: ${type}`,
    "candidate",
    sheet,
    row,
    "count",
    type,
  ];
  const lines = {
    header: [...LINE_HEADER],
    rows: [
      makeLine("Ciudad de México", "SYN", "DINAMOMETRO", 1, "sheet", "3"),
      makeLine("Ciudad de México", "SYN", "FISICO_MECANICA", 1, "sheet", "3"),
      makeLine("Ciudad de México", "SYN", "FISICO_MECANICA", 2, "sheet", "3"),
      makeLine("Puebla", "OTHER", "LINEA", 1, "other", "4"),
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
        "candidate",
        "synthetic_unverified",
        "not_import_approved",
        "sheet",
        "3",
        "count",
        "DINAMOMETRO",
      ],
    ],
  };
  return { clients, lines, equipment };
}
const derive = (f: ReturnType<typeof fixture>) =>
  deriveCdmxEquipmentV3(f.clients, f.lines, f.equipment);

describe("CDMX synthetic Equipment v3", () => {
  it("preserves predecessor rows and adds only numbered CDMX physical-mechanical candidates", () => {
    const f = fixture();
    const result = derive(f);
    expect(result).toMatchObject({ dynamometers: 1, physical: 2 });
    expect(result.rows[0]).toEqual(f.equipment.rows[0]);
    expect(
      result.rows.slice(1).map((row) => [row[2], row[3], row[5], row[6]]),
    ).toEqual([
      [
        "SYN FISICO_MECANICA 1",
        "FISICOMECANICA 1",
        "synthetic_unverified",
        "not_import_approved",
      ],
      [
        "SYN FISICO_MECANICA 2",
        "FISICOMECANICA 2",
        "synthetic_unverified",
        "not_import_approved",
      ],
    ]);
    expect(result.rows).toHaveLength(3);
  });
  it("rejects missing or duplicate links and prior row drift", () => {
    const missing = fixture();
    missing.equipment.rows = [];
    expect(() => derive(missing)).toThrow("EQUIPMENT_LINK_MISSING");
    const duplicate = fixture();
    duplicate.lines.rows.push([...duplicate.lines.rows[1]]);
    expect(() => derive(duplicate)).toThrow("LINE_INVALID");
    const drift = fixture();
    drift.equipment.rows[0][6] = "import_approved";
    expect(() => derive(drift)).toThrow("PREVIOUS_EQUIPMENT_INVALID");
    const ordinal = fixture();
    ordinal.lines.rows[2][2] = "SYN FISICO_MECANICA 3";
    expect(() => derive(ordinal)).toThrow("LINE_INVALID");
    const otherState = fixture();
    otherState.equipment.rows[0][0] = "Puebla";
    expect(() => derive(otherState)).toThrow("PREVIOUS_EQUIPMENT_INVALID");
  });
});
