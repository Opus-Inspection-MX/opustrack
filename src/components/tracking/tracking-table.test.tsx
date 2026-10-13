import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

const { lookup, create, details, composition } = vi.hoisted(() => ({
  lookup: vi.fn(),
  create: vi.fn(),
  details: vi.fn(),
  composition: vi.fn(),
}));
vi.mock("@/lib/actions/assignment-availability", () => ({
  getAssignmentFsrAvailability: lookup,
}));
vi.mock("@/lib/actions/assignments", () => ({ createAssignment: create }));
vi.mock("@/lib/actions/tracking", () => ({
  updateAssignmentDetails: details,
  updateAssignmentAssignees: composition,
  updateIncidentDetails: vi.fn(),
}));
vi.mock("@/lib/actions/incidents", () => ({ updateIncidentFsrs: vi.fn() }));
vi.mock("@/lib/actions/equipments", () => ({ getEquipmentsByLineId: vi.fn() }));
vi.mock("@/lib/actions/lines", () => ({ getLinesByClientId: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ toast: { error: vi.fn() } }));

import { TrackingTable } from "./tracking-table";

const props = {
  incidents: [
    {
      id: 12,
      title: "Incident",
      reportedAt: new Date("2026-10-12T15:00:00Z"),
      assignments: [
        {
          id: "a1",
          folio: 123,
          scheduledDate: new Date("2026-10-13T15:00:00Z"),
          assignees: [{ user: { id: "a", name: "Ana" } }],
        },
      ],
    },
  ],
  fsrs: [
    { id: "a", name: "Ana", email: "a@example.test" },
    { id: "b", name: "Bea", email: "b@example.test" },
  ],
  incidentStatuses: [],
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
  details.mockResolvedValue({ success: false, error: "Availability changed" });
});

it("tracking composition saves date and final selection atomically, retaining the draft and refreshing rejected hints", async () => {
  const onDataChange = vi.fn();
  render(<TrackingTable {...props} onDataChange={onDataChange} />);
  await userEvent.click(
    screen.getByRole("button", { name: "Expandir detalle del incidente" }),
  );
  await userEvent.click(
    screen.getAllByRole("button", { name: "Edición Rápida" })[1],
  );
  expect(screen.getByLabelText("Fecha programada (opcional)")).toHaveValue(
    "2026-10-13",
  );
  await waitFor(() =>
    expect(
      screen.queryByText("Consultando disponibilidad…"),
    ).not.toBeInTheDocument(),
  );
  fireEvent.keyDown(screen.getByRole("button", { name: "Quitar Ana" }), {
    key: "Enter",
  });
  await userEvent.click(screen.getByLabelText("FSRs Asignados"));
  expect(screen.getByRole("option", { name: /Ana/ })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await userEvent.click(screen.getByRole("option", { name: /Bea/ }));
  await userEvent.keyboard("{Escape}");
  await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
  expect(details).toHaveBeenCalledWith(
    "a1",
    expect.objectContaining({
      scheduledDate: "2026-10-13",
      assigneeIds: ["b"],
    }),
  );
  expect(composition).not.toHaveBeenCalled();
  expect(onDataChange).not.toHaveBeenCalled();
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(2));
  expect(screen.getByRole("button", { name: "Quitar Bea" })).toBeVisible();
});

it.each(["normal", "incident quick edit"])(
  "tracking %s creation exposes a dated selector and sends its effective date",
  async (surface) => {
    render(<TrackingTable {...props} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Expandir detalle del incidente" }),
    );
    if (surface !== "normal")
      await userEvent.click(
        screen.getAllByRole("button", { name: "Edición Rápida" })[0],
      );
    await userEvent.click(
      screen.getByRole("button", {
        name: surface === "normal" ? "Crear Asignación" : "Nueva Asignación",
      }),
    );
    fireEvent.change(screen.getByLabelText("Fecha programada (opcional)"), {
      target: { value: "2026-10-14" },
    });
    await waitFor(() =>
      expect(
        screen.queryByText("Consultando disponibilidad…"),
      ).not.toBeInTheDocument(),
    );
    await userEvent.click(screen.getByLabelText("FSRs Asignados"));
    expect(screen.getByRole("option", { name: /Ana/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await userEvent.click(screen.getByRole("option", { name: /Bea/ }));
    await userEvent.keyboard("{Escape}");
    await userEvent.click(
      screen.getByRole("button", { name: "Crear Asignación" }),
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        incidentId: 12,
        assigneeIds: ["b"],
        scheduledDate: new Date("2026-10-14T06:00:00Z"),
      }),
    );
  },
);
