import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ permission: vi.fn(), findMany: vi.fn() }));
vi.mock("@/lib/auth/auth", () => ({ requirePermission: mocks.permission }));
vi.mock("@/lib/database/prisma.singleton", () => ({
  prisma: { vacationWorkbook: { findMany: mocks.findMany } },
}));

import { VacationWorkbookArchive } from "./vacation-workbook-archive";

beforeEach(() => vi.resetAllMocks());
it("requires management permission before reading historical identities", async () => {
  mocks.permission.mockRejectedValue(new Error("denied"));
  await expect(VacationWorkbookArchive()).rejects.toThrow("denied");
  expect(mocks.permission).toHaveBeenCalledWith("vacations:manage");
  expect(mocks.findMany).not.toHaveBeenCalled();
});
it("shows pending evidence separately from requests, retaining notes and zero values", async () => {
  mocks.findMany.mockResolvedValue([
    {
      digest: "a".repeat(64),
      filename: "synthetic.xlsm",
      rows: [
        {
          id: "r1",
          sourceSheet: "Vacaciones 2026-2027",
          sourceName: "Synthetic Person",
          hireDate: null,
          yearsOfService: 3,
          entitledDays: 16,
          takenDays: 0,
          remainingDays: 16,
          reviewStatus: "PENDING",
          issues: ["UNMATCHED_IDENTITY"],
          sourceValues: [
            null,
            "Synthetic Person",
            null,
            3,
            "Texto de días",
            16,
            null,
            null,
            "Nota original",
          ],
        },
      ],
    },
  ]);
  render(await VacationWorkbookArchive());
  expect(screen.getByText("Sin cuenta coincidente")).toBeInTheDocument();
  expect(screen.getByText("Texto de días · Nota original")).toBeInTheDocument();
  expect(screen.getByText("0")).toBeInTheDocument();
  expect(screen.getByRole("link")).toHaveAttribute(
    "href",
    `/api/vacations/workbooks/${"a".repeat(64)}`,
  );
});
