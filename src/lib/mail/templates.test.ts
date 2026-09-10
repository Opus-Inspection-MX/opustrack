import { describe, expect, it } from "vitest";
import { renderEmail } from "./templates";

describe("renderEmail", () => {
  it("arma encabezado, párrafo y botón con el enlace absoluto", () => {
    const rendered = renderEmail({
      subject: "Nuevo incidente reportado: Bomba",
      intro: "Se reportó un nuevo incidente: Bomba.",
      link: "/admin/incidents/7",
    });

    expect(rendered.subject).toBe("Nuevo incidente reportado: Bomba");
    expect(rendered.html).toContain("OpusTrack");
    expect(rendered.html).toContain("http://localhost:3000/admin/incidents/7");
    expect(rendered.html).toContain("Abrir en OpusTrack");
    expect(rendered.text).toContain("/admin/incidents/7");
  });

  it("escapa la intro en el HTML pero no en el texto", () => {
    const rendered = renderEmail({
      subject: "X",
      intro: "<script>alert(1)</script>",
      link: null,
    });

    expect(rendered.html).toContain("&lt;script&gt;");
    expect(rendered.html).not.toContain("<script>");
    expect(rendered.text).toContain("<script>");
  });

  it("sin enlace no hay botón", () => {
    const rendered = renderEmail({ subject: "X", intro: "Hola." });

    expect(rendered.html).not.toContain("<a href");
    expect(rendered.text).toContain("Hola.");
  });
});
