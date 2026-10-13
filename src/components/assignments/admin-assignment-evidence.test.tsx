import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getAssignmentById,
  getAssignmentActivities,
  getAssignmentItems,
  canPerform,
} = vi.hoisted(() => ({
  getAssignmentById: vi.fn(),
  getAssignmentActivities: vi.fn(),
  getAssignmentItems: vi.fn(),
  canPerform: vi.fn(),
}));
vi.mock("@/lib/actions/assignments", () => ({ getAssignmentById }));
vi.mock("@/lib/actions/assignment-activities", () => ({
  getAssignmentActivities,
}));
vi.mock("@/lib/actions/assignment-items", () => ({ getAssignmentItems }));
vi.mock("@/lib/auth/auth", () => ({ canPerform }));
vi.mock("@/components/assignments/assignment-items", () => ({
  AssignmentItems: () => null,
}));
vi.mock("@/components/admin/assignments/reopen-assignment-button", () => ({
  ReopenAssignmentButton: () => null,
}));
vi.mock("@/components/common/back-button", () => ({ BackButton: () => null }));
// Motion visibility is a browser concern; keep evidence rendering isolated here.
vi.mock("@/components/common/page-container", () => ({
  PageContainer: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

import AssignmentDetailPage from "@/app/admin/assignments/[id]/page";
import { formatMX } from "@/lib/utils/datetime";

const startedAt = new Date("2026-10-12T15:00:00Z");
const finishedAt = new Date("2026-10-12T17:00:00Z");

beforeEach(() => {
  vi.resetAllMocks();
  canPerform.mockResolvedValue(false);
  getAssignmentActivities.mockResolvedValue([
    {
      id: "activity-1",
      description: "Completed field work",
      performedAt: startedAt,
    },
  ]);
  getAssignmentItems.mockResolvedValue([]);
  getAssignmentById.mockResolvedValue({
    id: "a1",
    folio: 1,
    incident: { id: 2, title: "Sensor failure", status: { name: "CERRADO" } },
    status: { name: "CERRADO", code: "CERRADO" },
    assignees: [],
    createdAt: startedAt,
    odtFolio: "EXTERNAL-ODT-1",
    startLatitude: 0,
    startLongitude: -99.1,
    endLatitude: 19.4,
    endLongitude: 0,
    startedAt,
    finishedAt,
    startAddress: "Start address",
    endAddress: "End address",
    attachments: [],
  });
});

async function renderEvidence() {
  render(await AssignmentDetailPage({ params: Promise.resolve({ id: "a1" }) }));
  const heading = screen.getByText("Evidencia de campo");
  const card = heading.closest('[data-slot="card"]');
  if (!card) throw new Error("Evidence card missing");
  return within(card as HTMLElement);
}

describe("Administrative assignment evidence", () => {
  it("renders persisted ODT, zero coordinates, capture dates and addresses without mutation controls", async () => {
    const evidence = await renderEvidence();
    expect(evidence.getByText("EXTERNAL-ODT-1")).toBeVisible();
    expect(evidence.getByText("0, -99.1")).toBeVisible();
    expect(evidence.getByText("19.4, 0")).toBeVisible();
    expect(evidence.getByText(formatMX(startedAt))).toBeVisible();
    expect(evidence.getByText(formatMX(finishedAt))).toBeVisible();
    expect(evidence.getByText("Start address")).toBeVisible();
    expect(evidence.getByText("End address")).toBeVisible();
    expect(evidence.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Completed field work")).toBeVisible();
    expect(getAssignmentById).toHaveBeenCalledWith("a1");
  });

  it("distinguishes absent or incomplete coordinate pairs and missing capture evidence", async () => {
    const assignment = await getAssignmentById();
    getAssignmentById.mockResolvedValue({
      ...assignment,
      odtFolio: null,
      startLatitude: null,
      endLongitude: null,
      startedAt: null,
      finishedAt: null,
      startAddress: null,
      endAddress: null,
    });
    const evidence = await renderEvidence();
    expect(evidence.getAllByText("No registrado")).toHaveLength(3);
    expect(evidence.getAllByText("No registrada")).toHaveLength(4);
    expect(evidence.queryByText("0, -99.1")).not.toBeInTheDocument();
  });
});
