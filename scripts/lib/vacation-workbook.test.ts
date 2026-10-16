import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { readVacationWorkbook, samePerson } from "./vacation-workbook";

async function source(
  formula?: ExcelJS.CellValue,
  taken: ExcelJS.CellValue = 3,
) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Vacaciones 2026-2027");
  sheet.addRow(["VACACIONES"]);
  sheet.addRow([
    "Nombre",
    "Ingreso",
    "Años",
    "Texto",
    "Derecho",
    "Tomados",
    "Saldo",
  ]);
  sheet.addRow([
    "Persona Ejemplo Prueba",
    new Date("2020-06-15T00:00:00Z"),
    6,
    "Fechas sin interpretar",
    22,
    taken,
    formula ?? { formula: "+E3-F3" },
  ]);
  sheet.addRow(["Regla original para conservar"]);
  return Buffer.from(await book.xlsx.writeBuffer());
}

describe("vacation workbook evidence", () => {
  it("recomputes known formulas without cached results and retains original cells/rules", async () => {
    const result = await readVacationWorkbook(await source());
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      entitledDays: 22,
      takenDays: 3,
      remainingDays: 19,
      issues: [],
      hireDate: new Date("2020-06-15T05:00:00Z"),
    });
    expect(JSON.stringify(result.source)).toContain(
      "Regla original para conservar",
    );
    expect(JSON.stringify(result.rows[0].sourceValues)).toContain("+E3-F3");
    expect(result.digest).toMatch(/^[a-f0-9]{64}$/);
  });
  it("uses Excel blank-as-zero only for a recognized subtraction", async () => {
    const known = await readVacationWorkbook(
      await source({ formula: "E3-F3", result: 22 }, null),
    );
    expect(known.rows[0]).toMatchObject({
      takenDays: 0,
      remainingDays: 22,
      issues: [],
    });
    const unknown = await readVacationWorkbook(
      await source({ formula: "SUM(E3:F3)" }, null),
    );
    expect(unknown.rows[0].issues).toContain("INCOMPLETE_BALANCE");
    expect(unknown.rows[0].issues).toContain("UNSUPPORTED_FORMULA");
    expect(unknown.rows[0].takenDays).toBeNull();
  });
  it("flags inconsistent literals and stale cached results rather than approving them", async () => {
    expect(
      (await readVacationWorkbook(await source(5))).rows[0].issues,
    ).toContain("INCONSISTENT_BALANCE");
    expect(
      (
        await readVacationWorkbook(
          await source({ formula: "E3-F3", result: 1 }),
        )
      ).rows[0].issues,
    ).toContain("FORMULA_CACHE_MISMATCH");
  });
  it("resolves two-digit hire years only when corroborated by service-year evidence", async () => {
    const book = new ExcelJS.Workbook();
    const s = book.addWorksheet("Vacaciones 2026-2027");
    s.getRow(3).values = ["Persona Prueba", "\n21-abr-04", 22, null, 28, 2, 26];
    const result = await readVacationWorkbook(
      Buffer.from(await book.xlsx.writeBuffer()),
    );
    // Preserve the civil date, including the historical CDMX daylight offset.
    expect(result.rows[0].hireDate?.toISOString().slice(0, 10)).toBe(
      "2004-04-21",
    );
    s.getCell("C3").value = 15;
    const unresolved = await readVacationWorkbook(
      Buffer.from(await book.xlsx.writeBuffer()),
    );
    expect(unresolved.rows[0].hireDate).toBeNull();
  });
  it("matches accents and whole-name rotations without arbitrary token rearrangement", () => {
    expect(samePerson("Pérez López Ana María", "Ana María Perez Lopez")).toBe(
      true,
    );
    expect(samePerson("Ana Pérez María López", "Ana María Pérez López")).toBe(
      false,
    );
  });
});
