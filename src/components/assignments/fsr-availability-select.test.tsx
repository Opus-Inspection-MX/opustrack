import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { useFsrAvailability } from "@/hooks/use-fsr-availability";
import { FsrAvailabilitySelect } from "./fsr-availability-select";

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
});
const props = {
  id: "fsrs",
  options: [
    { value: "a", label: "Ana" },
    { value: "b", label: "Bea" },
  ],
  value: ["a"],
  onValueChange: vi.fn(),
  scheduledDate: "2026-10-13",
};
const state = (
  phase: "loading" | "error" | "ready",
): ReturnType<typeof useFsrAvailability> => ({
  state: phase,
  fsrs:
    phase === "ready"
      ? [
          {
            userId: "a",
            name: "Ana",
            unavailable: true,
            reason: "APPROVED_ABSENCE",
          },
          { userId: "b", name: "Bea", unavailable: false, reason: null },
        ]
      : [],
  error: phase === "error" ? "Lookup failed" : undefined,
  retry: vi.fn(),
});

describe("availability selector unresolved and selected state", () => {
  it.each(["loading", "error"] as const)(
    "blocks new additions during %s while permitting removals",
    async (phase) => {
      const onValueChange = vi.fn();
      const availability = state(phase);
      render(
        <FsrAvailabilitySelect
          {...props}
          onValueChange={onValueChange}
          availability={availability}
        />,
      );
      fireEvent.keyDown(screen.getByRole("button", { name: "Quitar Ana" }), {
        key: "Enter",
      });
      expect(onValueChange).toHaveBeenCalledWith([]);
      await userEvent.click(screen.getByRole("button", { expanded: false }));
      expect(screen.getByRole("option", { name: /Bea/ })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
      if (phase === "error") {
        await userEvent.keyboard("{Escape}");
        expect(screen.getByRole("alert")).toHaveTextContent("Lookup failed");
        await userEvent.click(
          screen.getByRole("button", { name: "Reintentar disponibilidad" }),
        );
        expect(availability.retry).toHaveBeenCalled();
      } else
        expect(screen.getByText("Consultando disponibilidad…")).toBeVisible();
    },
  );
  it("never silently drops selected IDs absent from a fresh candidate result", () => {
    const onValueChange = vi.fn();
    render(
      <FsrAvailabilitySelect
        {...props}
        options={[]}
        selectedOptions={[{ value: "saved", label: "Saved technician" }]}
        value={["saved"]}
        onValueChange={onValueChange}
        availability={state("ready")}
      />,
    );
    expect(onValueChange).not.toHaveBeenCalled();
    fireEvent.keyDown(
      screen.getByRole("button", { name: "Quitar Saved technician" }),
      { key: "Enter" },
    );
    expect(onValueChange).toHaveBeenCalledWith([]);
  });
  it("shows deferred semantics only after a successful null-date lookup", () => {
    render(
      <FsrAvailabilitySelect
        {...props}
        scheduledDate={null}
        availability={state("ready")}
      />,
    );
    expect(screen.getByText(/Sin fecha programada/)).toBeVisible();
  });
});
