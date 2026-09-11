import { describe, expect, it } from "vitest";
import {
  assignmentScopeWhere,
  fsrScopeWhere,
  incidentScopeWhere,
  type ReportScope,
  scheduleScopeWhere,
  scopeIncludesClient,
  vehicleTripScopeWhere,
  withScope,
} from "./report-scope";

const ADMIN: ReportScope = { clientIds: null };
const ONE: ReportScope = { clientIds: ["c1"] };
const MANY: ReportScope = { clientIds: ["c1", "c2"] };
const NONE: ReportScope = { clientIds: [] };

describe("incidentScopeWhere", () => {
  it("does not restrict an admin scope", () => {
    expect(incidentScopeWhere(ADMIN)).toEqual({});
  });

  it("filters by a single client", () => {
    expect(incidentScopeWhere(ONE)).toEqual({ clientId: { in: ["c1"] } });
  });

  it("filters by every assigned client", () => {
    expect(incidentScopeWhere(MANY)).toEqual({
      clientId: { in: ["c1", "c2"] },
    });
  });

  it("matches nothing when the user has no client", () => {
    // Fail closed: no assignment must never mean "see everything".
    expect(incidentScopeWhere(NONE)).toEqual({ clientId: { in: [] } });
  });
});

describe("assignmentScopeWhere", () => {
  it("does not restrict an admin scope", () => {
    expect(assignmentScopeWhere(ADMIN)).toEqual({});
  });

  it("reaches the client through the incident", () => {
    expect(assignmentScopeWhere(MANY)).toEqual({
      incident: { clientId: { in: ["c1", "c2"] } },
    });
  });
});

describe("scheduleScopeWhere", () => {
  it("does not restrict an admin scope", () => {
    expect(scheduleScopeWhere(ADMIN)).toEqual({});
  });

  it("shows linked schedules plus global ones", () => {
    expect(scheduleScopeWhere(MANY)).toEqual({
      OR: [
        {
          clients: {
            some: { active: true, clientId: { in: ["c1", "c2"] } },
          },
        },
        { clients: { none: { active: true } } },
      ],
    });
  });

  it("matches nothing when the user has no client — not even globals", () => {
    // Fail closed: no assignment must never mean "see everything".
    expect(scheduleScopeWhere(NONE)).toEqual({
      clients: { some: { clientId: { in: [] } } },
    });
  });
});

describe("scopeIncludesClient", () => {
  it("lets an admin scope reach every client", () => {
    expect(scopeIncludesClient(ADMIN, "c1")).toBe(true);
    expect(scopeIncludesClient(ADMIN, null)).toBe(true);
  });

  it("checks membership for assigned scopes", () => {
    expect(scopeIncludesClient(MANY, "c2")).toBe(true);
    expect(scopeIncludesClient(MANY, "c9")).toBe(false);
  });

  it("denies assigned clients on an empty scope", () => {
    expect(scopeIncludesClient(NONE, "c1")).toBe(false);
    // H-05, fail closed: null-client data is only reachable with an
    // unrestricted scope. A client-less user matches nothing — the old
    // "client-less sees client-less" backdoor is gone.
    expect(scopeIncludesClient(NONE, null)).toBe(false);
    expect(scopeIncludesClient(MANY, null)).toBe(false);
  });
});

describe("withScope", () => {
  it("returns the filter untouched for an unrestricted scope", () => {
    const where = { active: true };
    expect(withScope(where, {})).toBe(where);
  });

  it("keeps both the caller filter and the scope under AND", () => {
    // H-02/H-18: spreading would let one side replace the other's
    // `clientId` key. AND-compose keeps both, so a requested client outside
    // the scope matches nothing instead of leaking.
    expect(withScope({ active: true }, { clientId: { in: ["c1"] } })).toEqual({
      AND: [{ active: true }, { clientId: { in: ["c1"] } }],
    });
  });
});

describe("vehicleTripScopeWhere", () => {
  it("does not restrict an admin scope", () => {
    expect(vehicleTripScopeWhere(ADMIN)).toEqual({});
  });

  it("keeps trips of in-scope FSRs even when the trip has no assignment", () => {
    // A trip without an assignment still belongs to the operation through the
    // FSR who drove it; dropping those would silently under-report mileage.
    expect(vehicleTripScopeWhere(ONE)).toEqual({
      OR: [
        { assignment: { incident: { clientId: { in: ["c1"] } } } },
        {
          assignmentId: null,
          fsr: {
            clientAssignments: {
              some: { active: true, clientId: { in: ["c1"] } },
            },
          },
        },
      ],
    });
  });
});

describe("fsrScopeWhere", () => {
  it("does not restrict an admin scope", () => {
    expect(fsrScopeWhere(ADMIN)).toEqual({});
  });

  it("filters users by their active client assignments", () => {
    expect(fsrScopeWhere(MANY)).toEqual({
      clientAssignments: {
        some: { active: true, clientId: { in: ["c1", "c2"] } },
      },
    });
  });
});
