import { describe, expect, it } from "vitest";
import {
  assignmentScopeWhere,
  fsrScopeWhere,
  incidentScopeWhere,
  type ReportScope,
  vehicleTripScopeWhere,
} from "./report-scope";

const ADMIN: ReportScope = { clienteIds: null };
const ONE: ReportScope = { clienteIds: ["c1"] };
const MANY: ReportScope = { clienteIds: ["c1", "c2"] };
const NONE: ReportScope = { clienteIds: [] };

describe("incidentScopeWhere", () => {
  it("does not restrict an admin scope", () => {
    expect(incidentScopeWhere(ADMIN)).toEqual({});
  });

  it("filters by a single cliente", () => {
    expect(incidentScopeWhere(ONE)).toEqual({ clienteId: { in: ["c1"] } });
  });

  it("filters by every assigned cliente", () => {
    expect(incidentScopeWhere(MANY)).toEqual({
      clienteId: { in: ["c1", "c2"] },
    });
  });

  it("matches nothing when the user has no cliente", () => {
    // Fail closed: no assignment must never mean "see everything".
    expect(incidentScopeWhere(NONE)).toEqual({ clienteId: { in: [] } });
  });
});

describe("assignmentScopeWhere", () => {
  it("does not restrict an admin scope", () => {
    expect(assignmentScopeWhere(ADMIN)).toEqual({});
  });

  it("reaches the cliente through the incident", () => {
    expect(assignmentScopeWhere(MANY)).toEqual({
      incident: { clienteId: { in: ["c1", "c2"] } },
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
        { assignment: { incident: { clienteId: { in: ["c1"] } } } },
        {
          assignmentId: null,
          fsr: {
            clienteAssignments: {
              some: { active: true, clienteId: { in: ["c1"] } },
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

  it("filters users by their active cliente assignments", () => {
    expect(fsrScopeWhere(MANY)).toEqual({
      clienteAssignments: {
        some: { active: true, clienteId: { in: ["c1", "c2"] } },
      },
    });
  });
});
