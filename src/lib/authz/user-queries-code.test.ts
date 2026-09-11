import { describe, expect, it } from "vitest";
import { ROLE, roleCodeOf } from "./roles";
import { getUserIdsWithRole, roleCodesOf, whereHasRole } from "./user-queries";

/**
 * Fase 3 (H-09): role resolution by stable code.
 *
 * `whereHasRole` matches `code` first and falls back to `name` only for
 * rows that predate the backfill — renaming "FSR" cannot empty the FSR
 * lists, and the `active` filters stay on both sides of the join.
 */
describe("whereHasRole", () => {
  it("resolves the FSR code first, keeping the active filters", () => {
    expect(whereHasRole(ROLE.FSR)).toEqual({
      userRoles: {
        some: {
          active: true,
          role: {
            active: true,
            OR: [{ code: "FSR" }, { code: null, name: "FSR" }],
          },
        },
      },
    });
  });

  it("roleCodeOf prefers code over the editable label", () => {
    expect(roleCodeOf({ code: "FSR", name: "Field-renamed" })).toBe("FSR");
    expect(roleCodeOf({ name: "FSR" })).toBe("FSR");
    expect(roleCodeOf(null)).toBeNull();
  });

  it("roleCodesOf maps code with name fallback", () => {
    expect(
      roleCodesOf({
        userRoles: [
          { role: { code: "FSR", name: "Field-renamed" } },
          { role: { code: null, name: "CUSTOM" } },
        ],
      }),
    ).toEqual(["FSR", "CUSTOM"]);
  });

  it("getUserIdsWithRole exists for the FSR audience", async () => {
    // Shape-level: the function is the id-shaped twin used by audiences.
    // Behavior against real rows belongs to the integration matrix
    // (TODO promote once Fase 2 lands).
    expect(typeof getUserIdsWithRole).toBe("function");
  });
});
