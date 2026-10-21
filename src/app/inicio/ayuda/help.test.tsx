import { render, screen, within } from "@testing-library/react";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HelpContent } from "@/components/help/help-content";
import { requireAuth } from "@/lib/auth/auth";
import {
  mergeRoles,
  type Role,
  type UserWithPermissions,
} from "@/lib/authz/authz";
import {
  PERMISSION_LIST,
  resolveSeedGrants,
  type SeedRoleCode,
} from "@/lib/authz/permission-catalog";
import { getHelpGuide, getHelpGuides } from "@/lib/help/guides";
import HelpGuidePage from "./[slug]/page";
import HelpPage from "./page";

vi.mock("@/lib/auth/auth", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: {} }));

function role(code: SeedRoleCode, id = 1): Role {
  const names = new Set<string>(resolveSeedGrants(code));
  return {
    id,
    code,
    name: code,
    description: null,
    defaultPath: "/inicio",
    priority: 0,
    isSuperuser: code === "ROOT",
    permissions: PERMISSION_LIST.filter((p) => names.has(p.name)).map(
      (p, i) => ({
        id: i,
        name: p.name,
        description: p.description ?? null,
        resource: p.resource ?? null,
        action: p.action ?? null,
        routePath: p.routePath ?? null,
        exact: p.exact ?? false,
      }),
    ),
  };
}

function viewer(roles: Role[]): UserWithPermissions {
  return {
    id: "viewer",
    name: "Viewer",
    email: "viewer@example.com",
    ...mergeRoles(roles),
  };
}

beforeEach(() => {
  vi.mocked(requireAuth).mockResolvedValue(viewer([role("ROOT")]));
});

