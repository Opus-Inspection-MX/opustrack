import { describe, expect, it } from "vitest";
import { ASSIGNMENT_STATE } from "@/lib/state-machine/assignment-machine";
import { INCIDENT_STATE } from "@/lib/state-machine/incident-machine";
import {
  codeOf,
  isAssignmentClosed,
  isIncidentCancelled,
  isIncidentClosed,
  isIncidentTerminal,
  isUserActive,
  isVacationApproved,
  isVacationBlocking,
  isVacationPending,
  isVehicleAvailable,
  isVehicleTripOpen,
  USER_STATUS,
  VACATION_STATUS,
  VEHICLE_STATUS,
  VEHICLE_TRIP_STATUS,
} from "./status-codes";

describe("codeOf", () => {
  it("prefers code over name", () => {
    expect(codeOf({ code: "ACTIVO", name: "Renamed" })).toBe("ACTIVO");
  });

  it("falls back to name for rows that predate the backfill", () => {
    expect(codeOf({ name: "ACTIVO" })).toBe("ACTIVO");
    expect(codeOf({ code: null, name: "ACTIVO" })).toBe("ACTIVO");
  });

  it("returns null for missing rows", () => {
    expect(codeOf(null)).toBeNull();
    expect(codeOf(undefined)).toBeNull();
    expect(codeOf({})).toBeNull();
  });
});

describe("helpers resolve by code, not by label", () => {
  it("user stays active when the ACTIVO label is renamed", () => {
    expect(isUserActive({ code: USER_STATUS.ACTIVO, name: "Renamed" })).toBe(
      true,
    );
    expect(isUserActive({ code: "INACTIVO", name: "ACTIVO" })).toBe(false);
  });

  it("incident terminal states survive a CERRADO rename", () => {
    const closed = { code: INCIDENT_STATE.CERRADO, name: "Renamed" };
    expect(isIncidentTerminal(closed)).toBe(true);
    expect(isIncidentClosed(closed)).toBe(true);
    expect(isIncidentCancelled(closed)).toBe(false);
    expect(
      isIncidentCancelled({
        code: INCIDENT_STATE.CANCELADA,
        name: "Renamed",
      }),
    ).toBe(true);
    expect(isIncidentTerminal({ code: INCIDENT_STATE.ABIERTO })).toBe(false);
  });

  it("assignment closed survives a rename", () => {
    expect(
      isAssignmentClosed({ code: ASSIGNMENT_STATE.CERRADO, name: "Renamed" }),
    ).toBe(true);
    expect(isAssignmentClosed({ code: ASSIGNMENT_STATE.INICIADO })).toBe(false);
  });

  it("vacation states survive renames", () => {
    expect(
      isVacationPending({ code: VACATION_STATUS.PENDIENTE, name: "Renamed" }),
    ).toBe(true);
    expect(
      isVacationApproved({ code: VACATION_STATUS.APROBADA, name: "Renamed" }),
    ).toBe(true);
    expect(
      isVacationBlocking({ code: VACATION_STATUS.APROBADA, name: "Renamed" }),
    ).toBe(true);
    expect(
      isVacationBlocking({ code: VACATION_STATUS.RECHAZADA, name: "Renamed" }),
    ).toBe(false);
  });

  it("vehicle and trip states survive renames", () => {
    expect(
      isVehicleAvailable({ code: VEHICLE_STATUS.AVAILABLE, name: "Renamed" }),
    ).toBe(true);
    expect(isVehicleAvailable({ code: VEHICLE_STATUS.IN_USE })).toBe(false);
    expect(
      isVehicleTripOpen({
        code: VEHICLE_TRIP_STATUS.EN_CURSO,
        name: "Renamed",
      }),
    ).toBe(true);
    expect(isVehicleTripOpen({ code: VEHICLE_TRIP_STATUS.COMPLETADO })).toBe(
      false,
    );
  });
});
