import { describe, expect, it } from "vitest";
import { parseCsv, parseCsvBody, quoteField, toCsv, toCsvRow } from "./csv";

/**
 * The reason this module exists: two company names in the source workbook
 * contain a comma. A naive `split(",")` shifts every column after them, so the
 * round-trip through quotes is the contract worth pinning down.
 */

describe("quoteField", () => {
  it("wraps a plain value in quotes", () => {
    expect(quoteField("Power Cars Mundo")).toBe('"Power Cars Mundo"');
  });

  it("keeps a comma inside the field", () => {
    expect(quoteField("Medindustrias, S.A. De C.V.")).toBe(
      '"Medindustrias, S.A. De C.V."',
    );
  });

  it("doubles an embedded quote", () => {
    expect(quoteField('Centro "El Roble"')).toBe('"Centro ""El Roble"""');
  });

  it("quotes an empty value", () => {
    expect(quoteField("")).toBe('""');
  });
});

describe("parseCsv", () => {
  it("reads quoted fields", () => {
    expect(parseCsv('"a","b","c"')).toEqual([["a", "b", "c"]]);
  });

  it("keeps a comma that sits inside a quoted field", () => {
    const line = '"Ciudad de México","IZ-57","Medindustrias, S.A. De C.V."';
    expect(parseCsv(line)).toEqual([
      ["Ciudad de México", "IZ-57", "Medindustrias, S.A. De C.V."],
    ]);
  });

  it("unescapes a doubled quote", () => {
    expect(parseCsv('"Centro ""El Roble"""')).toEqual([['Centro "El Roble"']]);
  });

  it("reads empty fields", () => {
    expect(parseCsv('"a","","c"')).toEqual([["a", "", "c"]]);
  });

  it("reads several rows", () => {
    expect(parseCsv('"a","b"\n"c","d"')).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("ignores a trailing newline instead of yielding an empty row", () => {
    expect(parseCsv('"a","b"\n')).toEqual([["a", "b"]]);
  });

  it("handles CRLF line endings", () => {
    expect(parseCsv('"a","b"\r\n"c","d"\r\n')).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("keeps a newline that sits inside a quoted field", () => {
    expect(parseCsv('"line one\nline two","b"')).toEqual([
      ["line one\nline two", "b"],
    ]);
  });

  it("skips comment lines", () => {
    expect(parseCsv('# provenance\n"a","b"')).toEqual([["a", "b"]]);
  });

  it("skips blank lines between rows", () => {
    expect(parseCsv('"a","b"\n\n"c","d"')).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("strips a UTF-8 BOM so the first field still matches", () => {
    expect(parseCsv('﻿"Ciudad de México","IZ-13"')).toEqual([
      ["Ciudad de México", "IZ-13"],
    ]);
  });

  it("trims an unquoted field but not a quoted one", () => {
    // Quotes are what declares surrounding space deliberate.
    expect(parseCsv('  a  ,"  b  "')).toEqual([["a", "  b  "]]);
  });

  it("reads a row with fewer fields than the others", () => {
    expect(parseCsv('"a","b","c"\n"d","e"')).toEqual([
      ["a", "b", "c"],
      ["d", "e"],
    ]);
  });
});

describe("parseCsvBody", () => {
  it("drops the header row", () => {
    const text = '"state","code"\n"Ciudad de México","IZ-13"';
    expect(parseCsvBody(text)).toEqual([["Ciudad de México", "IZ-13"]]);
  });

  it("returns nothing when the file is only a header", () => {
    expect(parseCsvBody('"state","code"\n')).toEqual([]);
  });
});

describe("round trip", () => {
  it("survives commas, quotes and empty values", () => {
    const header = ["state", "code", "razonSocial", "contactName"];
    const rows = [
      ["Ciudad de México", "IZ-57", "Medindustrias, S.A. De C.V.", ""],
      ["Puebla", "CVV04", 'Centro "El Roble"', "Miguel Morales"],
    ];

    expect(parseCsvBody(toCsv(header, rows))).toEqual(rows);
  });
});

describe("toCsvRow", () => {
  it("quotes every field, including empty ones", () => {
    expect(toCsvRow(["a", "", "c"])).toBe('"a","","c"');
  });
});
