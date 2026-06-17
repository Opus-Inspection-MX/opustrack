import { describe, expect, it } from "vitest";
import {
  CRITICAL_PRIORITY_THRESHOLD,
  isCriticalPriority,
} from "./incident-type";

describe("isCriticalPriority", () => {
  it("is true at or above the threshold", () => {
    expect(isCriticalPriority(CRITICAL_PRIORITY_THRESHOLD)).toBe(true);
    expect(isCriticalPriority(10)).toBe(true);
  });

  it("is false below the threshold", () => {
    expect(isCriticalPriority(CRITICAL_PRIORITY_THRESHOLD - 1)).toBe(false);
    expect(isCriticalPriority(1)).toBe(false);
  });
});
