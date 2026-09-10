import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/database/prisma.singleton", () => ({
  prisma: {
    incidentAssignee: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      updateMany: vi.fn(),
    },
    assignmentAssignee: { findMany: vi.fn() },
    incidentEvent: { create: vi.fn() },
  },
}));

import { prisma } from "@/lib/database/prisma.singleton";
import { syncIncidentAssignees } from "./shared";

describe("syncIncidentAssignees audit events (RF-219, LOG semantics)", () => {
  const assigneeFindMany = vi.mocked(prisma.incidentAssignee.findMany);
  const assignmentFindMany = vi.mocked(prisma.assignmentAssignee.findMany);
  const eventCreate = vi.mocked(prisma.incidentEvent.create);

  beforeEach(() => {
    vi.clearAllMocks();
    eventCreate.mockResolvedValue({} as never);
    assignmentFindMany.mockResolvedValue([]);
  });

  it("emits ASSIGNEE_ADDED per new user, attributed to the actor", async () => {
    assigneeFindMany.mockResolvedValue([]);

    const { toAdd } = await syncIncidentAssignees(1, ["fsr1", "fsr2"], {
      actorId: "admin-1",
    });

    expect(toAdd).toEqual(["fsr1", "fsr2"]);
    expect(eventCreate).toHaveBeenCalledTimes(2);
    const [first, second] = eventCreate.mock.calls.map(
      (c) => c[0]?.data,
    ) as unknown as Array<{
      eventType: string;
      actorId: string | null;
      payload: { userId: string };
    }>;
    expect(first?.eventType).toBe("ASSIGNEE_ADDED");
    expect(first?.actorId).toBe("admin-1");
    expect(first?.payload).toEqual({ userId: "fsr1" });
    expect(second?.payload).toEqual({ userId: "fsr2" });
  });

  it("emits ASSIGNEE_REMOVED per retired user", async () => {
    assigneeFindMany.mockResolvedValue([{ userId: "fsr1" }] as never);

    await syncIncidentAssignees(1, [], { actorId: "admin-1" });

    expect(eventCreate).toHaveBeenCalledTimes(1);
    const event = eventCreate.mock.calls[0]?.[0]?.data as unknown as {
      eventType: string;
      payload: { userId: string };
    };
    expect(event.eventType).toBe("ASSIGNEE_REMOVED");
    expect(event.payload).toEqual({ userId: "fsr1" });
  });

  it("emits nothing when the desired set already matches", async () => {
    assigneeFindMany.mockResolvedValue([{ userId: "fsr1" }] as never);

    await syncIncidentAssignees(1, ["fsr1"], { actorId: "admin-1" });

    expect(eventCreate).not.toHaveBeenCalled();
  });

  it("still blocks retiring an FSR with an active assignment (no events)", async () => {
    assigneeFindMany.mockResolvedValue([{ userId: "fsr1" }] as never);
    assignmentFindMany.mockResolvedValue([{ userId: "fsr1" }] as never);

    await expect(syncIncidentAssignees(1, [])).rejects.toThrow(
      /asignación activa/,
    );
    expect(eventCreate).not.toHaveBeenCalled();
  });
});
