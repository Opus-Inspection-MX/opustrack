/**
 * Neutral notification links.
 *
 * Copy stored in a notification (or mailed) cannot name a role-specific page:
 * the REPORTER who opens `/admin/incidents/7` bounces off the route guard.
 * Every incident/vacation link therefore points at `/notifications/go/...`,
 * and the handler resolves it against the routes the CURRENT user may open.
 */

/** In-app and mail link for an incident notification. */
export function incidentGoLink(incidentId: number): string {
  return `/notifications/go/incident/${incidentId}`;
}

/** In-app and mail link for a vacation notification. */
export function vacationGoLink(vacationId: string): string {
  return `/notifications/go/vacation/${vacationId}`;
}

/**
 * Resolve where `/notifications/go/[entity]/[id]` sends the current user.
 *
 * `canAccess` is the caller's route check (the JWT route grants): candidates
 * are tried in order and the first reachable one wins. Returns null when the
 * entity is unknown, the id is malformed, or the user reaches none of the
 * candidates — the handler turns that into a 404, never a leak.
 */
export async function resolveNotificationDestination(
  entity: string,
  id: string,
  canAccess: (path: string) => boolean | Promise<boolean>,
): Promise<string | null> {
  if (entity === "incident") {
    const incidentId = Number(id);
    if (!Number.isInteger(incidentId)) return null;
    const candidates = [
      `/admin/incidents/${incidentId}`,
      `/reporter/incidents/${incidentId}`,
      "/fsr/incidents",
    ];
    for (const candidate of candidates) {
      if (await canAccess(candidate)) return candidate;
    }
    return null;
  }
  if (entity === "vacation") {
    if (!id) return null;
    const candidates = ["/admin/vacations", "/vacations"];
    for (const candidate of candidates) {
      if (await canAccess(candidate)) return candidate;
    }
    return null;
  }
  return null;
}
