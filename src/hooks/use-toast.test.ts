import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  dismissToast,
  getToasts,
  reducer,
  resetToasts,
  subscribeToasts,
  TOAST_LIMIT,
  TOAST_REMOVE_DELAY,
  type ToastItem,
  toast,
} from "./use-toast";

/**
 * The toast queue.
 *
 * Tested through the store, not the DOM: the store is where the behaviour that
 * can break lives — the visible cap, and the two-step dismissal that lets the
 * exit animation run before the item disappears.
 */

const item = (id: string, open = true): ToastItem => ({
  id,
  title: id,
  variant: "default",
  duration: 4000,
  open,
});

describe("reducer", () => {
  it("agrega el más reciente al frente", () => {
    const state = reducer(reducer([], { type: "ADD", toast: item("a") }), {
      type: "ADD",
      toast: item("b"),
    });

    expect(state.map((t) => t.id)).toEqual(["b", "a"]);
  });

  it("descarta los más viejos al superar el límite visible", () => {
    let state: ToastItem[] = [];
    for (let i = 0; i < TOAST_LIMIT + 2; i++) {
      state = reducer(state, { type: "ADD", toast: item(`t${i}`) });
    }

    expect(state).toHaveLength(TOAST_LIMIT);
    // The two oldest fell off the end.
    expect(state.map((t) => t.id)).not.toContain("t0");
  });

  it("DISMISS cierra sin quitar, para que corra la animación de salida", () => {
    const state = reducer([item("a"), item("b")], { type: "DISMISS", id: "a" });

    expect(state).toHaveLength(2);
    expect(state.find((t) => t.id === "a")?.open).toBe(false);
    expect(state.find((t) => t.id === "b")?.open).toBe(true);
  });

  it("REMOVE saca el toast de la lista", () => {
    const state = reducer([item("a"), item("b")], { type: "REMOVE", id: "a" });

    expect(state.map((t) => t.id)).toEqual(["b"]);
  });
});

describe("store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetToasts();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetToasts();
  });

  it("toast.error usa la variante destructive", () => {
    toast.error("Uno o más FSR no tienen rol FSR");

    expect(getToasts()[0]).toMatchObject({
      title: "Uno o más FSR no tienen rol FSR",
      variant: "destructive",
      open: true,
    });
  });

  it("toast.success usa la variante success", () => {
    toast.success("Guardado");

    expect(getToasts()[0]).toMatchObject({
      title: "Guardado",
      variant: "success",
    });
  });

  it("el rechazo dura más que el aviso de éxito, para poder leerlo", () => {
    toast.success("ok");
    const success = getToasts()[0];
    toast.error("no se puede");
    const failure = getToasts()[0];

    expect(failure.duration).toBeGreaterThan(success.duration);
  });

  it("dismiss cierra primero y quita después del retardo de animación", () => {
    const id = toast({ title: "hola" });
    dismissToast(id);

    expect(getToasts()).toHaveLength(1);
    expect(getToasts()[0].open).toBe(false);

    vi.advanceTimersByTime(TOAST_REMOVE_DELAY);

    expect(getToasts()).toHaveLength(0);
  });

  it("notifica a los suscriptores en cada cambio y deja de hacerlo al cancelar", () => {
    const seen: number[] = [];
    const unsubscribe = subscribeToasts((state) => seen.push(state.length));

    toast.error("uno");
    toast.error("dos");
    expect(seen).toEqual([1, 2]);

    unsubscribe();
    toast.error("tres");
    expect(seen).toEqual([1, 2]);
  });

  it("cada toast recibe un id propio", () => {
    const first = toast({ title: "a" });
    const second = toast({ title: "b" });

    expect(first).not.toBe(second);
  });
});
