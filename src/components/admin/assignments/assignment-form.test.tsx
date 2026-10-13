import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

const { lookup, create, update, refresh } = vi.hoisted(() => ({
  lookup: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/lib/actions/assignment-availability", () => ({
  getAssignmentFsrAvailability: lookup,
}));
vi.mock("@/lib/actions/assignments", () => ({
  createAssignment: create,
  updateAssignment: update,
}));
vi.mock("@/hooks/use-toast", () => ({ toast: { error: vi.fn() } }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh, back: vi.fn() }),
}));

import { AssignmentForm } from "./assignment-form";

const props = {
  incidents: [{ id: 1, title: "Incident" }],
  users: [
    { id: "a", name: "Ana" },
    { id: "b", name: "Bea" },
  ],
  assignmentStatuses: [],
};
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
        unavailable: Boolean(scheduledDate),
        reason: scheduledDate ? "APPROVED_ABSENCE" : null,
      },
      { userId: "b", name: "Bea", unavailable: false, reason: null },
    ],
  }));
  create.mockResolvedValue({ success: true });
  update.mockResolvedValue({ success: false, error: "Changed availability" });
});

it("dated creation disables the absent candidate and submits the selected replacement with CDMX date", async () => {
  render(<AssignmentForm {...props} />);
  fireEvent.change(screen.getByLabelText("Fecha programada (opcional)"), {
    target: { value: "2026-10-13" },
  });
  await waitFor(() =>
    expect(
      screen.queryByText("Consultando disponibilidad…"),
    ).not.toBeInTheDocument(),
  );
  await userEvent.click(screen.getByLabelText("Asignados *"));
  expect(screen.getByRole("option", { name: /Ana/ })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await userEvent.click(screen.getByRole("option", { name: "Bea" }));
  await userEvent.keyboard("{Escape}");
  await userEvent.click(
    screen.getByRole("button", { name: "Crear Asignación" }),
  );
  expect(create).toHaveBeenCalledWith(
    expect.objectContaining({
      assigneeIds: ["b"],
      scheduledDate: new Date("2026-10-13T06:00:00Z"),
    }),
  );
});

it("keeps selected unavailable users removable and refreshes hints after authoritative rejection", async () => {
  render(
    <AssignmentForm
      {...props}
      assignment={{
        id: "a1",
        incidentId: 1,
        assigneeIds: ["a"],
        notes: null,
        scheduledDate: new Date("2026-10-13T06:00:00Z"),
      }}
    />,
  );
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(1));
  fireEvent.keyDown(screen.getByRole("button", { name: "Quitar Ana" }), {
    key: "Enter",
  });
  await userEvent.click(
    screen.getByRole("button", { name: "Actualizar Asignación" }),
  );
  expect(update).toHaveBeenCalledWith(
    "a1",
    expect.objectContaining({ assigneeIds: [] }),
  );
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(2));
  expect(refresh).not.toHaveBeenCalled();
  expect(
    screen.getByRole("button", { name: "Actualizar Asignación" }),
  ).toBeEnabled();
});
