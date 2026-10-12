import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { correctVehicleOdometer, refresh, error, success } = vi.hoisted(() => ({
  correctVehicleOdometer: vi.fn(),
  refresh: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/actions/vehicles", () => ({ correctVehicleOdometer }));
vi.mock("@/hooks/use-toast", () => ({ toast: { error, success } }));

import { OdometerCorrectionForm } from "./odometer-correction-form";

beforeEach(() => vi.resetAllMocks());

function fillForm() {
  render(<OdometerCorrectionForm vehicleId="vehicle-1" />);
  const reading = screen.getByLabelText("Nueva lectura (km)");
  const reason = screen.getByLabelText("Motivo de corrección");
  fireEvent.change(reading, { target: { value: "50" } });
  fireEvent.change(reason, { target: { value: "Odometer replaced" } });
  return {
    reading,
    reason,
    submit: screen.getByRole("button", { name: "Registrar corrección" }),
  };
}

describe("OdometerCorrectionForm", () => {
  it("retains input and does not refresh on a business-rule failure", async () => {
    correctVehicleOdometer.mockResolvedValue({
      success: false,
      error: "Hay un viaje en curso.",
    });
    const { reading, reason, submit } = fillForm();
    fireEvent.click(submit);
    await waitFor(() =>
      expect(error).toHaveBeenCalledWith("Hay un viaje en curso."),
    );
    expect(correctVehicleOdometer).toHaveBeenCalledWith(
      "vehicle-1",
      50,
      "Odometer replaced",
    );
    expect(reading).toHaveValue(50);
    expect(reason).toHaveValue("Odometer replaced");
    expect(submit).toBeEnabled();
    expect(refresh).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
  });

  it("retains transport failures and resets the form only after a successful retry", async () => {
    correctVehicleOdometer.mockRejectedValueOnce(new Error("Disconnected"));
    correctVehicleOdometer.mockResolvedValueOnce({ success: true });
    const { reading, reason, submit } = fillForm();
    fireEvent.click(submit);
    await waitFor(() =>
      expect(error).toHaveBeenCalledWith(
        "No se pudo registrar la corrección del odómetro.",
      ),
    );
    expect(reading).toHaveValue(50);
    expect(reason).toHaveValue("Odometer replaced");
    expect(refresh).not.toHaveBeenCalled();
    fireEvent.click(submit);
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(correctVehicleOdometer).toHaveBeenCalledTimes(2);
    expect(reading).toHaveValue(null);
    expect(reason).toHaveValue("");
    expect(success).toHaveBeenCalledWith(
      "Corrección del odómetro registrada con historial.",
    );
  });

  it("blocks duplicate corrections while the server response is pending", async () => {
    let resolve!: (result: { success: true }) => void;
    correctVehicleOdometer.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { submit } = fillForm();
    fireEvent.click(submit);
    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    expect(correctVehicleOdometer).toHaveBeenCalledTimes(1);
    resolve({ success: true });
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(submit).toBeEnabled();
  });
});