// Motion is covered separately; jsdom does not advance viewport animations.
vi.mock("@/components/motion/fade-in", () => ({
  FadeIn: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe("user help", () => {
  it("lists the five task guides with working Help destinations", async () => {
    render(await HelpPage());
    expect(
      screen.getByRole("heading", { level: 1, name: "Ayuda" }),
    ).toBeVisible();
    const guides = await getHelpGuides(await requireAuth());
    expect(guides.map((guide) => guide.slug)).toEqual([
      "reportar-incidente",
      "programar-trabajo",
      "cerrar-asignacion",
      "registrar-viaje",
      "solicitar-vacaciones",
    ]);
    for (const guide of guides) {
      expect(screen.getByRole("link", { name: guide.title })).toHaveAttribute(
        "href",
        `/inicio/ayuda/${guide.slug}`,
      );
    }
    expect(screen.getByText(/Los permisos de su cuenta/)).toBeVisible();
  });

  it.each([
    ["reportar-incidente", "Reportar un incidente", "Cliente"],
    ["programar-trabajo", "Programar y asignar trabajo", "Crear Asignación"],
    ["cerrar-asignacion", "Ejecutar y cerrar una asignación", "Folio ODT"],
    ["registrar-viaje", "Iniciar y finalizar un viaje", "Finalizar Viaje"],
    ["solicitar-vacaciones", "Solicitar vacaciones", "Enviar Solicitud"],
  ])("renders the canonical Markdown guide %s", async (slug, title, label) => {
    render(await HelpGuidePage({ params: Promise.resolve({ slug }) }));
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: title }),
    ).toBeVisible();
    for (const section of [
      "Quién puede hacerlo",
      "Antes de comenzar",
      "Pasos",
      "Resultado esperado",
      "Si no puede continuar",
    ]) {
      expect(
        screen.getByRole("heading", { level: 2, name: section }),
      ).toBeVisible();
    }
    const article = screen.getByRole("article");
    expect(article).toHaveTextContent(label);
    expect(within(article).getAllByRole("listitem").length).toBeGreaterThan(3);
    const guide = await getHelpGuide(slug, await requireAuth());
    expect(guide).toBeDefined();
    for (const block of guide?.blocks ?? []) {
      if ("text" in block) expect(article).toHaveTextContent(block.text);
      else
        for (const item of block.items) expect(article).toHaveTextContent(item);
    }
    expect(
      screen.getByRole("link", { name: "Todas las guías" }),
    ).toHaveAttribute("href", "/inicio/ayuda");
  });

  it("returns 404 for unknown slugs without resolving arbitrary files", async () => {
    expect(
      await getHelpGuide("../../CLAUDE", await requireAuth()),
    ).toBeUndefined();
    expect(await getHelpGuide("toString", await requireAuth())).toBeUndefined();
    vi.mocked(notFound).mockImplementationOnce(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
    await expect(
      HelpGuidePage({ params: Promise.resolve({ slug: "missing" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it.each<[SeedRoleCode, string[]]>([
    [
      "ROOT",
      [
        "Reportar un incidente",
        "Programar y asignar trabajo",
        "Ejecutar y cerrar una asignación",
        "Iniciar y finalizar un viaje",
        "Solicitar vacaciones",
      ],
    ],
    [
      "ADMIN_OPERACION",
      ["Programar y asignar trabajo", "Solicitar vacaciones"],
    ],
    ["ADMIN_VACACIONES", ["Solicitar vacaciones"]],
    [
      "FSR",
      [
        "Ejecutar y cerrar una asignación",
        "Iniciar y finalizar un viaje",
        "Solicitar vacaciones",
      ],
    ],
    ["EMPLEADO", ["Solicitar vacaciones"]],
    ["REPORTER", ["Reportar un incidente"]],
    ["GUEST", []],
  ])("shows only applicable guides grouped under %s", async (code, titles) => {
    vi.mocked(requireAuth).mockResolvedValue(viewer([role(code)]));
    render(await HelpPage());
    expect(
      screen.queryAllByRole("link").map((link) => link.textContent),
    ).toEqual(titles);
    if (titles.length) {
      expect(screen.getByRole("region", { name: code })).toBeVisible();
    } else {
      expect(
        screen.getByText("Todavía no hay guías disponibles para sus permisos."),
      ).toBeVisible();
    }
  });

  it("keeps every assigned role and its applicable guides for multi-role accounts", async () => {
    vi.mocked(requireAuth).mockResolvedValue(
      viewer([role("ADMIN_VACACIONES", 1), role("FSR", 2)]),
    );
    render(await HelpPage());
    expect(
      within(
        screen.getByRole("region", { name: "ADMIN_VACACIONES" }),
      ).getByRole("link", { name: "Solicitar vacaciones" }),
    ).toBeVisible();
    const fsr = within(screen.getByRole("region", { name: "FSR" }));
    expect(
      fsr.getByRole("link", { name: "Ejecutar y cerrar una asignación" }),
    ).toBeVisible();
    expect(
      fsr.getByRole("link", { name: "Solicitar vacaciones" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("link", { name: "Programar y asignar trabajo" }),
    ).toBeNull();
  });

  it("uses editable role names without hardcoding seed role identities", async () => {
    const custom = {
      ...role("EMPLEADO"),
      code: null,
      name: "Personal de oficina",
    };
    vi.mocked(requireAuth).mockResolvedValue(viewer([custom]));
    render(await HelpPage());
    expect(screen.getByRole("region", { name: custom.name })).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Solicitar vacaciones" }),
    ).toBeVisible();
    expect(screen.queryByRole("heading", { name: "EMPLEADO" })).toBeNull();
  });

  it("retains workflows enabled only by combining roles", async () => {
    const base = role("EMPLEADO");
    const routes = {
      ...base,
      id: 1,
      code: null,
      name: "Acceso",
      permissions: base.permissions.filter((p) => p.routePath),
    };
    const actions = {
      ...base,
      id: 2,
      code: null,
      name: "Solicitudes",
      permissions: base.permissions.filter((p) => !p.routePath),
    };
    vi.mocked(requireAuth).mockResolvedValue(viewer([routes, actions]));
    render(await HelpPage());
    const group = screen.getByRole("region", { name: "Permisos combinados" });
    expect(
      within(group).getByRole("link", { name: "Solicitar vacaciones" }),
    ).toBeVisible();
    expect(screen.getByText(/Acceso, Solicitudes/)).toBeVisible();
    expect(
      await getHelpGuide("solicitar-vacaciones", await requireAuth()),
    ).toBeDefined();
  });

  it("honors superuser capability without explicit permission rows", async () => {
    vi.mocked(requireAuth).mockResolvedValue(
      viewer([{ ...role("ROOT"), name: "Responsable", permissions: [] }]),
    );
    render(await HelpPage());
    expect(screen.getAllByRole("link")).toHaveLength(5);
    expect(screen.getByRole("region", { name: "Responsable" })).toBeVisible();
  });

  it.each<[SeedRoleCode, string, string]>([
    ["REPORTER", "reportar-incidente", "incidents:create"],
    ["ADMIN_OPERACION", "programar-trabajo", "assignments:create"],
    ["FSR", "cerrar-asignacion", "assignments:complete"],
    ["FSR", "registrar-viaje", "vehicle-trips:update"],
    ["EMPLEADO", "solicitar-vacaciones", "vacations:create"],
  ])(
    "denies %s guide %s after an action grant is removed, including direct URLs",
    async (code, slug, revoked) => {
      const restricted = role(code);
      restricted.permissions = restricted.permissions.filter(
        (p) => p.name !== revoked,
      );
      const user = viewer([restricted]);
      vi.mocked(requireAuth).mockResolvedValue(user);
      render(await HelpPage());
      expect(
        document.querySelector(`a[href="/inicio/ayuda/${slug}"]`),
      ).toBeNull();
      expect(await getHelpGuide(slug, user)).toBeUndefined();
      vi.mocked(notFound).mockImplementationOnce(() => {
        throw new Error("NEXT_NOT_FOUND");
      });
      await expect(
        HelpGuidePage({ params: Promise.resolve({ slug }) }),
      ).rejects.toThrow("NEXT_NOT_FOUND");
    },
  );

  it("does not confuse a route-only grant or an exact list grant with workflow access", async () => {
    const employee = role("EMPLEADO");
    const routeOnly = {
      ...employee,
      permissions: employee.permissions.filter((p) => p.routePath),
    };
    expect(await getHelpGuides(viewer([routeOnly]))).toEqual([]);
    const exactList = {
      ...employee,
      permissions: employee.permissions.map((p) => ({
        ...p,
        exact: p.routePath === "/vacations" || p.exact,
      })),
    };
    expect(
      await getHelpGuide("solicitar-vacaciones", viewer([exactList])),
    ).toBeUndefined();
  });

  it("hides calendar instructions when only assignment access is granted", async () => {
    const admin = role("ADMIN_OPERACION");
    admin.permissions = admin.permissions.filter(
      (p) =>
        !["route:admin-programacion", "route:admin-schedules"].includes(p.name),
    );
    vi.mocked(requireAuth).mockResolvedValue(viewer([admin]));
    render(
      await HelpGuidePage({
        params: Promise.resolve({ slug: "programar-trabajo" }),
      }),
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Programar y asignar trabajo",
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Programación y asignaciones" }),
    ).toBeNull();
    expect(screen.queryByText(/Seleccionar Programación/)).toBeNull();
    expect(
      screen.getByRole("heading", { name: "Si no puede continuar" }),
    ).toBeVisible();
  });

  it("accepts exact grants when they cover every page in a finite workflow", async () => {
    const employee = role("EMPLEADO");
    const route = employee.permissions.find(
      (p) => p.routePath === "/vacations",
    );
    if (!route) throw new Error("Vacation route fixture is missing");
    employee.permissions = employee.permissions.map((p) =>
      p === route ? { ...p, exact: true } : p,
    );
    employee.permissions.push({
      ...route,
      id: 999,
      name: "custom:new-vacation",
      routePath: "/vacations/new",
      exact: true,
    });
    const user = viewer([employee]);
    vi.mocked(requireAuth).mockResolvedValue(user);
    render(await HelpPage());
    expect(
      screen.getByRole("link", { name: "Solicitar vacaciones" }),
    ).toBeVisible();
    expect(await getHelpGuide("solicitar-vacaciones", user)).toBeDefined();
  });

  it("rechecks the current user instead of reusing a previous reader's content", async () => {
    expect(
      await getHelpGuide("programar-trabajo", await requireAuth()),
    ).toBeDefined();
    vi.mocked(requireAuth).mockResolvedValue(viewer([role("EMPLEADO")]));
    expect(
      await getHelpGuide("programar-trabajo", await requireAuth()),
    ).toBeUndefined();
    vi.mocked(requireAuth).mockRejectedValueOnce(
      new Error("Authentication required"),
    );
    await expect(HelpPage()).rejects.toThrow("Authentication required");
    vi.mocked(requireAuth).mockRejectedValueOnce(
      new Error("Authentication required"),
    );
    await expect(
      HelpGuidePage({
        params: Promise.resolve({ slug: "solicitar-vacaciones" }),
      }),
    ).rejects.toThrow("Authentication required");
  });

  it("renders authored text without interpreting HTML or executable links", () => {
    const { container } = render(
      <HelpContent
        blocks={[
          {
            type: "paragraph",
            text: "<script>alert(1)</script> [link](javascript:alert(1))",
          },
        ]}
      />,
    );
    expect(container).toHaveTextContent("<script>alert(1)</script>");
    expect(container.querySelector("script, a")).toBeNull();
  });
});
