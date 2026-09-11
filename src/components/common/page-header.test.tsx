import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHeader } from "./page-header";

describe("PageHeader", () => {
  it("renderiza un solo h1 con el título", () => {
    render(<PageHeader title="Seguimiento" description="Panel operativo" />);
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent("Seguimiento");
    expect(screen.getByText("Panel operativo")).toBeInTheDocument();
  });

  it("muestra acciones y breadcrumbs sin duplicar encabezados", () => {
    render(
      <PageHeader
        title="Incidentes"
        actions={<button type="button">Nuevo</button>}
        breadcrumbs={[
          { label: "Inicio", href: "/inicio" },
          { label: "Incidentes" },
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: "Nuevo" })).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "breadcrumb" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Incidentes", { selector: "h1" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});
