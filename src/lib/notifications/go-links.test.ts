import { describe, expect, it } from "vitest";
import {
  incidentGoLink,
  resolveNotificationDestination,
  vacationGoLink,
} from "./go-links";

/**
 * The neutral-link contract: one stable URL per entity, resolved per role at
 * open time. The REPORTER bounce (mailed `/admin/...` links) disappears
 * because no stored link names a role-specific page anymore.
 */

describe("notification go links", () => {
  it("builds one stable URL per entity", () => {
    expect(incidentGoLink(7)).toBe("/notifications/go/incident/7");
    expect(vacationGoLink("v1")).toBe("/notifications/go/vacation/v1");
  });

  it("an operations admin lands on the admin detail", async () => {
    const dest = await resolveNotificationDestination(
      "incident",
      "7",
      (p) => p.startsWith("/admin"),
    );
    expect(dest).toBe("/admin/incidents/7");
  });

  it("a reporter lands on the reporter detail, never on /admin", async () => {
    const dest = await resolveNotificationDestination(
      "incident",
      "7",
      (p) => p.startsWith("/reporter"),
    );
    expect(dest).toBe("/reporter/incidents/7");
  });

  it("an FSR lands on the FSR incident list", async () => {
    const dest = await resolveNotificationDestination(
      "incident",
      "7",
      (p) => p.startsWith("/fsr"),
    );
    expect(dest).toBe("/fsr/incidents");
  });

  it("a vacation admin lands on /admin/vacations, staff on /vacations", async () => {
    await expect(
      resolveNotificationDestination("vacation", "v1", (p) =>
        p.startsWith("/admin"),
      ),
    ).resolves.toBe("/admin/vacations");
    await expect(
      resolveNotificationDestination("vacation", "v1", async (p) => p === "/vacations"),
    ).resolves.toBe("/vacations");
  });

  it("unknown entities, malformed ids and denied users resolve to null (404, never a leak)", async () => {
    await expect(
      resolveNotificationDestination("broadcast", "1", () => true),
    ).resolves.toBeNull();
    await expect(
      resolveNotificationDestination("incident", "abc", () => true),
    ).resolves.toBeNull();
    await expect(
      resolveNotificationDestination("vacation", "", () => true),
    ).resolves.toBeNull();
    await expect(
      resolveNotificationDestination("incident", "7", () => false),
    ).resolves.toBeNull();
    await expect(
      resolveNotificationDestination("vacation", "v1", () => false),
    ).resolves.toBeNull();
  });
});
