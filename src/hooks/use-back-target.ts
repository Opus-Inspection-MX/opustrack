"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const KEY = "opustrack:last-list";

/**
 * How many list routes the tab remembers. Three is enough to walk back
 * through a list → list → detail trail; anything longer stops being "back"
 * and starts being history.
 */
const MAX_ENTRIES = 3;

/**
 * A list is any route that is not a detail, a form, or a nested action,
 * which in this app means it has no `/new`, `/edit` or id segment.
 */
function isListRoute(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1] ?? "";
  // A list route ends in a plain word: `/admin/incidents`. Anything ending in
  // an id, `new` or `edit` is somewhere you came FROM a list.
  return (
    segments.length > 0 &&
    last !== "new" &&
    last !== "edit" &&
    !/^\d+$/.test(last) &&
    // cuid ids are long and alphanumeric; a section name is not.
    !(last.length > 20 && /^[a-z0-9]+$/i.test(last))
  );
}

/**
 * Reads the remembered stack, tolerating the single raw value stored before
 * the stack existed.
 */
function readStack(): string[] {
  const raw = window.sessionStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (entry): entry is string => typeof entry === "string",
      );
    }
    return typeof parsed === "string" ? [parsed] : [];
  } catch {
    // Stored raw, never JSON-encoded: a lone pathname from the old shape.
    return [raw];
  }
}

/** Pushes a list route to the front, distinct and capped. Returns the stack. */
function pushList(pathname: string): string[] {
  const next = [
    pathname,
    ...readStack().filter((entry) => entry !== pathname),
  ].slice(0, MAX_ENTRIES);
  window.sessionStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

/**
 * Where "volver" should actually take you.
 *
 * Every back button in the app pointed at a hardcoded list — `/admin/incidents`,
 * `/admin/assignments` — so arriving at a detail page from Seguimiento and then
 * pressing back dropped you in a screen you were never on.
 *
 * The last LIST routes you visited are remembered instead (a short stack of
 * the 3 most recent distinct ones). The target is the first entry that is not
 * the current route, so the button never points at the page you are already
 * on — that self-link is what made "volver" look dead on `/notifications`.
 * `sessionStorage` because it belongs to the tab, not to the account: two
 * tabs on different screens must not fight over one value.
 *
 * @param fallback Where to go when there is no history yet — a fresh tab opened
 *                 straight onto a detail URL, or sitting on a list with an
 *                 empty stack.
 */
export function useBackTarget(fallback: string): string {
  const pathname = usePathname();
  const [target, setTarget] = useState(fallback);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const stack = isListRoute(pathname) ? pushList(pathname) : readStack();
    setTarget(stack.find((entry) => entry !== pathname) ?? fallback);
  }, [pathname, fallback]);

  return target;
}
