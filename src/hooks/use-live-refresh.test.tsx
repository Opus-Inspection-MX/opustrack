import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The rules that keep the auto-refresh from becoming a self-inflicted denial of
 * service. Each one exists because the naive version of this screen — reload
 * everything on a timer — is what we deliberately did not build.
 */

import { useLiveRefresh } from "./use-live-refresh";

const INTERVAL = 1000;

/** Drives `document.visibilityState`, which jsdom exposes as a plain getter. */
function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    value: state,
    configurable: true,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

function Probe({
  signature,
  onChanged,
}: {
  signature: () => Promise<string | null>;
  onChanged: () => void;
}) {
  useLiveRefresh({ signature, onChanged, intervalMs: INTERVAL });
  return null;
}

/** Advance timers and let the awaited signature settle. */
async function tick(times = 1) {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      vi.advanceTimersByTime(INTERVAL);
    });
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  setVisibility("visible");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useLiveRefresh", () => {
  it("no recarga si la firma no cambió", async () => {
    const signature = vi.fn(async () => "same");
    const onChanged = vi.fn();

    render(<Probe signature={signature} onChanged={onChanged} />);
    await tick(3);

    expect(signature.mock.calls.length).toBeGreaterThan(1);
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("no recarga al llegar: la primera firma se anota, no se actúa", async () => {
    const onChanged = vi.fn();

    render(<Probe signature={async () => "first"} onChanged={onChanged} />);
    await act(async () => {});

    expect(onChanged).not.toHaveBeenCalled();
  });

  it("recarga una sola vez cuando la firma cambia", async () => {
    let value = "a";
    const onChanged = vi.fn();

    render(<Probe signature={async () => value} onChanged={onChanged} />);
    await act(async () => {});

    value = "b";
    await tick();
    expect(onChanged).toHaveBeenCalledTimes(1);

    await tick(2);
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("no pregunta nada mientras la pestaña está en segundo plano", async () => {
    const signature = vi.fn(async () => "x");

    render(<Probe signature={signature} onChanged={vi.fn()} />);
    await act(async () => {});
    const atMount = signature.mock.calls.length;

    setVisibility("hidden");
    await tick(5);

    expect(signature.mock.calls.length).toBe(atMount);
  });

  it("pregunta en cuanto la pestaña vuelve al frente, sin esperar el intervalo", async () => {
    const signature = vi.fn(async () => "x");

    render(<Probe signature={signature} onChanged={vi.fn()} />);
    await act(async () => {});
    setVisibility("hidden");
    await tick(3);
    const whileHidden = signature.mock.calls.length;

    await act(async () => {
      setVisibility("visible");
    });

    expect(signature.mock.calls.length).toBe(whileHidden + 1);
  });

  it("no encima consultas: una respuesta lenta no acumula otra detrás", async () => {
    let release: (value: string) => void = () => {};
    const signature = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          release = resolve;
        }),
    );

    render(<Probe signature={signature} onChanged={vi.fn()} />);
    await tick(4);

    // Cuatro intervalos con la primera consulta aún en vuelo: una sola llamada.
    expect(signature).toHaveBeenCalledTimes(1);

    await act(async () => {
      release("done");
    });
    await tick();
    expect(signature).toHaveBeenCalledTimes(2);
  });

  it("una firma fallida no rompe nada ni dispara una recarga", async () => {
    const onChanged = vi.fn();
    const signature = vi
      .fn<() => Promise<string | null>>()
      .mockResolvedValueOnce("a")
      .mockRejectedValueOnce(new Error("red caída"))
      .mockResolvedValue("a");

    render(<Probe signature={signature} onChanged={onChanged} />);
    await act(async () => {});
    await tick(2);

    expect(onChanged).not.toHaveBeenCalled();
  });

  it("deja de preguntar al desmontarse", async () => {
    const signature = vi.fn(async () => "x");

    const { unmount } = render(
      <Probe signature={signature} onChanged={vi.fn()} />,
    );
    await act(async () => {});
    unmount();
    const atUnmount = signature.mock.calls.length;

    await tick(5);

    expect(signature.mock.calls.length).toBe(atUnmount);
  });
});
