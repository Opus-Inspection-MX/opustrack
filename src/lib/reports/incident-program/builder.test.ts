import { describe, expect, it } from "vitest";
import {
  buildIncidentProgram,
  classifyIncidentType,
  rangeTitle,
  shortName,
} from "./builder";
import type { IncidentProgramInput, ProgramRow } from "./types";

function makeInput(
  overrides: Partial<IncidentProgramInput> = {},
): IncidentProgramInput {
  return {
    startDate: "2026-05-01",
    endDate: "2026-05-31",
    entries: [],
    vacations: [],
    holidays: [],
    ...overrides,
  };
}

function rowsOfKind(rows: ProgramRow[], kind: string): ProgramRow[] {
  return rows.filter((r) => r.kind === kind);
}

describe("rangeTitle", () => {
  it("keeps the source workbook's spaced style for a whole month", () => {
    expect(rangeTitle("2026-05-01", "2026-05-31")).toBe("M A Y O   2 0 2 6");
    expect(rangeTitle("2026-04-01", "2026-04-30")).toBe("A B R I L   2 0 2 6");
  });

  it("labels partial ranges with their bounds", () => {
    expect(rangeTitle("2026-05-04", "2026-05-16")).toBe(
      "04 MAYO 2026 - 16 MAYO 2026",
    );
  });

  it("labels multi-month ranges with their bounds", () => {
    expect(rangeTitle("2026-05-01", "2026-06-30")).toBe(
      "01 MAYO 2026 - 30 JUNIO 2026",
    );
  });
});

describe("shortName", () => {
  it("uses the first token of the name, upper-cased", () => {
    expect(shortName("Jesús Ramírez López")).toBe("JESÚS");
    expect(shortName("  castro  ")).toBe("CASTRO");
  });

  it("returns an empty string for blank input", () => {
    expect(shortName("")).toBe("");
    expect(shortName("   ")).toBe("");
  });
});

describe("classifyIncidentType", () => {
  it("routes opacimeter and gas work to its own row", () => {
    expect(classifyIncidentType("Cal. Opacímetro")).toBe(
      "CAL_OPACIMETRO_GASES",
    );
    expect(classifyIncidentType("Analizador de GASES")).toBe(
      "CAL_OPACIMETRO_GASES",
    );
  });

  it("routes remaining calibration work to phase II", () => {
    expect(classifyIncidentType("Calibración")).toBe("CALIBRACION_FASE_II");
  });

  it("routes maintenance types to the maintenance row", () => {
    expect(classifyIncidentType("Mantenimiento Preventivo")).toBe(
      "MANTENIMIENTO",
    );
    expect(classifyIncidentType("MANTENIMIENTO")).toBe("MANTENIMIENTO");
    expect(classifyIncidentType("Mantenimiento de Báscula")).toBe(
      "MANTENIMIENTO",
    );
  });

  it("treats every other type as reactive incident work", () => {
    expect(classifyIncidentType("Falla Eléctrica")).toBe("INCIDENCIAS");
    expect(classifyIncidentType("Falla de Software")).toBe("INCIDENCIAS");
    expect(classifyIncidentType("Suministro")).toBe("INCIDENCIAS");
    expect(classifyIncidentType(null)).toBe("INCIDENCIAS");
  });
});

describe("buildIncidentProgram — calendar skeleton", () => {
  it("covers every ISO week overlapping the range, Monday to Saturday", () => {
    const report = buildIncidentProgram(makeInput());

    // May 2026: 1st is a Friday, 31st is a Sunday.
    expect(report.weeks).toHaveLength(5);
    for (const week of report.weeks) {
      expect(week.days).toHaveLength(6);
      expect(week.days.map((d) => d.weekday)).toEqual([
        "L",
        "M",
        "Mi",
        "J",
        "V",
        "S",
      ]);
    }
    expect(report.weeks[0].days[0].date).toBe("2026-04-27");
    expect(report.weeks[4].days[5].date).toBe("2026-05-30");
  });

  it("supports an arbitrary day range, not just whole months", () => {
    const report = buildIncidentProgram(
      makeInput({ startDate: "2026-05-06", endDate: "2026-05-13" }),
    );

    expect(report.weeks).toHaveLength(2);
    expect(report.weeks[0].days[0].date).toBe("2026-05-04");
    expect(report.weeks[1].days[5].date).toBe("2026-05-16");
  });

  it("flags days the rendered weeks cover but the range excludes", () => {
    const report = buildIncidentProgram(
      makeInput({ startDate: "2026-05-06", endDate: "2026-05-13" }),
    );

    expect(report.weeks[0].days.map((d) => d.inRange)).toEqual([
      false,
      false,
      true,
      true,
      true,
      true,
    ]);
  });
});

