import { describe, expect, it } from "vitest";
import {
  assignmentScopeWhere,
  fsrScopeWhere,
  incidentScopeWhere,
  narrowClientIds,
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
    // Null-client data stays reachable for a fully client-less user —
    // the same answer `canAccessClientAsync` gives for that user.
    expect(scopeIncludesClient(NONE, null)).toBe(true);
    expect(scopeIncludesClient(MANY, null)).toBe(false);
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

describe("withScope", () => {
  it("ANDs the caller where with a non-empty scope fragment", () => {
    expect(
      withScope({ active: true }, { clientId: { in: ["c1"] } }),
    ).toEqual({
      AND: [{ active: true }, { clientId: { in: ["c1"] } }],
    });
  });

  it("returns the caller where untouched for an empty scope", () => {
    // An admin scope carries no fragment: no AND wrapper, same reference.
    const where = { active: true };
    expect(withScope(where, {})).toBe(where);
  });
});

describe("narrowClientIds", () => {
  it("passes the request through for an admin scope", () => {
    expect(narrowClientIds(["cB"], ADMIN)).toEqual(["cB"]);
    expect(narrowClientIds(undefined, ADMIN)).toBeUndefined();
  });

  it("intersects a request with the scope", () => {
    expect(narrowClientIds(["c1", "c9"], MANY)).toEqual(["c1"]);
  });

  it("matches nothing when the request falls fully outside the scope", () => {
    expect(narrowClientIds(["c9"], ONE)).toEqual([]);
  });

  it("falls back to the scope when nothing is requested", () => {
    expect(narrowClientIds(undefined, MANY)).toEqual(["c1", "c2"]);
  });
});
