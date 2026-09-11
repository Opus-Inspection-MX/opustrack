import { describe, expect, it } from "vitest";
import { quickActions } from "./quick-actions";

/** The palette offers creation shortcuts only for pages the role can open. */
describe("quickActions", () => {
  it("offers every action to the superuser", () => {
    expect(
      quickActions({ prefixes: [], exact: [] }, true).map((a) => a.title),
    ).toEqual(["Nuevo incidente", "Reportar incidente", "Iniciar viaje"]);
  });

  it("offers only field actions to FSR", () => {
    const titles = quickActions(
      { prefixes: ["/fsr/vehicle-trips/start"], exact: [] },
      false,
    ).map((a) => a.title);
    expect(titles).toEqual(["Iniciar viaje"]);
  });

  it("offers only reporting to REPORTER", () => {
    const titles = quickActions(
      { prefixes: ["/reporter/new"], exact: [] },
      false,
    ).map((a) => a.title);
    expect(titles).toEqual(["Reportar incidente"]);
  });

  it("offers nothing without creation routes", () => {
    expect(
      quickActions({ prefixes: ["/vacations"], exact: [] }, false),
    ).toHaveLength(0);
  });
});
