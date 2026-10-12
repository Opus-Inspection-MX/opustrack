import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VacationPeriodSummary } from "@/lib/actions/vacations";

const { createVacation, getVacationBalanceData } = vi.hoisted(() => ({
  createVacation: vi.fn(),
  getVacationBalanceData: vi.fn(),
}));
vi.mock("@/lib/actions/vacations", () => ({
  createVacation,
  getVacationBalanceData,
}));
vi.mock("@/hooks/use-toast", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));
vi.mock("@/components/ui/searchable-select", () => ({
  SearchableSelect: ({
    value,
    onValueChange,
    options,
  }: {
    value: string;
    onValueChange: (id: string) => void;
    options: { value: string; label: string }[];
  }) => (
    <select
      aria-label="Employee"
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));
vi.mock("@/components/vacations/vacation-balance-panel", () => ({
  VacationBalancePanel: ({
    selectedPeriodId,
  }: {
    selectedPeriodId: string | null;
  }) => (
    <output aria-label="Funding period">{selectedPeriodId ?? "none"}</output>
  ),
}));
vi.mock("@/components/vacations/vacation-year-calendar", () => ({
  VacationYearCalendar: ({
    onRequestRange,
    readOnly,
  }: {
    onRequestRange: (start: string, end: string) => Promise<boolean>;
    readOnly: boolean;
  }) => (
    <button
      type="button"
      disabled={readOnly}
      onClick={() => void onRequestRange("2026-07-01", "2026-07-02")}
    >
      Request range
    </button>
  ),
}));

import { VacationPlanner } from "./vacation-planner";

const period = (
  changes: Partial<VacationPeriodSummary> = {},
): VacationPeriodSummary => ({
  id: "earned",
  periodNumber: 1,
  cycleYear: 2025,
  accrualStart: new Date("2025-01-01T06:00:00Z"),
  accrualEnd: new Date("2026-01-01T05:59:59.999Z"),
  graceEnd: new Date("2027-01-01T05:59:59.999Z"),
  availableFrom: new Date("2025-06-15T06:00:00Z"),
  allottedDays: 12,
  usedDays: 0,
  remainingDays: 12,
  isExpired: false,
  isOverridden: false,
  ...changes,
});
const initialData = {
  user: { id: "employee-1", name: "Employee One" },
  hasHireDate: true,
  periods: [period()],
  vacations: [],
  holidayDates: [],
  year: 2026,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-06-03T12:00:00Z"));
  createVacation.mockResolvedValue({ success: true });
  getVacationBalanceData.mockResolvedValue({ success: true, ...initialData });
});
afterEach(() => vi.useRealTimers());

describe("VacationPlanner funding and target", () => {
  it("always sends the initially displayed employee, including the admin's first request", async () => {
    render(<VacationPlanner initialData={initialData} canManage />);
    await waitFor(() =>
      expect(screen.getByLabelText("Funding period")).toHaveTextContent(
        "earned",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Request range" }));
    await waitFor(() =>
      expect(createVacation).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "employee-1",
          periodId: "earned",
          startDate: new Date("2026-07-01T00:00:00Z"),
        }),
      ),
    );
  });

  it("skips future, missing-activation, expired and empty grants when selecting funding", async () => {
    render(
      <VacationPlanner
        initialData={{
          ...initialData,
          periods: [
            period({
              id: "future",
              availableFrom: new Date("2026-06-15T06:00:00Z"),
            }),
            period({ id: "missing", availableFrom: null }),
            period({ id: "empty", remainingDays: 0 }),
            period({ id: "expired", isExpired: true }),
            period({
              id: "later",
              graceEnd: new Date("2028-01-01T05:59:59.999Z"),
            }),
            period(),
          ],
        }}
      />,
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Funding period")).toHaveTextContent(
        "earned",
      ),
    );
  });

  it("does not submit for the previous employee while a new balance is loading", async () => {
    let complete: (value: unknown) => void = () => {};
    getVacationBalanceData.mockReturnValue(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    render(
      <VacationPlanner
        initialData={initialData}
        fsrs={[
          { id: "employee-1", name: "One", email: "one@test.local" },
          { id: "employee-2", name: "Two", email: "two@test.local" },
        ]}
        canManage
      />,
    );
    fireEvent.change(screen.getByLabelText("Employee"), {
      target: { value: "employee-2" },
    });
    expect(
      screen.getByRole("button", { name: "Request range" }),
    ).toBeDisabled();
    complete({
      success: true,
      ...initialData,
      user: { id: "employee-2", name: "Two" },
      periods: [period({ id: "second-period" })],
    });
    await waitFor(() =>
      expect(screen.getByLabelText("Funding period")).toHaveTextContent(
        "second-period",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Request range" }));
    await waitFor(() =>
      expect(createVacation).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "employee-2",
          periodId: "second-period",
        }),
      ),
    );
  });
});
