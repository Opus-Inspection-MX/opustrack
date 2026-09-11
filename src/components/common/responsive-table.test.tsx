import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResponsiveTable } from "./responsive-table";

const rows = [
  { id: "a", name: "Línea 1" },
  { id: "b", name: "Línea 2" },
];

type Row = { id: string; name: string };

const columns = [{ header: "Nombre", cell: (row: Row) => row.name }];

function renderTable() {
  return render(
    <ResponsiveTable
      data={rows}
      columns={columns}
      rowKey={(row: Row) => row.id}
      mobileCard={(row: Row) => (
        <div data-testid={`card-${row.id}`}>{row.name}</div>
      )}
      emptyMessage="Sin líneas."
      emptyTitle="Sin líneas"
    />,
  );
}

describe("ResponsiveTable", () => {
  it("modo desktop: tabla nativa con filas role=row", () => {
    renderTable();
    const table = screen.getByRole("table");
    const bodyRows = within(table).getAllByRole("row");
    // Header row + 2 data rows.
    expect(bodyRows).toHaveLength(3);
    expect(within(table).getByText("Línea 1")).toBeInTheDocument();
  });

  it("modo móvil: una tarjeta por fila", () => {
    renderTable();
    expect(screen.getByTestId("card-a")).toHaveTextContent("Línea 1");
    expect(screen.getByTestId("card-b")).toHaveTextContent("Línea 2");
  });

  it("muestra el estado vacío sin tabla ni tarjetas", () => {
    render(
      <ResponsiveTable
        data={[] as Row[]}
        columns={columns}
        rowKey={(row: Row) => row.id}
        mobileCard={(row: Row) => <div>{row.name}</div>}
        emptyMessage="Sin líneas."
        emptyTitle="Sin líneas"
      />,
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText("Sin líneas.")).toBeInTheDocument();
  });
});
