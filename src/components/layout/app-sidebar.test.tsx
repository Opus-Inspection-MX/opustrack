import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";

const navigation = vi.hoisted(() => ({ pathname: "/admin/incidents" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: {
      user: {
        name: "Test User",
        email: "test@example.com",
        isSuperuser: true,
      },
    },
    status: "authenticated",
  }),
  signOut: vi.fn(),
}));

function sidebar(open = true) {
  return (
    <SidebarProvider open={open}>
      <AppSidebar />
    </SidebarProvider>
  );
}

describe("AppSidebar group visibility", () => {
  let cookies: Map<string, string>;

  beforeEach(() => {
    navigation.pathname = "/admin/incidents";
    cookies = new Map();
    vi.spyOn(document, "cookie", "get").mockImplementation(() =>
      [...cookies].map(([key, value]) => `${key}=${value}`).join("; "),
    );
    vi.spyOn(document, "cookie", "set").mockImplementation((cookie) => {
      const [key, value] = cookie.split(";")[0].split("=");
      cookies.set(key, value);
    });
    vi.stubGlobal(
      "matchMedia",
      vi.fn((media: string) => ({
        matches: false,
        media,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
  });

  it("hides a closed group's links and restores them when reopened", async () => {
    const user = userEvent.setup();
    render(sidebar());
    const trigger = screen.getByRole("button", { name: "Operación" });
    const link = screen.getByRole("link", { name: "Incidentes" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(link).toBeVisible();
    expect(link).toHaveAttribute("href", "/admin/incidents");

    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(link).not.toBeVisible();
    expect(screen.queryByRole("link", { name: "Incidentes" })).toBeNull();
    expect(cookies.get("nav-groups-collapsed")).toBe(
      encodeURIComponent('["Operación"]'),
    );
    expect(
      screen.getByRole("button", { name: "Administración" }),
    ).toHaveAttribute("aria-expanded", "true");

    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Incidentes" })).toBeVisible();
    expect(cookies.get("nav-groups-collapsed")).toBe(encodeURIComponent("[]"));
  });

  it("restores collapsed groups and preserves them across route changes", () => {
    cookies.set("nav-groups-collapsed", encodeURIComponent('["Operación"]'));
    const view = render(sidebar());

    expect(screen.getByRole("button", { name: "Operación" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByRole("link", { name: "Incidentes" })).toBeNull();

    navigation.pathname = "/admin/incidents/new";
    view.rerender(sidebar());

    expect(screen.queryByRole("link", { name: "Incidentes" })).toBeNull();
  });

  it("keeps compact-mode links accessible without overwriting group preferences", () => {
    cookies.set("nav-groups-collapsed", encodeURIComponent('["Operación"]'));
    const view = render(sidebar(false));

    expect(screen.getByRole("link", { name: "Incidentes" })).toBeVisible();
    expect(cookies.get("nav-groups-collapsed")).toBe(
      encodeURIComponent('["Operación"]'),
    );

    view.rerender(sidebar(true));

    expect(screen.queryByRole("link", { name: "Incidentes" })).toBeNull();
  });
});
