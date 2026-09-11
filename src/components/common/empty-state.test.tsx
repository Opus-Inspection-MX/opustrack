import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("muestra título y descripción", () => {
    render(
      <EmptyState
        title="Sin asignaciones"
        description="No tienes trabajo pendiente."
      />,
    );
    expect(screen.getByText("Sin asignaciones")).toBeInTheDocument();
    expect(
      screen.getByText("No tienes trabajo pendiente."),
    ).toBeInTheDocument();
  });

  it("dispara el CTA configurado", async () => {
    const onClick = vi.fn();
    const { default: userEvent } = await import("@testing-library/user-event");
    render(
      <EmptyState title="Sin datos" action={{ label: "Crear", onClick }} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Crear" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renderiza el CTA como enlace cuando hay href", () => {
    render(
      <EmptyState
        title="Sin datos"
        action={{ label: "Ir", href: "/inicio" }}
      />,
    );
    expect(screen.getByRole("link", { name: "Ir" })).toHaveAttribute(
      "href",
      "/inicio",
    );
  });
});
