"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const KEY = "opustrack:last-list";

/**
 * Where "volver" should actually take you.
 *
 * Every back button in the app pointed at a hardcoded list — `/admin/incidents`,
 * `/admin/assignments` — so arriving at a detail page from Seguimiento and then
 * pressing back dropped you in a screen you were never on.
 *
 * The last LIST route you visited is remembered instead. A list is any route
 * that is not a detail, a form, or a nested action, which in this app means it
 * has no `/new`, `/edit` or id segment. `sessionStorage` because it belongs to
 * the tab, not to the account: two tabs on different screens must not fight
 * over one value.
 *
 * @param fallback Where to go when there is no history yet — a fresh tab opened
 *                 straight onto a detail URL.
 */
export function useBackTarget(fallback: string): string {
  const pathname = usePathname();
  const [target, setTarget] = useState(fallback);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const segments = pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1] ?? "";
    // A list route ends in a plain word: `/admin/incidents`. Anything ending in
    // an id, `new` or `edit` is somewhere you came FROM a list.
    const isList =
      segments.length > 0 &&
      last !== "new" &&
      last !== "edit" &&
      !/^\d+$/.test(last) &&
      // cuid ids are long and alphanumeric; a section name is not.
      !(last.length > 20 && /^[a-z0-9]+$/i.test(last));

    if (isList) {
      window.sessionStorage.setItem(KEY, pathname);
      setTarget(pathname);
      return;
    }

    setTarget(window.sessionStorage.getItem(KEY) ?? fallback);
  }, [pathname, fallback]);

  return target;
}
