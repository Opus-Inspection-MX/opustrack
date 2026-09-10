import { describe, expect, it } from "vitest";
import { INCIDENT_PROGRAM_CLIENT_IDS_PARAM } from "./query-params";

describe("incident-program query params", () => {
  it("locks the clientIds wire key", () => {
    expect(INCIDENT_PROGRAM_CLIENT_IDS_PARAM).toBe("clientIds");
  });

  it("writer and reader agree on the same key (download round-trip)", () => {
    // Writer: incident-program-client.tsx builds the download URL.
    const params = new URLSearchParams();
    params.set(INCIDENT_PROGRAM_CLIENT_IDS_PARAM, ["c1", "c2"].join(","));

    // Reader: route.ts parses the same URL.
    const url = new URL(`https://example.test/api?${params.toString()}`);
    expect(url.searchParams.get(INCIDENT_PROGRAM_CLIENT_IDS_PARAM)).toBe(
      "c1,c2",
    );
  });
});
