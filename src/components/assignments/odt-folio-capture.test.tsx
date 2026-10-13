import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateAssignmentOdtFolio, error } = vi.hoisted(() => ({
  updateAssignmentOdtFolio: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@/lib/actions/assignments", () => ({ updateAssignmentOdtFolio }));
vi.mock("@/hooks/use-toast", () => ({ toast: { error } }));

import { OdtFolioCapture } from "./odt-folio-capture";

beforeEach(() => vi.resetAllMocks());

describe("OdtFolioCapture", () => {
  it("saves through the labeled field and keyboard-named control", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    updateAssignmentOdtFolio.mockResolvedValue({
      success: true,
      data: { odtFolio: "ODT-25" },
    });
    render(
      <OdtFolioCapture
        assignmentId="a1"
        initialValue={null}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Capturar" }));
    await user.type(
      screen.getByRole("textbox", { name: "Folio ODT del sistema externo" }),
      "ODT-25",
    );
    await user.tab();
    expect(
      screen.getByRole("button", { name: "Guardar folio ODT" }),
    ).toHaveFocus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("ODT-25"));
    expect(updateAssignmentOdtFolio).toHaveBeenCalledWith("a1", "ODT-25");
    expect(screen.getByText("ODT-25")).toBeVisible();
  });

  it("keyboard cancel restores the saved value without mutation", async () => {
    const user = userEvent.setup();
    render(<OdtFolioCapture assignmentId="a1" initialValue="ODT-original" />);
    await user.click(screen.getByRole("button", { name: "Editar" }));
    const input = screen.getByLabelText("Folio ODT del sistema externo");
    await user.clear(input);
    await user.type(input, "draft");
    await user.tab();
    await user.tab();
    expect(
      screen.getByRole("button", { name: "Cancelar edición del folio ODT" }),
    ).toHaveFocus();
    await user.keyboard(" ");
    expect(screen.getByText("ODT-original")).toBeVisible();
    expect(updateAssignmentOdtFolio).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Editar" }));
    expect(screen.getByLabelText("Folio ODT del sistema externo")).toHaveValue(
      "ODT-original",
    );
  });

  it.each(["business", "transport"])(
    "retains the draft and unlocks after %s failure",
    async (failure) => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      if (failure === "business")
        updateAssignmentOdtFolio.mockResolvedValue({
          success: false,
          error: "No se puede editar.",
        });
      else
        updateAssignmentOdtFolio.mockRejectedValue(new Error("Disconnected"));
      render(
        <OdtFolioCapture
          assignmentId="a1"
          initialValue="saved"
          onChange={onChange}
        />,
      );
      await user.click(screen.getByRole("button", { name: "Editar" }));
      const input = screen.getByLabelText("Folio ODT del sistema externo");
      await user.clear(input);
      await user.type(input, "retained draft");
      await user.click(
        screen.getByRole("button", { name: "Guardar folio ODT" }),
      );
      await waitFor(() => expect(error).toHaveBeenCalled());
      expect(input).toHaveValue("retained draft");
      expect(input).toBeEnabled();
      expect(
        screen.getByRole("button", { name: "Guardar folio ODT" }),
      ).toBeEnabled();
      expect(onChange).not.toHaveBeenCalled();
    },
  );
});
