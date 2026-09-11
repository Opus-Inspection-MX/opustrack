/**
 * Backwards-compatible re-export.
 *
 * `StatCard` now lives in the shared primitives (`common/stat-card.tsx`)
 * with the generalized props (href, tone). Existing report screens keep
 * importing from here; new screens import from `common/stat-card`.
 */

export type { StatCardTone } from "@/components/common/stat-card";
export { StatCard } from "@/components/common/stat-card";
