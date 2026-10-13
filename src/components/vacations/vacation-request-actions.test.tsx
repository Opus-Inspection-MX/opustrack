import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { cancel, refresh } = vi.hoisted(() => ({
  cancel: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/lib/actions/vacations", () => ({ deleteVacation: cancel }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/hooks/use-toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("./vacation-edit-dialog", () => ({ VacationEditDialog: () => null }));

import { VacationRequestActions } from "./vacation-request-actions";

const props = {
  vacationId: "request",
  statusCode: "PENDIENTE",
  active: true,
  canUpdate: true,
  canDelete: true,
  canManage: false,
  startedApproved: false,
};
beforeEach(() => {
  vi.clearAllMocks();
  cancel.mockResolvedValue({ success: true });
});
describe("vacation request controls", () => {
  it("gates pending editing by permission", () => {
    render(<VacationRequestActions {...props} canUpdate={false} />);
    expect(
      screen.queryByRole("button", { name: "Editar solicitud" }),
    ).not.toBeInTheDocument();
  });
  it.each([false, true])(
    "confirms own/admin cancellation via existing action (manage %s)",
    async (canManage) => {
      render(<VacationRequestActions {...props} canManage={canManage} />);
      fireEvent.click(
        screen.getByRole("button", { name: "Cancelar solicitud" }),
      );
      expect(cancel).not.toHaveBeenCalled();
      fireEvent.click(
        screen.getByRole("button", { name: "Confirmar cancelación" }),
      );
      await waitFor(() => expect(cancel).toHaveBeenCalledWith("request"));
      expect(refresh).toHaveBeenCalled();
    },
  );
  it("offers future approved cancellation but no pending edit", () => {
    render(<VacationRequestActions {...props} statusCode="APROBADA" />);
    expect(
      screen.queryByRole("button", { name: "Editar solicitud" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cancelar solicitud" }),
    ).toBeEnabled();
  });
  it("blocks started approved cancellation and directs to existing correction", () => {
    render(
      <VacationRequestActions
        {...props}
        statusCode="APROBADA"
        startedApproved
      />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText(/corrección administrativa/)).toBeInTheDocument();
    expect(cancel).not.toHaveBeenCalled();
  });
  it("retains confirmation on live started-status rejection", async () => {
    cancel.mockResolvedValue({
      success: false,
      error: "No puede cancelar una vacación aprobada que ya comenzó.",
    });
    render(<VacationRequestActions {...props} statusCode="APROBADA" />);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar solicitud" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar cancelación" }),
    );
    expect(await screen.findByText(/ya comenzó/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Confirmar cancelación" }),
    ).toBeEnabled();
    expect(refresh).not.toHaveBeenCalled();
  });
});
