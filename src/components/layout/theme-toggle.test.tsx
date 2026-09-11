import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

  it("ofrece Claro, Oscuro, Opus y Sistema", async () => {
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
      screen.getByRole("menuitemradio", { name: /Opus/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitemradio", { name: /Sistema/ }),
    ).toBeInTheDocument();
  });

  it("cambia al tema Opus al elegirlo", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    renderToggle();
    await userEvent.click(screen.getByRole("button", { name: "Cambiar tema" }));
    await userEvent.click(screen.getByRole("menuitemradio", { name: /Opus/ }));
    expect(document.documentElement.className).toMatch(/opus/);
  });
});
