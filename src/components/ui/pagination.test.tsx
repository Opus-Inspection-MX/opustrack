import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Pagination } from "./pagination";

const PROPS = {
  currentPage: 2,
  totalPages: 5,
  totalItems: 50,
  itemsPerPage: 10,
  onPageChange: vi.fn(),
  onItemsPerPageChange: vi.fn(),
};

describe("Pagination", () => {
  it("da nombre accesible en español a cada control", () => {
    render(<Pagination {...PROPS} />);
    expect(
      screen.getByRole("button", { name: "Primera página" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Página anterior" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Página siguiente" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Última página" }),
    ).toBeInTheDocument();
    // El texto "Resultados por página:" es un <span> suelto (oculto en
    // móvil), así que el SelectTrigger lleva su propio nombre.
    expect(
      screen.getByRole("combobox", { name: "Resultados por página" }),
    ).toBeInTheDocument();
  });
});
