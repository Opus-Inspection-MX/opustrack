import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyTripComplianceRow } from "@/lib/actions/reports";

vi.mock("@/components/reports", () => ({
  DateRangeFilter: () => null,
  PDFExportButton: () => null,
  StatCard: ({ title, value }: { title: string; value: string | number }) => (
    <div>
      {title}: {value}
    </div>
  ),
}));
vi.mock("@/lib/actions/reports", () => ({
  getDailyTripComplianceReport: vi.fn(),
}));

import { DailyTripComplianceReportClient } from "./daily-trip-compliance-report-client";

function row(
  overrides: Partial<DailyTripComplianceRow> = {},
): DailyTripComplianceRow {
  return {
    userId: "u1",
    userName: "FSR One",
    userEmail: "one@example.test",
    daysReported: 0,
    daysMissed: 0,
    totalDays: 0,
    daysNotApplicable: 1,
    complianceRatePct: null,
    lastTripAt: null,
    reportedToday: false,
    byDay: {
      "2026-10-12": {
        applicable: false,
        reason: "vacation",
        reported: false,
        tripCount: 0,
        kmDriven: 0,
      },
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-12T18:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("daily compliance N/A display", () => {
  it("renders nullable rates as N/A and does not claim an exempt FSR missed today", () => {
    render(
      <DailyTripComplianceReportClient
        initialDays={["2026-10-12"]}
        initialRows={[row()]}
        initialSummary={{
          totalFsrs: 1,
          fullyCompliant: 0,
          missedToday: 0,
          averageComplianceRate: null,
        }}
      />,
    );
    expect(screen.getByText("Promedio cumplimiento: N/A")).toBeInTheDocument();
    expect(
      screen.getByText("Hoy no aplica la obligación de reportar viajes."),
    ).toBeInTheDocument();
    expect(screen.getByTitle("Vacaciones aprobadas")).toHaveTextContent("N/A");
    expect(
      screen.getByRole("columnheader", { name: "Días no aplicables" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
    expect(screen.queryByText("null%")).not.toBeInTheDocument();
  });

  it("shows actual exceptional trips alongside N/A rather than a missing-trip mark", () => {
    const exceptional = row({
      reportedToday: true,
      byDay: {
        "2026-10-12": {
          applicable: false,
          reason: "holiday",
          reported: true,
          tripCount: 2,
          kmDriven: 40,
        },
      },
    });
    render(
      <DailyTripComplianceReportClient
        initialDays={["2026-10-12"]}
        initialRows={[exceptional]}
        initialSummary={{
          totalFsrs: 1,
          fullyCompliant: 0,
          missedToday: 0,
          averageComplianceRate: null,
        }}
      />,
    );
    expect(
      screen.getByTitle("Día festivo · 2 viaje(s) registrado(s) · 40 km"),
    ).toHaveTextContent("N/A · 2");
  });

  it("keeps actual zero compliance distinct from N/A and lists only eligible misses", () => {
    const missing = row({
      userId: "u2",
      userName: "FSR Two",
      totalDays: 1,
      daysNotApplicable: 0,
      daysMissed: 1,
      complianceRatePct: 0,
      byDay: {
        "2026-10-12": {
          applicable: true,
          reported: false,
          tripCount: 0,
          kmDriven: 0,
        },
      },
    });
    render(
      <DailyTripComplianceReportClient
        initialDays={["2026-10-12"]}
        initialRows={[row(), missing]}
        initialSummary={{
          totalFsrs: 2,
          fullyCompliant: 0,
          missedToday: 1,
          averageComplianceRate: 0,
        }}
      />,
    );
    expect(screen.getByText("Promedio cumplimiento: 0%")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByRole("listitem")).toHaveTextContent("FSR Two");
  });
});
