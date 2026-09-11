import { render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider as AppThemeProvider } from "../theme-provider";
import { ThemeToggle } from "./theme-toggle";

function renderToggle() {
  return render(
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ThemeToggle />
    </ThemeProvider>,
  );
}

describe("ThemeToggle", () => {
  beforeEach(() => {
    // jsdom corre con origen opaco: `window.localStorage` no existe y
    // next-themes lo tolera, así que el stub va aquí para sembrar/leer.
    const store = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      writable: true,
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, String(value));
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
        clear: () => store.clear(),
      },
    });
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it("ofrece Claro, Oscuro y Sistema, sin Opus", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    renderToggle();
    await userEvent.click(screen.getByRole("button", { name: "Cambiar tema" }));
    expect(
      screen.getByRole("menuitemradio", { name: /Claro/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitemradio", { name: /Oscuro/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitemradio", { name: /Sistema/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitemradio", { name: /Opus/ }),
    ).not.toBeInTheDocument();
  });

  it("elegir Oscuro pone la clase dark", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    renderToggle();
    await userEvent.click(screen.getByRole("button", { name: "Cambiar tema" }));
    await userEvent.click(
      screen.getByRole("menuitemradio", { name: /Oscuro/ }),
    );
    await waitFor(() =>
      expect(document.documentElement.className).toMatch(/dark/),
    );
  });

  it("migra la preferencia opus guardada a Claro", async () => {
    window.localStorage.setItem("theme", "opus");
    render(
      <AppThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        themes={["light", "dark"]}
        value={{ light: "light", dark: "dark" }}
      >
        <ThemeToggle />
      </AppThemeProvider>,
    );
    await waitFor(() =>
      expect(window.localStorage.getItem("theme")).toBe("light"),
    );
  });
});
