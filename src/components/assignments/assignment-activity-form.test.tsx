import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAssignmentActivity, uploadAssignmentAttachment, error } =
  vi.hoisted(() => ({
    createAssignmentActivity: vi.fn(),
    uploadAssignmentAttachment: vi.fn(),
    error: vi.fn(),
  }));
vi.mock("@/lib/actions/assignment-activities", () => ({
  createAssignmentActivity,
}));
vi.mock("@/lib/actions/assignments", () => ({ uploadAssignmentAttachment }));
vi.mock("@/hooks/use-toast", () => ({ toast: { error } }));
vi.mock("@/lib/observability/logger", () => ({ logger: { error: vi.fn() } }));

import { AssignmentActivityForm } from "./assignment-activity-form";

beforeEach(() => {
  vi.resetAllMocks();
  createAssignmentActivity.mockResolvedValue({
    success: true,
    data: { id: "activity-1" },
  });
  uploadAssignmentAttachment.mockResolvedValue({ success: true });
});

async function fillForm(names: string[] = []) {
  const user = userEvent.setup();
  const onSuccess = vi.fn();
  const { container } = render(
    <AssignmentActivityForm assignmentId="a1" onSuccess={onSuccess} />,
  );
  const description = screen.getByLabelText(/Descripción/);
  await user.type(description, "Replaced sensor");
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("File input missing");
  if (names.length)
    await user.upload(
      input,
      names.map(
        (name) => new File(["component fixture"], name, { type: "image/png" }),
      ),
    );
  return { user, description, onSuccess, container };
}

describe("AssignmentActivityForm", () => {
  it("completes all uploads and resets both description and file picker", async () => {
    const { user, description, onSuccess } = await fillForm([
      "first.png",
      "second.png",
    ]);
    await user.click(screen.getByRole("button", { name: "Guardar Actividad" }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(createAssignmentActivity).toHaveBeenCalledTimes(1);
    expect(uploadAssignmentAttachment).toHaveBeenCalledTimes(2);
    expect(description).toHaveValue("");
    expect(screen.queryByText("first.png")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Guardar Actividad" }),
    ).toBeEnabled();
  });

  it("retains mixed partial failures and retries only unfinished files without creating another activity", async () => {
    uploadAssignmentAttachment.mockResolvedValueOnce({ success: true });
    uploadAssignmentAttachment.mockResolvedValueOnce({
      success: false,
      error: "Archivo rechazado",
    });
    uploadAssignmentAttachment.mockRejectedValueOnce(new Error("Disconnected"));
    const { user, description, onSuccess } = await fillForm([
      "done.png",
      "business.png",
      "transport.png",
    ]);
    await user.click(screen.getByRole("button", { name: "Guardar Actividad" }));
    const retry = await screen.findByRole("button", {
      name: "Reintentar archivos pendientes",
    });
    await waitFor(() => expect(retry).toBeEnabled());
    expect(onSuccess).not.toHaveBeenCalled();
    expect(description).toHaveValue("Replaced sensor");
    expect(description).toHaveAttribute("readonly");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Archivos subidos: 1/3",
    );
    expect(
      screen.getByText("business.png: No subido: Archivo rechazado"),
    ).toBeVisible();
    expect(
      screen.getByText("transport.png: No subido: Disconnected"),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Choose Files/ }),
    ).not.toBeInTheDocument();
    uploadAssignmentAttachment.mockResolvedValueOnce({ success: true });
    uploadAssignmentAttachment.mockResolvedValueOnce({
      success: false,
      error: "Aún pendiente",
    });
    await user.click(retry);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Archivos subidos: 2/3",
      ),
    );
    expect(onSuccess).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", { name: "Reintentar archivos pendientes" }),
    );
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(createAssignmentActivity).toHaveBeenCalledTimes(1);
    const uploadedNames = uploadAssignmentAttachment.mock.calls.map(
      ([fd]) => fd.get("file").name,
    );
    expect(uploadedNames).toEqual([
      "done.png",
      "business.png",
      "transport.png",
      "business.png",
      "transport.png",
      "transport.png",
    ]);
    expect(description).toHaveValue("");
    expect(description).not.toHaveAttribute("readonly");
  });

  it.each(["business", "transport"])(
    "retains the uncommitted draft after %s creation failure",
    async (failure) => {
      if (failure === "business")
        createAssignmentActivity.mockResolvedValueOnce({
          success: false,
          error: "No disponible",
        });
      else
        createAssignmentActivity.mockRejectedValueOnce(
          new Error("Disconnected"),
        );
      const { user, description, onSuccess } = await fillForm(["draft.png"]);
      await user.click(
        screen.getByRole("button", { name: "Guardar Actividad" }),
      );
      await waitFor(() => expect(error).toHaveBeenCalled());
      expect(description).toHaveValue("Replaced sensor");
      expect(description).not.toHaveAttribute("readonly");
      expect(screen.getByText("draft.png")).toBeVisible();
      expect(
        screen.getByRole("button", { name: "Guardar Actividad" }),
      ).toBeEnabled();
      expect(uploadAssignmentAttachment).not.toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
    },
  );

  it("blocks duplicate submits and draft changes while creating or uploading", async () => {
    let resolveUpload!: (result: { success: true }) => void;
    uploadAssignmentAttachment.mockReturnValue(
      new Promise((resolve) => {
        resolveUpload = resolve;
      }),
    );
    const { user, description, onSuccess, container } = await fillForm([
      "pending.png",
    ]);
    await user.click(screen.getByRole("button", { name: "Guardar Actividad" }));
    await waitFor(() =>
      expect(uploadAssignmentAttachment).toHaveBeenCalledTimes(1),
    );
    expect(description).toBeDisabled();
    const form = container.querySelector("form");
    if (!form) throw new Error("Form missing");
    fireEvent.submit(form);
    expect(createAssignmentActivity).toHaveBeenCalledTimes(1);
    expect(uploadAssignmentAttachment).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
    resolveUpload({ success: true });
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(description).toBeEnabled();
  });
});
