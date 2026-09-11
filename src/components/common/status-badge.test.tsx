import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "./status-badge";

describe("StatusBadge", () => {
  it("muestra el contenido con el tono neutro por defecto", () => {
    render(<StatusBadge>Pendiente</StatusBadge>);
    const badge = screen.getByText("Pendiente");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toMatch(/bg-muted/);
  });

  it("aplica los tokens de estado en lugar de colores crudos", () => {
    const { rerender } = render(<StatusBadge tone="open">Abierto</StatusBadge>);
    expect(screen.getByText("Abierto").className).toMatch(
      /bg-status-open-muted/,
    );

    rerender(<StatusBadge tone="progress">En progreso</StatusBadge>);
    expect(screen.getByText("En progreso").className).toMatch(
      /bg-status-progress-muted/,
    );

    rerender(<StatusBadge tone="done">Listo</StatusBadge>);
    expect(screen.getByText("Listo").className).toMatch(/bg-status-done-muted/);

    rerender(<StatusBadge tone="cancelled">Cancelado</StatusBadge>);
    expect(screen.getByText("Cancelado").className).toMatch(
      /bg-status-cancelled-muted/,
    );
  });

  it("nunca usa clases de paleta cruda", () => {
    render(<StatusBadge tone="danger">Error</StatusBadge>);
    const className = screen.getByText("Error").className;
    expect(className).not.toMatch(
      /(text|bg|border)-(red|green|blue|gray|yellow)-\d/,
    );
    expect(className).toMatch(/bg-danger-muted/);
  });
});
