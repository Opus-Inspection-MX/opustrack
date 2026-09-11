import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FilterBar } from "./filter-bar";

describe("FilterBar", () => {
  it("muestra los filtros en línea y el disparador móvil con el conteo", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    render(
      <FilterBar activeCount={2} onClear={() => {}}>
        <label htmlFor="estado">Estado</label>
        <input id="estado" />
      </FilterBar>,
    );

    // Desktop inline filters.
    expect(screen.getByLabelText("Estado")).toBeInTheDocument();
    // Mobile trigger never reads "Buscar" (e2e collision).
    const trigger = screen.getByRole("button", { name: "Filtros" });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent("2");
    expect(
      screen.queryByRole("button", { name: "Buscar" }),
    ).not.toBeInTheDocument();

    await userEvent.click(trigger);
    expect(screen.getByText("Limpiar filtros")).toBeInTheDocument();
  });

  it("oculta el conteo cuando no hay filtros activos", () => {
    render(
      <FilterBar>
        <span>Campo</span>
      </FilterBar>,
    );
    expect(screen.getByRole("button", { name: "Filtros" })).toBeInTheDocument();
  });
});
