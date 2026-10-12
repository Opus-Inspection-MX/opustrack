import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { cancelVehicleTrip, refresh, error, success } = vi.hoisted(() => ({
  cancelVehicleTrip: vi.fn(),
  refresh: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/actions/vehicle-trips", () => ({ cancelVehicleTrip }));
vi.mock("@/hooks/use-toast", () => ({ toast: { error, success } }));

import { TripCancelForm } from "./trip-cancel-form";

beforeEach(() => vi.resetAllMocks());

function fillForm() {
  render(<TripCancelForm tripId="trip-1" />);
  const reason = screen.getByLabelText("Motivo de cancelación");
  fireEvent.change(reason, {
    target: { value: "Dispatch cancelled before departure" },
  });
  return {
    reason,
    submit: screen.getByRole("button", { name: "Cancelar viaje con motivo" }),
  };
}

describe("TripCancelForm", () => {
  it("retains the reason and does not refresh on a business-rule failure", async () => {
    cancelVehicleTrip.mockResolvedValue({
      success: false,
      error: "El viaje ya finalizó.",
    });
    const { reason, submit } = fillForm();
    fireEvent.click(submit);
    await waitFor(() =>
      expect(error).toHaveBeenCalledWith("El viaje ya finalizó."),
    );
    expect(cancelVehicleTrip).toHaveBeenCalledWith(
      "trip-1",
      "Dispatch cancelled before departure",
    );
    expect(reason).toHaveValue("Dispatch cancelled before departure");
    expect(submit).toBeEnabled();
    expect(refresh).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
  });

  it("retains failed transport input and refreshes only after a successful retry", async () => {
    cancelVehicleTrip.mockRejectedValueOnce(new Error("Disconnected"));
    cancelVehicleTrip.mockResolvedValueOnce({ success: true });
    const { reason, submit } = fillForm();
    fireEvent.click(submit);
    await waitFor(() =>
      expect(error).toHaveBeenCalledWith("No se pudo cancelar el viaje."),
    );
    expect(reason).toHaveValue("Dispatch cancelled before departure");
    expect(refresh).not.toHaveBeenCalled();
    fireEvent.click(submit);
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(cancelVehicleTrip).toHaveBeenCalledTimes(2);
    expect(success).toHaveBeenCalledWith(
      "Viaje cancelado. Sus evidencias se conservaron.",
    );
  });

  it("blocks duplicate sends while cancellation is pending", async () => {
    let resolve!: (result: { success: true }) => void;
    cancelVehicleTrip.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { submit } = fillForm();
    fireEvent.click(submit);
    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    expect(cancelVehicleTrip).toHaveBeenCalledTimes(1);
    resolve({ success: true });
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(submit).toBeEnabled();
  });
});
