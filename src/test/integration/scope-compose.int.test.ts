import { beforeAll, describe, expect, it } from "vitest";
import { GET } from "@/app/api/schedules/route";
import {
  getIncidentProgramReport,
  getScheduleOptions,
} from "@/lib/actions/incident-program";
import { MATRIX_COMPOSE, MATRIX_ROUTES } from "./coverage";
import { createWorld, type IntWorld } from "./fixtures";
import { actAs } from "./session-state";

/**
 * Key-collision suite (H-02, H-18) with real data.
 *
 * Tenant scope must compose with user filters through AND, never through a
 * spread or Object.assign that lets one side replace the other's keys.
 * The 0b `withScope` composition is merged, so cases assert it directly.
 */

const COVERED_COMPOSE = new Set([
  "incident-program.ts :: getScheduleOptions",
  "incident-program.ts :: getIncidentProgramReport",
]);
const COVERED_ROUTES = new Set(["app/api/schedules/route.ts :: GET"]);

let world: IntWorld;

function todayRange(): { startDate: string; endDate: string } {
  const day = new Date().toISOString().slice(0, 10);
  return { startDate: day, endDate: day };
}

function schedulesUrl(params: Record<string, string>): Request {
  const query = new URLSearchParams(params).toString();
  return new Request(`http://localhost/api/schedules?${query}`);
}

beforeAll(async () => {
  world = await createWorld("compose");
});

describe("scope composition registration", () => {
  it("registers every MATRIX_COMPOSE action and route in this file", () => {
    expect(
      [...MATRIX_COMPOSE].filter((key) => !COVERED_COMPOSE.has(key)),
      "MATRIX_COMPOSE entries without a case here",
    ).toEqual([]);
    expect(
      [...MATRIX_ROUTES].filter((key) => !COVERED_ROUTES.has(key)),
      "MATRIX_ROUTES entries without a case here",
    ).toEqual([]);
  });
});

describe("H-02: clientIds must narrow the scope, never replace it", () => {
  // Fixed(0b): incidentWindowWhere spreads the scope's clientId key and then
  // spreads the requested clientIds over it — fsrA reads B's program.
  it(
    "getIncidentProgramReport: clientIds=[B] stays empty for fsrA",
    async () => {
      actAs(world.fsrA.id);
      const report = await getIncidentProgramReport({
        ...todayRange(),
        clientIds: [world.clientB.id],
      });
      expect(report.incidentCount).toBe(0);
    },
  );

  it(
    "getScheduleOptions: clientIds=[B] shows no B for fsrA",
    async () => {
      actAs(world.fsrA.id);
      const options = await getScheduleOptions({
        ...todayRange(),
        clientIds: [world.clientB.id],
      });
      const codes = options.flatMap((option) => option.clientCodes);
      expect(codes).not.toContain(world.clientB.code);
    },
  );

  it("getScheduleOptions: clientIds=[A] still filters for fsrA", async () => {
    actAs(world.fsrA.id);
    const options = await getScheduleOptions({
      ...todayRange(),
      clientIds: [world.clientA.id],
    });
    const codes = options.flatMap((option) => option.clientCodes);
    expect(codes).toContain(world.clientA.code);
  });
});

describe("H-18: /api/schedules keeps search AND scope", () => {
  // Fixed(0b): `where.OR = [search]` is overwritten by
  // `Object.assign(where, scheduleScopeWhere(scope))` — the search is lost
  // (the scope survives, so B never leaks here; the global schedule that
  // does not match the search proves the filter died).
  it("search narrows inside the scope for fsrA", async () => {
    actAs(world.fsrA.id);
    const response = await GET(schedulesUrl({ search: world.scheduleA.title }));
    const body = (await response.json()) as {
      success: boolean;
      data: Array<{ id: string }>;
    };
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    const ids = body.data.map((row) => row.id);
    expect(ids).toContain(world.scheduleA.id);
    expect(ids).not.toContain(world.scheduleGlobal.id);
    expect(ids).not.toContain(world.scheduleB.id);
  });

  it("without search the scope still holds (A + global, never B)", async () => {
    actAs(world.fsrA.id);
    const response = await GET(schedulesUrl({}));
    const body = (await response.json()) as {
      data: Array<{ id: string }>;
    };
    const ids = body.data.map((row) => row.id);
    expect(ids).toContain(world.scheduleA.id);
    expect(ids).toContain(world.scheduleGlobal.id);
    expect(ids).not.toContain(world.scheduleB.id);
  });

  it("clientId=B is a 403 for fsrA, clientId=A filters", async () => {
    actAs(world.fsrA.id);
    const forbidden = await GET(schedulesUrl({ clientId: world.clientB.id }));
    expect(forbidden.status).toBe(403);

    const allowed = await GET(schedulesUrl({ clientId: world.clientA.id }));
    const body = (await allowed.json()) as {
      data: Array<{ id: string }>;
    };
    const ids = body.data.map((row) => row.id);
    expect(ids).toContain(world.scheduleA.id);
    expect(ids).not.toContain(world.scheduleB.id);
  });
});
