import { describe, expect, it } from "vitest";
import {
  assertIncidentTransition,
  INCIDENT_STATE,
  INCIDENT_TERMINAL_STATES,
  isIncidentState,
} from "./incident-machine";

describe("assertIncidentTransition", () => {
  it("allows forward progress along the happy path", () => {
    expect(() =>
      assertIncidentTransition(INCIDENT_STATE.ABIERTO, INCIDENT_STATE.ASIGNADO),
    ).not.toThrow();
    expect(() =>
      assertIncidentTransition(INCIDENT_STATE.ASIGNADO, INCIDENT_STATE.VISTO),
    ).not.toThrow();
    expect(() =>
      assertIncidentTransition(
        INCIDENT_STATE.INICIADO,
        INCIDENT_STATE.EN_PROGRESO,
      ),
    ).not.toThrow();
    expect(() =>
      assertIncidentTransition(
        INCIDENT_STATE.EN_PROGRESO,
        INCIDENT_STATE.CERRADO,
      ),
    ).not.toThrow();
  });

  it("allows staying in the same state (idempotent sync)", () => {
    expect(() =>
      assertIncidentTransition(INCIDENT_STATE.VISTO, INCIDENT_STATE.VISTO),
    ).not.toThrow();
  });

  it("allows cancelling from any non-terminal state", () => {
    expect(() =>
      assertIncidentTransition(
        INCIDENT_STATE.ABIERTO,
        INCIDENT_STATE.CANCELADA,
      ),
    ).not.toThrow();
    expect(() =>
      assertIncidentTransition(
        INCIDENT_STATE.EN_PROGRESO,
        INCIDENT_STATE.CANCELADA,
      ),
    ).not.toThrow();
  });

  it("allows the reopen path CERRADO → EN_PROGRESO", () => {
    expect(() =>
      assertIncidentTransition(
        INCIDENT_STATE.CERRADO,
        INCIDENT_STATE.EN_PROGRESO,
      ),
    ).not.toThrow();
  });

  it("rejects skipping intermediate states", () => {
    expect(() =>
      assertIncidentTransition(INCIDENT_STATE.ABIERTO, INCIDENT_STATE.VISTO),
    ).toThrow(/Transición de incidencia inválida/);
    expect(() =>
      assertIncidentTransition(
        INCIDENT_STATE.ASIGNADO,
        INCIDENT_STATE.INICIADO,
      ),
    ).toThrow();
  });

  it("rejects cancelling an already-closed incident", () => {
    expect(() =>
      assertIncidentTransition(
        INCIDENT_STATE.CERRADO,
        INCIDENT_STATE.CANCELADA,
      ),
    ).toThrow();
  });

  it("treats CANCELADA as terminal (only self-loop allowed)", () => {
    expect(() =>
      assertIncidentTransition(
        INCIDENT_STATE.CANCELADA,
        INCIDENT_STATE.CANCELADA,
      ),
    ).not.toThrow();
    expect(() =>
      assertIncidentTransition(
        INCIDENT_STATE.CANCELADA,
        INCIDENT_STATE.ABIERTO,
      ),
    ).toThrow();
  });
});

describe("isIncidentState", () => {
  it("returns true for valid states", () => {
    expect(isIncidentState("ABIERTO")).toBe(true);
    expect(isIncidentState("CANCELADA")).toBe(true);
  });

  it("returns false for unknown strings and non-strings", () => {
    expect(isIncidentState("FOO")).toBe(false);
    expect(isIncidentState("")).toBe(false);
    expect(isIncidentState(123)).toBe(false);
    expect(isIncidentState(null)).toBe(false);
    expect(isIncidentState(undefined)).toBe(false);
  });
});

describe("INCIDENT_TERMINAL_STATES", () => {
  it("contains exactly CERRADO and CANCELADA", () => {
    expect(INCIDENT_TERMINAL_STATES.has(INCIDENT_STATE.CERRADO)).toBe(true);
    expect(INCIDENT_TERMINAL_STATES.has(INCIDENT_STATE.CANCELADA)).toBe(true);
    expect(INCIDENT_TERMINAL_STATES.has(INCIDENT_STATE.ABIERTO)).toBe(false);
    expect(INCIDENT_TERMINAL_STATES.size).toBe(2);
  });
});
