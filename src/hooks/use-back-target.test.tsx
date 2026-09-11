import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The "volver" target contract (admin-y-difusiones, Part A).
 *
 * The hook used to remember a single list route, so sitting on a page the
 * heuristic calls a list (`/notifications`) stored that same page and the
 * back link pointed at itself — pressing it did nothing. Now it keeps a
 * short stack of the last 3 distinct list routes and the target is never
 * the current route.
 */

const { pathnameHolder } = vi.hoisted(() => ({
  pathnameHolder: { value: "/" },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameHolder.value,
}));

import { useBackTarget } from "./use-back-target";

function Probe({ fallback }: { fallback: string }) {
  const target = useBackTarget(fallback);
  return <div data-testid="back-target" data-target={target} />;
}

function renderAt(path: string, fallback = "/inicio") {
  pathnameHolder.value = path;
  return render(<Probe fallback={fallback} />);
}

function targetOf(): string | null {
  return screen.getByTestId("back-target").getAttribute("data-target");
}

beforeEach(() => {
  window.sessionStorage.clear();
  pathnameHolder.value = "/";
});

describe("useBackTarget", () => {
  it("lista → detalle devuelve la lista", () => {
    const view = renderAt("/admin/incidents");
    // On the list itself with no prior history there is nothing older,
    // so the fallback applies — never the page we are already on.
    expect(targetOf()).toBe("/inicio");

    pathnameHolder.value = "/admin/incidents/12";
    view.rerender(<Probe fallback="/inicio" />);

    expect(targetOf()).toBe("/admin/incidents");
  });

  it("estando en la lista devuelve el fallback, nunca la ruta actual", () => {
    renderAt("/notifications", "/inicio");

    expect(targetOf()).toBe("/inicio");
    expect(targetOf()).not.toBe("/notifications");
  });

  it("dos listas seguidas y luego un detalle devuelve la última", () => {
    const view = renderAt("/admin/incidents");

    pathnameHolder.value = "/admin/assignments";
    view.rerender(<Probe fallback="/inicio" />);
    expect(targetOf()).toBe("/admin/incidents");

    pathnameHolder.value = "/admin/assignments/7";
    view.rerender(<Probe fallback="/inicio" />);

    expect(targetOf()).toBe("/admin/assignments");
  });

  it("pestaña nueva sin historial devuelve el fallback", () => {
    renderAt("/admin/incidents/7", "/admin/incidents");

    expect(targetOf()).toBe("/admin/incidents");
  });
});
