import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { extract, spanishNumber } from "./extract-center-lines";

function fixture() {
  const book = new ExcelJS.Workbook();
  for (const name of [
    "CDMX",
    "ESTADO DE MEXICO",
    "QUERÉTARO",
    "TLAXCALA",
    "PUEBLA",
  ]) {
    const sheet = book.addWorksheet(name);
    sheet.addRow(["Report title"]);
    sheet.addRow([
      "CENTRO",
      "RAZON SOCIAL",
      "NOMBRE",
      "TELEFONO",
      "CORREO",
      "DINAMOMETRO",
      "GASOLINA",
    ]);
  }
  return book;
}

describe("offline center candidate extraction", () => {
  it("selects headers rather than fixed rows and maps only unambiguous normalized aliases", () => {
    const book = fixture();
    book
      .getWorksheet("QUERÉTARO")
      ?.addRow(["Q-01", "Legal, Ltd", "Contact", "", "", 1, 2]);
    const data = extract(book);
    expect(data.clients[0].slice(0, 4)).toEqual([
      "Querétaro",
      "Q-01",
      "",
      "Legal, Ltd",
    ]);
    expect(
      data.issues.filter((i) => i.category === "state_alias_mapped"),
    ).toHaveLength(1);
    expect(data.lines.map((l) => [l[2], l[4], l[8]])).toEqual([
      ["UNO", "candidate", "DINAMOMETRO"],
      ["DOS", "candidate", "GASOLINA"],
      ["TRES", "candidate", "GASOLINA"],
    ]);
    expect(data.lines[0][3]).toContain("count type: DINAMOMETRO");
    expect(data.lines[0][5]).toBe("QUERÉTARO");
    expect(data.lines[0][7]).toBe("DINAMOMETRO");
  });

  it("blocks incomplete counts without converting blanks to zeros", () => {
    const book = fixture();
    const sheet = book.getWorksheet("CDMX");
    sheet?.addRow(["A01", "Company", "", "", "", null, 2]);
    sheet?.addRow(["B01", "Company", "", "", "", 1]);
    const data = extract(book);
    expect(
      data.issues.filter((i) => i.category === "blank_primary"),
    ).toHaveLength(1);
    expect(
      data.issues.filter((i) => i.category === "blank_secondary"),
    ).toHaveLength(1);
    expect(data.lines.map((l) => l[4])).toEqual([
      "blocked",
      "blocked",
      "blocked",
    ]);
    expect(
      data.counts.filter((c) => c[4].startsWith("blank")).map((c) => c[3]),
    ).toEqual(["", ""]);
  });

  it("rejects negative, fractional, and excessive counts; excludes marked totals", () => {
    const book = fixture();
    const sheet = book.getWorksheet("CDMX");
    sheet?.addRow(["A01", "Company", "", "", "", -1, 2.5]);
    sheet?.addRow(["B01", "Company", "", "", "", 101, 0]);
    sheet?.addRow([
      "TOTAL",
      "",
      "",
      "",
      "",
      { formula: "SUM(F3:F4)", result: 100 },
      "",
    ]);
    sheet?.addRow(["", "TOTAL", "", "", "", 2, 0]);
    const data = extract(book);
    expect(data.excluded.total).toBe(2);
    expect(data.lines).toHaveLength(0);
    expect(
      data.issues.filter((i) => i.category === "invalid_count"),
    ).toHaveLength(2);
    expect(
      data.issues.filter((i) => i.category === "count_capped"),
    ).toHaveLength(1);
  });

  it("excludes a formula subtotal with no center identity", () => {
    const book = fixture();
    book
      .getWorksheet("CDMX")
      ?.addRow(["", "", "", "", "", { formula: "SUM(F3:F4)", result: 8 }, ""]);
    const data = extract(book);
    expect(data.excluded.total).toBe(1);
    expect(data.clients).toHaveLength(0);
    expect(
      data.issues.filter((i) => i.category === "total_excluded"),
    ).toHaveLength(1);
  });

  it("retains a center with formula count as blocked without trusting cached values", () => {
    const book = fixture();
    book
      .getWorksheet("CDMX")
      ?.addRow([
        "SYN-01",
        "Synthetic Company",
        "",
        "",
        "",
        { formula: "2+3", result: 5 },
        1,
      ]);
    const data = extract(book);
    expect(data.excluded.total).toBe(0);
    expect(data.clients).toHaveLength(1);
    expect(data.clients[0][9]).toBe("blocked");
    expect(data.counts.map((c) => [c[3], c[4]])).toEqual([
      ["", "formula_count_unverified"],
      ["1", "valid"],
    ]);
    expect(
      data.issues.filter((i) => i.category === "formula_count_unverified"),
    ).toHaveLength(1);
    expect(data.lines.map((l) => [l[2], l[4], l[8]])).toEqual([
      ["UNO", "blocked", "GASOLINA"],
    ]);
  });

  it("blocks both raw and normalized duplicate codes across states", () => {
    const book = fixture();
    book.getWorksheet("CDMX")?.addRow(["X-01", "Company", "", "", "", 1, 0]);
    book.getWorksheet("PUEBLA")?.addRow(["X01", "Company", "", "", "", 1, 0]);
    book
      .getWorksheet("TLAXCALA")
      ?.addRow(["X-01", "Company", "", "", "", 1, 0]);
    const data = extract(book);
    expect(
      data.issues.filter((i) => i.category === "duplicate_raw"),
    ).toHaveLength(2);
    expect(
      data.issues.filter((i) => i.category === "duplicate_normalized"),
    ).toHaveLength(3);
    expect(data.lines.every((l) => l[4] === "blocked")).toBe(true);
    expect(data.lines).toHaveLength(3);
  });

  it("uses distinct per-client names through the bounded maximum and creates no equipment", () => {
    expect([1, 16, 21, 29, 30, 31, 100, 101, 999].map(spanishNumber)).toEqual([
      "UNO",
      "DIECISEIS",
      "VEINTIUNO",
      "VEINTINUEVE",
      "TREINTA",
      "TREINTA Y UNO",
      "CIEN",
      "CIENTO UNO",
      "NOVECIENTOS NOVENTA Y NUEVE",
    ]);
    expect(() => spanishNumber(1000)).toThrow("NUMBER_RANGE");
    const data = extract(fixture());
    expect(Object.keys(data)).not.toContain("equipments");
  });
});
