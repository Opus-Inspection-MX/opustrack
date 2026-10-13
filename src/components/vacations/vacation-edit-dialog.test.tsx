import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { read, balance, update, refresh } = vi.hoisted(() => ({
  read: vi.fn(),
  balance: vi.fn(),
  update: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/lib/actions/vacations", () => ({
  getVacationById: read,
  getVacationBalanceData: balance,
  updateVacation: update,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/hooks/use-breakpoint", () => ({ useMediaQuery: () => true }));
vi.mock("@/hooks/use-toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { VacationEditDialog } from "./vacation-edit-dialog";

beforeEach(() => {
  vi.clearAllMocks();
  read.mockResolvedValue({
    id: "request",
    active: true,
    status: { code: "PENDIENTE" },
    userId: "holder",
    user: { name: "Original Holder" },
    startDate: new Date("2026-12-10T06:00:00Z"),
    endDate: new Date("2026-12-12T05:59:59.999Z"),
    periodId: "period",
    businessDaysUsed: 2,
    reason: "Original",
  });
  balance.mockResolvedValue({
    success: true,
    periods: [
      {
        id: "period",
        periodNumber: 1,
        accrualStart: new Date("2026-01-01T06:00:00Z"),
        graceEnd: new Date("2027-01-01T05:59:59Z"),
        availableFrom: null,
        remainingDays: 1,
      },
    ],
  });
  update.mockResolvedValue({ success: true });
});
describe("pending vacation edit dialog", () => {
  it("loads a scoped row, keeps holder read-only and sends only editable fields", async () => {
    const close = vi.fn();
    render(
      <VacationEditDialog
        vacationId="request"
        open
        onOpenChange={close}
        canManage={false}
      />,
    );
    expect(await screen.findByLabelText("Titular")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Titular")).toHaveValue("Original Holder");
    expect(screen.getByLabelText("Fecha de fin")).toHaveValue("2026-12-11");
    expect(
      screen.getByRole("option", { name: /3 días para reemplazar/ }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Fecha de fin"), {
      target: { value: "2026-12-12" },
    });
    fireEvent.change(screen.getByLabelText("Motivo (opcional)"), {
      target: { value: "New draft" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith("request", {
        startDate: new Date("2026-12-10T00:00:00Z"),
        endDate: new Date("2026-12-12T00:00:00Z"),
        reason: "New draft",
        periodId: "period",
      }),
    );
    expect(close).toHaveBeenCalledWith(false);
    expect(refresh).toHaveBeenCalled();
  });
  it("retains rejected stale-status drafts and unlocks retry", async () => {
    update.mockResolvedValue({
      success: false,
      error: "La solicitud ya fue resuelta.",
    });
    render(
      <VacationEditDialog
        vacationId="request"
        open
        onOpenChange={vi.fn()}
        canManage={false}
      />,
    );
    const reason = await screen.findByLabelText("Motivo (opcional)");
    fireEvent.change(reason, { target: { value: "Retained draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "ya fue resuelta",
    );
    expect(reason).toHaveValue("Retained draft");
    expect(
      screen.getByRole("button", { name: "Guardar cambios" }),
    ).toBeEnabled();
    expect(refresh).not.toHaveBeenCalled();
  });
  it("rejects an invalid range locally", async () => {
    render(
      <VacationEditDialog
        vacationId="request"
        open
        onOpenChange={vi.fn()}
        canManage={false}
      />,
    );
    fireEvent.change(await screen.findByLabelText("Fecha de fin"), {
      target: { value: "2026-12-09" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("posterior");
    expect(update).not.toHaveBeenCalled();
  });
  it("does not expose a missing or decided row as editable", async () => {
    read.mockResolvedValue(null);
    render(
      <VacationEditDialog
        vacationId="request"
        open
        onOpenChange={vi.fn()}
        canManage={true}
      />,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "pendientes activas",
    );
    expect(screen.queryByLabelText("Titular")).not.toBeInTheDocument();
    expect(balance).not.toHaveBeenCalled();
  });
});
