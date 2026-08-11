"use client";

import * as React from "react";

/**
 * Toast queue.
 *
 * The store lives at module level rather than in a context provider so that
 * `toast.error(...)` can be called from anywhere — a plain event handler, a
 * catch block, a helper outside React — instead of only from inside a component
 * that called a hook. `<Toaster />` in the root layout is the single subscriber
 * that renders it.
 *
 * The store holds no timers: auto-dismiss lives in the Toast component, which is
 * what makes "pause while the pointer is over the message" possible. A user
 * reading why their delete was refused should not lose the text mid-sentence.
 */

export type ToastVariant = "default" | "success" | "destructive";

export interface ToastOptions {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  /** Milliseconds before auto-dismiss; `0` keeps it until dismissed. */
  duration?: number;
}

export interface ToastItem extends Required<Omit<ToastOptions, "description">> {
  id: string;
  description?: string;
  /** False while the exit animation plays, before removal. */
  open: boolean;
}

/** At most this many at once; the oldest is dropped. */
export const TOAST_LIMIT = 3;

/** How long the exit animation gets before the item leaves the list. */
export const TOAST_REMOVE_DELAY = 200;

const DEFAULT_DURATION: Record<ToastVariant, number> = {
  default: 4000,
  success: 4000,
  // Longer: a rejected business rule is text the user has to read and act on.
  destructive: 8000,
};

type Action =
  | { type: "ADD"; toast: ToastItem }
  | { type: "DISMISS"; id: string }
  | { type: "REMOVE"; id: string };

export function reducer(state: ToastItem[], action: Action): ToastItem[] {
  switch (action.type) {
    case "ADD":
      return [action.toast, ...state].slice(0, TOAST_LIMIT);
    case "DISMISS":
      return state.map((item) =>
        item.id === action.id ? { ...item, open: false } : item,
      );
    case "REMOVE":
      return state.filter((item) => item.id !== action.id);
  }
}

let memoryState: ToastItem[] = [];
const listeners = new Set<(state: ToastItem[]) => void>();

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  for (const listener of listeners) {
    listener(memoryState);
  }
}

let counter = 0;
function nextId() {
  counter += 1;
  return `toast-${counter}`;
}

/** Start the exit animation, then drop the toast from the list. */
export function dismissToast(id: string) {
  dispatch({ type: "DISMISS", id });
  setTimeout(() => dispatch({ type: "REMOVE", id }), TOAST_REMOVE_DELAY);
}

function push(options: ToastOptions): string {
  const variant = options.variant ?? "default";
  const id = nextId();

  dispatch({
    type: "ADD",
    toast: {
      id,
      title: options.title ?? "",
      description: options.description,
      variant,
      duration: options.duration ?? DEFAULT_DURATION[variant],
      open: true,
    },
  });

  return id;
}

/**
 * Show a toast.
 *
 * `toast.error(message)` is the one that matters: it is how a rejected Server
 * Action explains itself to the user.
 */
export const toast = Object.assign(push, {
  error: (title: string, description?: string) =>
    push({ title, description, variant: "destructive" }),
  success: (title: string, description?: string) =>
    push({ title, description, variant: "success" }),
  dismiss: dismissToast,
});

/** Current queue. Stable reference between dispatches. */
export function getToasts(): ToastItem[] {
  return memoryState;
}

/** Observe the queue. `<Toaster />` and the tests are the only subscribers. */
export function subscribeToasts(
  listener: (state: ToastItem[]) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Empty during the server render — a toast only ever exists on the client. */
const SERVER_SNAPSHOT: ToastItem[] = [];

/** Subscribe a component to the queue. Used by `<Toaster />`. */
export function useToast() {
  const toasts = React.useSyncExternalStore(
    subscribeToasts,
    getToasts,
    () => SERVER_SNAPSHOT,
  );

  return { toasts, toast, dismiss: dismissToast };
}

/** Test seam: drop everything without waiting for animations. */
export function resetToasts() {
  memoryState = [];
  counter = 0;
  for (const listener of listeners) {
    listener(memoryState);
  }
}