describe("buildIncidentProgram — rows", () => {
  it("always emits one CENTRO slot and the incidencias row", () => {
    const week = buildIncidentProgram(makeInput()).weeks[0];

    expect(week.rows.map((r) => r.kind)).toEqual([
      "CENTRO",
      "MANTENIMIENTO",
      "INCIDENCIAS",
    ]);
  });

  it("places a cliente code and its responsables on the matching day", () => {
    const report = buildIncidentProgram(
      makeInput({
        entries: [
          {
            date: "2026-05-04",
            clienteCode: "CVV24",
            category: "MANTENIMIENTO",
            responsables: ["JESUS", "CASTRO"],
          },
        ],
      }),
    );

    const week = report.weeks[1];
    expect(week.rows[0].cells[0]).toBe("CVV24");
    expect(week.rows[1].cells[0]).toBe("JESUS, CASTRO");
    expect(report.incidentCount).toBe(1);
  });

  it("sends reactive incidents to the incidencias row, without a CENTRO", () => {
    const report = buildIncidentProgram(
      makeInput({
        entries: [
          {
            date: "2026-05-07",
            clienteCode: "CVV13",
            category: "INCIDENCIAS",
            responsables: ["ADRIAN", "JESUS"],
          },
        ],
      }),
    );

    const week = report.weeks[1];
    expect(rowsOfKind(week.rows, "CENTRO")[0].cells[3]).toBeNull();
    expect(rowsOfKind(week.rows, "INCIDENCIAS")[0].cells[3]).toBe(
      "ADRIAN, JESUS",
    );
  });

  it("adds calibration rows only when the slot has calibration work", () => {
    const report = buildIncidentProgram(
      makeInput({
        entries: [
          {
            date: "2026-05-05",
            clienteCode: "CVV23",
            category: "MANTENIMIENTO",
            responsables: ["ALEJANDRO"],
          },
          {
            date: "2026-05-05",
            clienteCode: "CVV23",
            category: "CALIBRACION_FASE_II",
            responsables: ["ALEJANDRO", "CASTRO"],
          },
        ],
      }),
    );

    expect(report.weeks[1].rows.map((r) => r.kind)).toEqual([
      "CENTRO",
      "MANTENIMIENTO",
      "CALIBRACION_FASE_II",
      "INCIDENCIAS",
    ]);
    expect(report.weeks[1].rows[2].cells[1]).toBe("ALEJANDRO, CASTRO");
  });

  it("repeats the CENTRO slot when two clientes share the same day", () => {
    const report = buildIncidentProgram(
      makeInput({
        entries: [
          {
            date: "2026-05-06",
            clienteCode: "CVV13",
            category: "MANTENIMIENTO",
            responsables: ["CASTRO"],
          },
          {
            date: "2026-05-06",
            clienteCode: "CVV29",
            category: "MANTENIMIENTO",
            responsables: ["JAVIER"],
          },
        ],
      }),
    );

    const centros = rowsOfKind(report.weeks[1].rows, "CENTRO");
    expect(centros).toHaveLength(2);
    expect(centros[0].cells[2]).toBe("CVV13");
    expect(centros[1].cells[2]).toBe("CVV29");
  });

  it("keeps a cliente in the same slot across the days of a week", () => {
    const report = buildIncidentProgram(
      makeInput({
        entries: [
          {
            date: "2026-05-04",
            clienteCode: "CVV20",
            category: "MANTENIMIENTO",
            responsables: [],
          },
          {
            date: "2026-05-05",
            clienteCode: "CVV09",
            category: "MANTENIMIENTO",
            responsables: [],
          },
          {
            date: "2026-05-05",
            clienteCode: "CVV20",
            category: "MANTENIMIENTO",
            responsables: [],
          },
        ],
      }),
    );

    const centros = rowsOfKind(report.weeks[1].rows, "CENTRO");
    expect(centros).toHaveLength(2);
    expect(centros[0].cells[0]).toBe("CVV20");
    expect(centros[0].cells[1]).toBe("CVV20");
    expect(centros[1].cells[1]).toBe("CVV09");
  });

  it("groups planned incidents with no cliente into the incidencias row", () => {
    const report = buildIncidentProgram(
      makeInput({
        entries: [
          {
            date: "2026-05-04",
            clienteCode: null,
            category: "MANTENIMIENTO",
            responsables: ["CASTRO"],
          },
        ],
      }),
    );

    expect(rowsOfKind(report.weeks[1].rows, "CENTRO")[0].cells[0]).toBeNull();
    expect(rowsOfKind(report.weeks[1].rows, "INCIDENCIAS")[0].cells[0]).toBe(
      "CASTRO",
    );
  });

  it("emits the vacaciones row only when somebody is on vacation", () => {
    const report = buildIncidentProgram(
      makeInput({
        vacations: [{ date: "2026-05-11", responsables: ["ALEJANDRO"] }],
      }),
    );

    expect(rowsOfKind(report.weeks[1].rows, "VACACIONES")).toHaveLength(0);
    const target = rowsOfKind(report.weeks[2].rows, "VACACIONES");
    expect(target).toHaveLength(1);
    expect(target[0].cells[0]).toBe("ALEJANDRO");
  });

  it("marks holidays as FERIADO when nothing is scheduled", () => {
    const report = buildIncidentProgram(
      makeInput({ holidays: ["2026-05-01"] }),
    );

    expect(rowsOfKind(report.weeks[0].rows, "CENTRO")[0].cells[4]).toBe(
      "FERIADO",
    );
    expect(report.weeks[0].days[4].isHoliday).toBe(true);
  });

  it("lets an incident win over the FERIADO label", () => {
    const report = buildIncidentProgram(
      makeInput({
        holidays: ["2026-05-01"],
        entries: [
          {
            date: "2026-05-01",
            clienteCode: "CVV11",
            category: "MANTENIMIENTO",
            responsables: ["CASTRO"],
          },
        ],
      }),
    );

    expect(rowsOfKind(report.weeks[0].rows, "CENTRO")[0].cells[4]).toBe(
      "CVV11",
    );
  });

  it("ignores entries that fall outside the rendered weeks", () => {
    const report = buildIncidentProgram(
      makeInput({
        entries: [
          {
            date: "2026-07-01",
            clienteCode: "CVV99",
            category: "MANTENIMIENTO",
            responsables: [],
          },
        ],
      }),
    );

    const codes = report.weeks
      .flatMap((w) => rowsOfKind(w.rows, "CENTRO"))
      .flatMap((r) => r.cells)
      .filter(Boolean);
    expect(codes).toEqual([]);
    expect(report.incidentCount).toBe(0);
  });

  it("drops Sundays, which the format does not render", () => {
    const report = buildIncidentProgram(makeInput());
    const dates = report.weeks.flatMap((w) => w.days.map((d) => d.date));
    expect(dates).not.toContain("2026-05-03");
  });

  it("de-duplicates responsables reported twice on the same cell", () => {
    const report = buildIncidentProgram(
      makeInput({
        entries: [
          {
            date: "2026-05-04",
            clienteCode: "CVV24",
            category: "MANTENIMIENTO",
            responsables: ["JESUS"],
          },
          {
            date: "2026-05-04",
            clienteCode: "CVV24",
            category: "MANTENIMIENTO",
            responsables: ["JESUS", "CASTRO"],
          },
        ],
      }),
    );

    expect(report.weeks[1].rows[1].cells[0]).toBe("JESUS, CASTRO");
    expect(report.incidentCount).toBe(2);
  });
});
