import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getVacationById, correctStartedVacation, refresh } = vi.hoisted(() => ({
  getVacationById: vi.fn(),
  correctStartedVacation: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/lib/actions/vacations", () => ({
  getVacationById,
  correctStartedVacation,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/hooks/use-toast", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { VacationApprovalButtons } from "./vacation-approval-buttons";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-06-03T12:00:00Z"));
  getVacationById.mockResolvedValue({
    active: true,
    startDate: new Date("2026-06-01T06:00:00Z"),
    endDate: new Date("2026-06-06T05:59:59.999Z"),
    businessDaysUsed: 4,
    chargeSnapshotAvailable: false,
  });
  correctStartedVacation.mockResolvedValue({ success: true });
});
afterEach(() => vi.useRealTimers());

describe("administrative vacation correction UI", () => {
  it("requires a reason and explicit legacy review before submitting, then closes on success", async () => {
    render(
      <VacationApprovalButtons vacationId="vacation-1" statusName="APROBADA" />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Corregir período iniciado" }),
    );
    const save = await screen.findByRole("button", {
      name: "Guardar corrección",
    });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Motivo de la corrección"), {
      target: { value: "Reviewed early return" },
    });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Días consumidos revisados/), {
      target: { value: "2" },
    });
    fireEvent.click(save);
    await waitFor(() =>
      expect(correctStartedVacation).toHaveBeenCalledWith(
        "vacation-1",
        new Date("2026-06-03T00:00:00Z"),
        "Reviewed early return",
        2,
      ),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Guardar corrección" }),
      ).not.toBeInTheDocument(),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("uses the stored daily snapshot without asking for a legacy count and keeps failed drafts", async () => {
    getVacationById.mockResolvedValue({
      active: true,
      startDate: new Date("2026-06-01T06:00:00Z"),
      endDate: new Date("2026-06-06T05:59:59.999Z"),
      businessDaysUsed: 4,
      chargeSnapshotAvailable: true,
    });
    correctStartedVacation.mockResolvedValue({
      success: false,
      error: "Concurrent correction",
    });
    render(
      <VacationApprovalButtons vacationId="vacation-1" statusName="APROBADA" />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Corregir período iniciado" }),
    );
    const reason = await screen.findByLabelText("Motivo de la corrección");
    expect(
      screen.queryByLabelText(/Días consumidos revisados/),
    ).not.toBeInTheDocument();
    fireEvent.change(reason, { target: { value: "Early return" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar corrección" }));
    await waitFor(() =>
      expect(correctStartedVacation).toHaveBeenCalledWith(
        "vacation-1",
        new Date("2026-06-03T00:00:00Z"),
        "Early return",
        undefined,
      ),
    );
    expect(reason).toHaveValue("Early return");
    expect(refresh).not.toHaveBeenCalled();
  });
});
