import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import PasswordRecoveryForm from "./password-recovery-form";

const actions = vi.hoisted(() => ({ request: vi.fn(), reset: vi.fn() }));
vi.mock("@/lib/actions/password-recovery", () => ({
  requestPasswordRecovery: actions.request,
  resetRecoveredPassword: actions.reset,
}));

beforeEach(() => {
  vi.resetAllMocks();
  window.history.replaceState(null, "", "/");
});

it("submits an email and displays the generic recovery acknowledgement", async () => {
  actions.request.mockResolvedValue({ success: true });
  render(<PasswordRecoveryForm mode="request" />);
  fireEvent.change(screen.getByLabelText("Correo electrónico"), {
    target: { value: "user@example.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Enviar enlace" }));
  await waitFor(() =>
    expect(actions.request).toHaveBeenCalledWith("user@example.com"),
  );
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Si tu cuenta está habilitada",
  );
});

it("reads the bearer fragment locally, removes it from history, and posts only on submission", async () => {
  const token = "a".repeat(64);
  window.history.replaceState(null, "", `/reset-password#${token}`);
  actions.reset.mockResolvedValue({ success: true });
  render(<PasswordRecoveryForm mode="reset" />);
  expect(window.location.hash).toBe("");
  expect(actions.reset).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Nueva contraseña"), {
    target: { value: "new-password" },
  });
  fireEvent.change(screen.getByLabelText("Confirmar contraseña"), {
    target: { value: "new-password" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Restablecer contraseña" }),
  );
  await waitFor(() =>
    expect(actions.reset).toHaveBeenCalledWith(
      token,
      "new-password",
      "new-password",
    ),
  );
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Contraseña restablecida",
  );
});

it("offers a new link when the fragment is missing", () => {
  render(<PasswordRecoveryForm mode="reset" />);
  expect(screen.getByRole("alert")).toHaveTextContent("enlace no es válido");
  expect(
    screen.getByRole("link", { name: "Solicitar un nuevo enlace" }),
  ).toHaveAttribute("href", "/forgot-password");
});

it("returns server failures without claiming a successful reset", async () => {
  window.history.replaceState(null, "", `/reset-password#${"a".repeat(64)}`);
  actions.reset.mockResolvedValue({
    success: false,
    error: "El enlace ha expirado.",
  });
  render(<PasswordRecoveryForm mode="reset" />);
  fireEvent.change(screen.getByLabelText("Nueva contraseña"), {
    target: { value: "new-password" },
  });
  fireEvent.change(screen.getByLabelText("Confirmar contraseña"), {
    target: { value: "new-password" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Restablecer contraseña" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "El enlace ha expirado.",
  );
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

it.each([false, true])(
  "clears and uses replacement same-document links after completion=%s",
  async (completed) => {
    const first = "a".repeat(64);
    const replacement = "b".repeat(64);
    window.history.replaceState(null, "", `/reset-password#${first}`);
    actions.reset.mockResolvedValue({ success: true });
    render(<PasswordRecoveryForm mode="reset" />);
    const fillAndSubmit = () => {
      for (const label of ["Nueva contraseña", "Confirmar contraseña"]) {
        fireEvent.change(screen.getByLabelText(label), {
          target: { value: "new-password" },
        });
      }
      fireEvent.click(
        screen.getByRole("button", { name: "Restablecer contraseña" }),
      );
    };
    if (completed) {
      fillAndSubmit();
      await screen.findByRole("status");
    }
    await act(async () => {
      window.location.hash = replacement;
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(window.location.hash).toBe("");
    expect(screen.getByLabelText("Nueva contraseña")).toHaveValue("");
    fillAndSubmit();
    await screen.findByRole("status");
    expect(actions.reset).toHaveBeenLastCalledWith(
      replacement,
      "new-password",
      "new-password",
    );
  },
);

it("does not retain an earlier token when a malformed replacement link is opened", async () => {
  window.history.replaceState(null, "", `/reset-password#${"a".repeat(64)}`);
  render(<PasswordRecoveryForm mode="reset" />);
  await act(async () => {
    window.location.hash = "invalid";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
  expect(window.location.hash).toBe("");
  expect(screen.getByRole("alert")).toHaveTextContent("enlace no es válido");
  expect(actions.reset).not.toHaveBeenCalled();
});

it("ignores a previous submission's result after opening a replacement link", async () => {
  window.history.replaceState(null, "", `/reset-password#${"a".repeat(64)}`);
  let finish: (value: { success: true }) => void = () => {};
  actions.reset.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(<PasswordRecoveryForm mode="reset" />);
  for (const label of ["Nueva contraseña", "Confirmar contraseña"]) {
    fireEvent.change(screen.getByLabelText(label), {
      target: { value: "new-password" },
    });
  }
  fireEvent.click(
    screen.getByRole("button", { name: "Restablecer contraseña" }),
  );
  await act(async () => {
    window.location.hash = "b".repeat(64);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    finish({ success: true });
  });
  expect(screen.getByLabelText("Nueva contraseña")).toHaveValue("");
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Restablecer contraseña" }),
  ).not.toBeDisabled();
});
