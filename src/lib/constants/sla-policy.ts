import moment from "moment-timezone";
import { APP_TZ } from "@/lib/utils/datetime";
import { CRITICAL_PRIORITY_THRESHOLD } from "./incident-type";

/**
 * SLA targets from priority (RF-218).
 *
 * Priority already exists on every `IncidentType` (1–10), but it had no
 * teeth: nothing declared a breach. This module turns it into response and
 * resolution targets, in CDMX business days, computed on read and never
 * stored — so a policy edit applies immediately with no migration or
 * backfill. History note: a bare per-type `sla Int` column was added and
 * later removed; it is deliberately NOT revived (one int cannot hold two
 * targets, and per-type scalars drift from the priority they duplicate).
 */

/** Priority bands reuse the `PriorityBadge` buckets, so badge color and SLA urgency can never disagree. */
export type SlaBand = "critical" | "medium" | "low";

export interface SlaTargets {
  /** Business days from creation to the first `seenAt` (first acuse). */
  responseBusinessDays: number;
  /** Business days from creation to `CERRADO`. */
  resolutionBusinessDays: number;
}

/**
 * Starting targets, chosen at design review — tunable in a one-line diff
 * with zero migration (the entire point of code-policy over a column).
 */
export const SLA_POLICY: Record<SlaBand, SlaTargets> = {
  critical: { responseBusinessDays: 1, resolutionBusinessDays: 3 },
  medium: { responseBusinessDays: 2, resolutionBusinessDays: 7 },
  low: { responseBusinessDays: 5, resolutionBusinessDays: 15 },
};

/** Share of a target consumed at which an incident counts as at risk. */
export const SLA_AT_RISK_RATIO = 0.8;

/** Lower bound of the medium band (5–7); 8+ is critical, below 5 is low. */
export const MEDIUM_PRIORITY_THRESHOLD = 5;

export function slaBandForPriority(priority: number): SlaBand {
  if (priority >= CRITICAL_PRIORITY_THRESHOLD) return "critical";
  if (priority >= MEDIUM_PRIORITY_THRESHOLD) return "medium";
  return "low";
}

export function slaTargetsForPriority(priority: number): SlaTargets {
  return SLA_POLICY[slaBandForPriority(priority)];
}

/**
 * Whole business days in the half-open interval (from, to], counted in
 * Mexico City time: weekdays (Mon–Fri) minus the given official holidays.
 *
 * The creation day itself never consumes the clock (day-zero): an incident
 * created Friday and evaluated Monday accrues 1, not 2.
 *
 * `holidays` is a precomputed set of "YYYY-MM-DD" strings (see
 * `getHolidayDatesForYear`). It MUST contain shared official holidays only —
 * never per-user vacations: SLA measures the organization's obligation, not
 * an individual's calendar (`availability.ts` models both; only holidays
 * belong here).
 */
export function businessDaysBetween(
  from: Date,
  to: Date,
  holidays: Set<string>,
): number {
  if (to.getTime() <= from.getTime()) return 0;
  const startDay = moment(from).tz(APP_TZ).startOf("day");
  const endDay = moment(to).tz(APP_TZ).startOf("day");
  let days = 0;
  const cursor = startDay.clone().add(1, "day");
  while (cursor.isSameOrBefore(endDay, "day")) {
    if (
      cursor.isoWeekday() <= 5 &&
      !holidays.has(cursor.format("YYYY-MM-DD"))
    ) {
      days += 1;
    }
    cursor.add(1, "day");
  }
  return days;
}

export type SlaState = "ON_TRACK" | "AT_RISK" | "BREACHED" | "NOT_APPLICABLE";

export interface SlaStateInput {
  priority: number;
  /** Pass `Incident.reportedAt` — the creation timestamp. */
  createdAt: Date;
  /** First `seenAt` across active assignments, if any. */
  seenAt: Date | null;
  /**
   * Effective closure timestamp, if closed: the RF-219 audit-trail
   * precedence (`getIncidentClosureAt()`), falling back to the live
   * `resolvedAt` column for pre-deploy history without events.
   */
  resolvedAt: Date | null;
  statusName: string | null;
  now: Date;
  holidays: Set<string>;
}

/**
 * Breach state of one incident (RF-218). Pure function of its inputs.
 *
 * 1. `CANCELADA` → `NOT_APPLICABLE`, always first: cancellation is terminal
 *    without a resolution obligation.
 * 2. Response phase (no `seenAt` yet): business days creation → now against
 *    the response target. Unseen incidents accrue indefinitely.
 * 3. Resolution phase (`seenAt` set, still open): creation → now against the
 *    resolution target.
 * 4. Closed (`resolvedAt` set): creation → closure against the resolution
 *    target — history (was it late?), so `AT_RISK` never applies
 *    retroactively.
 * 5. `CERRADO` with no closure timestamp at all (legacy rows predating the
 *    RF-219 audit log) → `ON_TRACK`: a breach flag assigns blame, and blame
 *    is never declared without evidence.
 */
export function getSlaState(args: SlaStateInput): SlaState {
  if (args.statusName === "CANCELADA") return "NOT_APPLICABLE";
  const targets = slaTargetsForPriority(args.priority);
  if (args.resolvedAt) {
    const elapsed = businessDaysBetween(
      args.createdAt,
      args.resolvedAt,
      args.holidays,
    );
    return elapsed > targets.resolutionBusinessDays ? "BREACHED" : "ON_TRACK";
  }
  if (args.statusName === "CERRADO") return "ON_TRACK";
  const target = args.seenAt
    ? targets.resolutionBusinessDays
    : targets.responseBusinessDays;
  const elapsed = businessDaysBetween(args.createdAt, args.now, args.holidays);
  if (elapsed > target) return "BREACHED";
  if (elapsed >= target * SLA_AT_RISK_RATIO) return "AT_RISK";
  return "ON_TRACK";
}
