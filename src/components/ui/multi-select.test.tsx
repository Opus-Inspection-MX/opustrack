import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MultiSelect } from "./multi-select";

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
const options = [
  {
    value: "a",
    label: "Ana",
    disabled: true,
    disabledReason: "Ausencia aprobada",
  },
  { value: "b", label: "Bea" },
  { value: "c", label: "Carla" },
];

describe("MultiSelect disabled additions and removable selections", () => {
  it("makes unavailable additions inaccessible but allows default options", async () => {
    const onValueChange = vi.fn();
    render(
      <MultiSelect
        options={options}
        value={[]}
        onValueChange={onValueChange}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Selecciona..." }),
    );
    const unavailable = screen.getByRole("option", {
      name: /Ana — Ausencia aprobada/,
    });
    expect(unavailable).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(unavailable);
    expect(onValueChange).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("option", { name: "Bea" }));
    expect(onValueChange).toHaveBeenCalledWith(["b"]);
  });
  it("removes an unavailable selected chip by keyboard without removing anyone else", () => {
    const onValueChange = vi.fn();
    render(
      <MultiSelect
        options={options}
        value={["a", "b"]}
        onValueChange={onValueChange}
      />,
    );
    fireEvent.keyDown(screen.getByRole("button", { name: "Quitar Ana" }), {
      key: "Enter",
    });
    expect(onValueChange).toHaveBeenCalledWith(["b"]);
  });
  it("names overflow selections and exposes keyboard-accessible removal", async () => {
    const onValueChange = vi.fn();
    render(
      <MultiSelect
        options={options}
        value={["b", "a", "c"]}
        maxChips={1}
        onValueChange={onValueChange}
      />,
    );
    expect(
      screen.getByLabelText("Selecciones adicionales: Ana, Carla"),
    ).toBeVisible();
    await userEvent.click(screen.getByRole("button", { expanded: false }));
    const remove = screen.getByRole("button", { name: "Quitar Ana" });
    remove.focus();
    await userEvent.keyboard("{Enter}");
    expect(onValueChange).toHaveBeenCalledWith(["b", "c"]);
    expect(
      screen.getByRole("option", { name: /Ana.*seleccionado/ }),
    ).not.toHaveAttribute("aria-disabled", "true");
  });
  it("keeps selected identities missing from the current candidate list removable", () => {
    const onValueChange = vi.fn();
    render(
      <MultiSelect
        options={[]}
        value={["saved-user"]}
        onValueChange={onValueChange}
      />,
    );
    fireEvent.keyDown(
      screen.getByRole("button", { name: "Quitar saved-user" }),
      { key: " " },
    );
    expect(onValueChange).toHaveBeenCalledWith([]);
  });
  it("globally disabled mutation controls prevent even selected removal", () => {
    const onValueChange = vi.fn();
    render(
      <MultiSelect
        options={options}
        value={["a"]}
        onValueChange={onValueChange}
        disabled
      />,
    );
    const removal = screen.getByRole("button", { name: "Quitar Ana" });
    expect(removal).toHaveAttribute("aria-disabled", "true");
    expect(removal).toHaveAttribute("tabindex", "-1");
    fireEvent.keyDown(removal, { key: "Enter" });
    fireEvent.pointerDown(removal);
    expect(onValueChange).not.toHaveBeenCalled();
  });
  it("preserves default consumer selection and deselection behavior", async () => {
    const onValueChange = vi.fn();
    render(
      <MultiSelect
        options={options.slice(1)}
        value={["b"]}
        onValueChange={onValueChange}
      />,
    );
    await userEvent.click(screen.getByRole("button", { expanded: false }));
    await userEvent.click(
      screen.getByRole("option", { name: /Bea.*seleccionado/ }),
    );
    expect(onValueChange).toHaveBeenCalledWith([]);
    await userEvent.click(screen.getByRole("option", { name: "Carla" }));
    expect(onValueChange).toHaveBeenCalledWith(["b", "c"]);
  });
});
