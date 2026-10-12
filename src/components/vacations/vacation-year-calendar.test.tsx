import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VacationPeriodSummary } from "@/lib/actions/vacations";
import { VacationYearCalendar } from "./vacation-year-calendar";

const period: VacationPeriodSummary = {
  id: "period",
  periodNumber: 1,
  cycleYear: 2025,
  availableFrom: new Date("2025-06-15T06:00:00Z"),
  accrualStart: new Date("2025-01-01T06:00:00Z"),
  accrualEnd: new Date("2026-01-01T05:59:59.999Z"),
  graceEnd: new Date("2027-01-01T05:59:59.999Z"),
  allottedDays: 12,
  usedDays: 0,
  remainingDays: 12,
  isOverridden: false,
  isExpired: false,
};
const props = {
  year: 2026,
  vacations: [],
  holidayDates: [],
  selectedPeriod: period,
  onRequestRange: vi.fn(async () => true),
  onYearChange: vi.fn(),
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-06-03T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("vacation civil-date calendar", () => {
  it("maps an approved CDMX day to its exact civil cell instead of the previous browser-local day", () => {
    render(
      <VacationYearCalendar
        {...props}
        vacations={[
          {
            id: "vacation",
            startDate: "2026-06-03T06:00:00Z",
            endDate: "2026-06-05T05:59:59.999Z",
            status: { code: "APROBADA", name: "Approved", color: "green" },
          },
        ]}
      />,
    );
    expect(
      screen.getByRole("button", { name: "2026-06-03: Approved" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "2026-06-04: Approved" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2026-06-02" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "2026-06-05" })).toBeEnabled();
  });

  it("blocks a future calendar grant even when the selected vacation date is after activation", () => {
    render(
      <VacationYearCalendar
        {...props}
        selectedPeriod={{
          ...period,
          availableFrom: new Date("2026-06-15T06:00:00Z"),
        }}
      />,
    );
    expect(screen.getByRole("button", { name: "2026-07-01" })).toBeDisabled();
  });

  it("keeps the civil range selected after a returned save failure", async () => {
    const request = vi.fn(async () => false);
    render(<VacationYearCalendar {...props} onRequestRange={request} />);
    fireEvent.click(screen.getByRole("button", { name: "2026-06-04" }));
    fireEvent.click(screen.getByRole("button", { name: "2026-06-05" }));
    fireEvent.click(screen.getByRole("button", { name: "Solicitar" }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("2026-06-04", "2026-06-05"),
    );
    expect(screen.getByText("2026-06-04 → 2026-06-05")).toBeInTheDocument();
  });
});
