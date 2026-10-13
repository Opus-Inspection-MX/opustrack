// @vitest-environment node
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { workflowImage } from "./workflow-ui";
import { addCivilDays, chargeableRange, holidayMatches } from "./workflows";

describe("workflow civil calendar and genuine photo prerequisites", () => {
  it("crosses leap and year boundaries without host timezone arithmetic", () => {
    expect(addCivilDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addCivilDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addCivilDays("2027-01-01", -1)).toBe("2026-12-31");
  });
  it("includes Monday when the absence begins on Sunday", () => {
    expect(chargeableRange("2026-10-11", 1)).toEqual({
      start: "2026-10-11",
      end: "2026-10-12",
      chargedDates: ["2026-10-12"],
    });
  });
  it("counts Saturdays and skips recurring, one-off and nth-Monday holidays", () => {
    const recurring = {
      month: 1,
      day: 1,
      nthMonday: null,
      isRecurring: true,
      year: null,
      active: true,
    };
    expect(chargeableRange("2026-12-31", 3, [recurring]).chargedDates).toEqual([
      "2026-12-31",
      "2027-01-02",
      "2027-01-04",
    ]);
    expect(
      holidayMatches("2027-01-01", {
        ...recurring,
        isRecurring: false,
        year: 2026,
      }),
    ).toBe(false);
    expect(
      holidayMatches("2026-11-16", {
        ...recurring,
        month: 11,
        day: null,
        nthMonday: 3,
      }),
    ).toBe(true);
    expect(
      holidayMatches("2026-11-23", {
        ...recurring,
        month: 11,
        day: null,
        nthMonday: 3,
      }),
    ).toBe(false);
    expect(holidayMatches("2026-01-01", { ...recurring, active: false })).toBe(
      false,
    );
  });
  it("creates distinct structurally valid PNG captures with real scanlines", () => {
    const start = workflowImage("start.png", 40).buffer;
    const end = workflowImage("end.png", 180).buffer;
    expect(start.equals(end)).toBe(false);
    expect(start.subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
    expect(start.readUInt32BE(16)).toBe(16);
    expect(start.readUInt32BE(20)).toBe(16);
    const length = start.readUInt32BE(33);
    const scanlines = inflateSync(start.subarray(41, 41 + length));
    expect(scanlines.length).toBe(16 * 49);
    expect(scanlines[0]).toBe(0);
    expect(scanlines[1]).toBe(40);
  });
});
