import { describe, expect, it } from "vitest";
import {
  ASSIGNMENT_STATE,
  type AssignmentPreconditionCtx,
  assertAssignmentPreconditions,
  assertAssignmentTransition,
  isAssignmentState,
} from "./assignment-machine";

describe("assertAssignmentTransition", () => {
  it("allows the happy path forward", () => {
    expect(() =>
      assertAssignmentTransition(
        ASSIGNMENT_STATE.PENDIENTE_DE_ASIGNACION,
        ASSIGNMENT_STATE.ASIGNADO,
      ),
    ).not.toThrow();
    expect(() =>
      assertAssignmentTransition(
        ASSIGNMENT_STATE.ASIGNADO,
        ASSIGNMENT_STATE.VISTO,
      ),
    ).not.toThrow();
    expect(() =>
      assertAssignmentTransition(
        ASSIGNMENT_STATE.INICIADO,
        ASSIGNMENT_STATE.CERRADO,
      ),
    ).not.toThrow();
  });

  it("allows the on-site resume EN_PROGRESO ↔ INICIADO", () => {
    expect(() =>
      assertAssignmentTransition(
        ASSIGNMENT_STATE.EN_PROGRESO,
        ASSIGNMENT_STATE.INICIADO,
      ),
    ).not.toThrow();
  });

  it("allows admin reopen CERRADO → EN_PROGRESO", () => {
    expect(() =>
      assertAssignmentTransition(
        ASSIGNMENT_STATE.CERRADO,
        ASSIGNMENT_STATE.EN_PROGRESO,
      ),
    ).not.toThrow();
  });

  it("allows rollback to PENDIENTE when the last assignee is removed", () => {
    expect(() =>
      assertAssignmentTransition(
        ASSIGNMENT_STATE.ASIGNADO,
        ASSIGNMENT_STATE.PENDIENTE_DE_ASIGNACION,
      ),
    ).not.toThrow();
  });

  it("rejects skipping states", () => {
    expect(() =>
      assertAssignmentTransition(
        ASSIGNMENT_STATE.PENDIENTE_DE_ASIGNACION,
        ASSIGNMENT_STATE.VISTO,
      ),
    ).toThrow(/Transición de asignación inválida/);
    expect(() =>
      assertAssignmentTransition(
        ASSIGNMENT_STATE.INICIADO,
        ASSIGNMENT_STATE.VISTO,
      ),
    ).toThrow();
  });

  it("rejects reopening a closed assignment into an arbitrary state", () => {
    expect(() =>
      assertAssignmentTransition(
        ASSIGNMENT_STATE.CERRADO,
        ASSIGNMENT_STATE.ASIGNADO,
      ),
    ).toThrow();
  });
});

describe("isAssignmentState", () => {
  it("returns true for valid states", () => {
    expect(isAssignmentState("PENDIENTE_DE_ASIGNACION")).toBe(true);
    expect(isAssignmentState("CERRADO")).toBe(true);
  });

  it("returns false for invalid values", () => {
    expect(isAssignmentState("ABIERTO")).toBe(false); // incident state, not assignment
    expect(isAssignmentState("")).toBe(false);
    expect(isAssignmentState(null)).toBe(false);
    expect(isAssignmentState(42)).toBe(false);
  });
});

describe("assertAssignmentPreconditions", () => {
  function fullCtx(
    overrides: Partial<AssignmentPreconditionCtx> = {},
  ): AssignmentPreconditionCtx {
    return {
      startedAt: new Date(),
      finishedAt: new Date(),
      startLatitude: 19.43,
      startLongitude: -99.13,
      endLatitude: 19.44,
      endLongitude: -99.14,
      attachmentCount: 1,
      odtFolio: "ODT-001",
      ...overrides,
    };
  }

  it("does not enforce preconditions for states without requirements", () => {
    expect(() =>
      assertAssignmentPreconditions(ASSIGNMENT_STATE.VISTO, fullCtx()),
    ).not.toThrow();
    expect(() =>
      assertAssignmentPreconditions(
        ASSIGNMENT_STATE.ASIGNADO,
        fullCtx({ startedAt: null, startLatitude: null }),
      ),
    ).not.toThrow();
  });

  describe("INICIADO", () => {
    it("passes with GPS and start time", () => {
      expect(() =>
        assertAssignmentPreconditions(ASSIGNMENT_STATE.INICIADO, fullCtx()),
      ).not.toThrow();
    });

    it("throws without start GPS", () => {
      expect(() =>
        assertAssignmentPreconditions(
          ASSIGNMENT_STATE.INICIADO,
          fullCtx({ startLatitude: null }),
        ),
      ).toThrow(/ubicación GPS y hora de inicio/);
    });

    it("throws without start time", () => {
      expect(() =>
        assertAssignmentPreconditions(
          ASSIGNMENT_STATE.INICIADO,
          fullCtx({ startedAt: null }),
        ),
      ).toThrow();
    });
  });

  describe("CERRADO", () => {
    it("passes with GPS, finish time, evidence and ODT folio", () => {
      expect(() =>
        assertAssignmentPreconditions(ASSIGNMENT_STATE.CERRADO, fullCtx()),
      ).not.toThrow();
    });

    it("throws without final GPS", () => {
      expect(() =>
        assertAssignmentPreconditions(
          ASSIGNMENT_STATE.CERRADO,
          fullCtx({ endLongitude: null }),
        ),
      ).toThrow(/ubicación GPS final y hora de cierre/);
    });

    it("throws without any evidence attachment", () => {
      expect(() =>
        assertAssignmentPreconditions(
          ASSIGNMENT_STATE.CERRADO,
          fullCtx({ attachmentCount: 0 }),
        ),
      ).toThrow(/al menos una evidencia/);
    });

    it("throws when ODT folio is missing or blank", () => {
      expect(() =>
        assertAssignmentPreconditions(
          ASSIGNMENT_STATE.CERRADO,
          fullCtx({ odtFolio: null }),
        ),
      ).toThrow(/folio ODT/);
      expect(() =>
        assertAssignmentPreconditions(
          ASSIGNMENT_STATE.CERRADO,
          fullCtx({ odtFolio: "   " }),
        ),
      ).toThrow(/folio ODT/);
    });
  });
});
