import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

const { lookup, update } = vi.hoisted(() => ({
  lookup: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@/lib/actions/assignment-availability", () => ({
  getAssignmentFsrAvailability: lookup,
}));
vi.mock("@/lib/actions/assignments", () => ({ updateAssignment: update }));
vi.mock("@/hooks/use-toast", () => ({ toast: { error: vi.fn() } }));

import { AssignmentEditForm } from "./assignment-edit-form";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
  lookup.mockImplementation(async ({ scheduledDate }) => ({
    success: true,
    date: scheduledDate,
    fsrs: [
      {
        userId: "a",
        name: "Ana",
        unavailable: true,
        reason: "APPROVED_ABSENCE",
      },
      { userId: "b", name: "Bea", unavailable: false, reason: null },
    ],
  }));
  update.mockResolvedValue({ success: false, error: "Availability changed" });
});

it("full editing uses the persisted incident/date and retains the replacement draft after a guarded rejection", async () => {
  const onSuccess = vi.fn();
  render(
    <AssignmentEditForm
      assignment={{
        id: "a1",
        incident: { id: 12 },
        statusId: 2,
        notes: null,
        folio: 123,
        odtFolio: null,
        finishedAt: null,
        scheduledDate: new Date("2026-10-13T15:00:00Z"),
        assignees: [{ user: { id: "a", name: "Ana" } }],
      }}
      users={[]}
      statuses={[]}
      onSuccess={onSuccess}
    />,
  );
  expect(lookup).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Editar" }));
  await waitFor(() =>
    expect(
      screen.queryByText("Consultando disponibilidad…"),
    ).not.toBeInTheDocument(),
  );
  expect(lookup).toHaveBeenCalledWith({
    incidentId: 12,
    assignmentId: "a1",
    scheduledDate: "2026-10-13",
  });
  fireEvent.keyDown(screen.getByRole("button", { name: "Quitar Ana" }), {
    key: "Enter",
  });
  await userEvent.click(screen.getByLabelText(/Técnicos Asignados/));
  expect(screen.getByRole("option", { name: /Ana/ })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await userEvent.click(screen.getByRole("option", { name: "Bea" }));
  await userEvent.keyboard("{Escape}");
  await userEvent.click(
    screen.getByRole("button", { name: "Guardar Cambios" }),
  );
  expect(update).toHaveBeenCalledWith(
    "a1",
    expect.objectContaining({
      assigneeIds: ["b"],
      scheduledDate: undefined,
    }),
  );
  // The update action resolves the incident from the assignment id: sending
  // a dummy incidentId 0 fails intIdSchema and rejected every full-edit save
  // before it reached the transaction.
  expect(update.mock.calls[0][1]).not.toHaveProperty("incidentId");
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(2));
  expect(onSuccess).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Quitar Bea" })).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(screen.getByRole("button", { name: "Editar" })).toBeVisible();
});
