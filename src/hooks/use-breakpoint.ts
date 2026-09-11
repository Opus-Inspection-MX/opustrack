import * as React from "react";

/**
 * The one responsive breakpoint of the app: `lg` (1024px).
 *
 * The sidebar is fixed at `lg` and up and a drawer below it; the header
 * trigger, the tab bar, and the SidebarProvider all cut at the same width.
 * Splitting `md` for one and `lg` for another rendered two notification
 * bells between 768 and 1023px, so everything shares this constant.
 */
const MOBILE_BREAKPOINT = 1024;

/**
 * Single breakpoint hook for the app.
 *
 * `useIsMobile` covers below-`lg`; `useMediaQuery` covers any other
 * query. Both share one matchMedia subscription pattern. This file replaces
 * the former `use-mobile.ts` / `use-media-query.ts` pair (one of them is
 * gone, because knip forbids dead files).
 */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = React.useState(false);

  React.useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);
    const listener = () => setMatches(media.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);

  return matches;
}

export function useIsMobile() {
  return useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
}

export function useIsDesktop() {
  return useMediaQuery(`(min-width: ${MOBILE_BREAKPOINT}px)`);
}
