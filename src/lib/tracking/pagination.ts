/**
 * Tracking pagination contract (Fase 6b).
 *
 * Lives outside `src/lib/actions/tracking.ts` on purpose: `"use server"`
 * files may only export async functions, so the page sizes, the default and
 * the clamping helper live here where both the Server Action and the client
 * page can import them.
 */
export const TRACKING_PAGE_SIZES = [50, 100, 200] as const;
export type TrackingPageSize = (typeof TRACKING_PAGE_SIZES)[number];
export const TRACKING_DEFAULT_PAGE_SIZE: TrackingPageSize = 50;

export interface TrackingPagination {
  page?: number;
  pageSize?: number;
}

/**
 * Clamp the pagination to the contract: page ≥ 1, pageSize in 50/100/200.
 * Anything else falls back to page 1 / 50 rows — a forged query param must
 * never become an unbounded `take`.
 */
export function normalizePagination(pagination?: TrackingPagination): {
  page: number;
  pageSize: TrackingPageSize;
} {
  const page = Math.max(1, Math.floor(pagination?.page ?? 1) || 1);
  const requested = pagination?.pageSize ?? TRACKING_DEFAULT_PAGE_SIZE;
  const pageSize = (TRACKING_PAGE_SIZES as readonly number[]).includes(
    requested,
  )
    ? (requested as TrackingPageSize)
    : TRACKING_DEFAULT_PAGE_SIZE;
  return { page, pageSize };
}
